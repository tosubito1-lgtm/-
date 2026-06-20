/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limit to accommodate base64 images or large scripts
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

function getGenAI(req: express.Request): GoogleGenAI {
  const customToken = req.header("x-yadam-token") || req.header("X-Yadam-Token");
  const legacyKey = req.header("x-custom-gemini-key") || req.header("X-Custom-Gemini-Key");
  
  let apiKey = process.env.GEMINI_API_KEY;
  
  if (customToken) {
    try {
      const decoded = Buffer.from(customToken, "base64").toString("utf-8").trim();
      // Ensure we decode correctly: A valid decoded token should not contain control characters
      // and typically starts with standard API key prefixes like 'AIzaSy' or 'AQ'
      if (decoded && decoded.length > 10 && !/[\x00-\x1F\x7F-\x9F]/.test(decoded)) {
        apiKey = decoded;
      } else {
        apiKey = customToken; // Fallback if not base64 but contains raw key
      }
    } catch (e) {
      apiKey = customToken;
    }
  } else if (legacyKey) {
    apiKey = legacyKey;
  }

  if (!apiKey) {
    throw new Error("스토리보드 제어 엔진 혹은 브라우저 설정에 GEMINI_API_KEY가 존재하지 않습니다. AI 스튜디오 Settings > Secrets 혹은 화면 우측 '개별 Gemini API 키 설정' 공간에 사용 가능한 키를 입력해 주세요.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      timeout: 180000, // Configure 3 minutes timeout for heavy JSON script analysis payloads
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Endpoint for Script Analysis & Storyboard Blueprint Generation
 */
app.post("/api/analyze-script", async (req, res): Promise<void> => {
  try {
    const { script, quantityOverride, quantityValue } = req.body;
    if (!script || typeof script !== "string" || script.trim().length === 0) {
      res.status(400).json({ error: "Script text is required and cannot be empty." });
      return;
    }

    // Check if it's an advanced structured template script (highly customized format)
    const isStructured = script.includes("[S1.]") || script.includes("[S1]") || script.includes("[IMAGE GENERATION PROMPT]");
    if (isStructured) {
      const parsedData = parseStructuredScript(script);
      if (parsedData) {
        console.log(`[STORYBOARD ENGINE] Instantly parsed structured script (${parsedData.scenes.length} scenes) locally!`);
        res.json(parsedData);
        return;
      }
    }

    const ai = getGenAI(req);

    const systemInstruction = `
You are a highly professional historical storyteller storyboard engine specializing in YouTube script analysis and image prompt engineering.
Your goals are:
1. Extract and standardize 1 to 4 main characters (Character DB).
2. Extract recurring settings/locations (Location DB).
3. Generate a modular sequence of storyboard scene blocks matching the timeline.

=== ARCHITECTURAL GUIDELINES ===
- Character Sheets: Create clean portrait prompts for character sheets. They MUST represent ONLY ONE person centered, isolated, with no secondary characters or complex backgrounds.
- Joseon Period Historical Accuracy & Prop Representation:
  - You MUST translate any modern tools/structures/props into their authentic Joseon-era traditional counterparts. Absolutely NO modern plastic, modern glass, steel tubular legs, or modern metal wire holders.
  - If a "지구의" (terrestrial globe) or "지구본" is mentioned, describe it as: "an antique traditional hand-painted paper terrestrial globe (지구의) cradled on an ornate Joseon-period hand-carved dark wooden floor stand, decorated with elegant black ink calligraphic names and traditional water-color map routes."
  - If astronomical instruments or clocks are mentioned, describe them as: "a traditional Joseon bronze Honcheonui (혼천의) armillary sphere with intricate rustic brass rings and heavy dark wooden frames."
  - Avoid modern furniture. Instead, utilize low writing desks (서안), wooden storage chests (반닫이), tall brass or iron candleholders (촛대), and hand-painted silk/paper folding screens (병풍) to establish an authentic Joseon interior ambiance.
- Scene Timeline:
  - If quantityOverride is active, divide the narrative beats of the script into exactly ${quantityValue} scenes.
  - If quantityOverride is inactive, divide the storyboard naturally into chronological story beats (typically 5 to 12 scenes).
- Consistent Character Description: To ensure characters look visually uniform across various scenes, describe their clothing (e.g. durumagi, gat hat), physical attributes clearly in the refined prompt.
- English Compatibility: You MUST extract 'appearanceEnglish' and 'clothingEnglish' for characters as precise English visual key tags or phrases (e.g. 'young Joseon man with a neat topknot and a thin mustache'), and 'descriptionEnglish' for locations as evocative English setting depictions. This ensures maximum consistency when styling characters dynamically across settings.
- YouTube safety compliance: For any scene involving blood, physical violence, torture, or gruesome Joseon executions, do NOT depict actual blood, gory open wounds, or gory physical trauma. Instead, translate it into abstract, high-contrast, atmospheric visual metaphors. For instance, use: 'heavy dark rain over a fractured Joseon steel sword', 'intense red atmospheric backlighting casting long shadows of a locked cell', 'glowing red mystical fire consuming paper archives', or 'dramatic black silhouette on a paper wall'.
  - Note: Non-gory physical changes or medical symptoms (such as pale face, fever, sweat beads, or subtle red spots/rashes on skin) MUST be described accurately and literally (e.g., "fine red spots and rashes on the skin of his face and arms") rather than using gory metaphors like blood pools.

=== ACCURACY & FAITHFULNESS TO STAGE DIRECTIONS ===
- The 'refinedImagePrompt' MUST serve as a highly faithful visual representation of the 'visualDescription' (Stage Direction/Depiction) and the scene's emotional context.
- You MUST capture the precise actions, gestures, poses, and objects specified in the stage directions.
  - If a character lies dead/sick on a bed with their limp hand hanging down to the floor, do not have them sitting in a chair. Explicitly specify: "a character lying dead on a bed, one of their pale limp hands hanging down off the side of the bed toward the floor".
  - If specific physical focal points or scene directions are mentioned, make sure they are the primary subject of the prompt.
- NEVER omit active characters or the main subject of action from the 'refinedImagePrompt'.

=== SPEED & TIMEOUT OPTIMIZATIONS ===
- Avoid extremely long or repetitive explanations. Keep 'narrationText' and 'visualDescription' crisp, natural, and concise (under 2 sentences per field, maximum 50 characters).
- Keep 'refinedImagePrompt' and 'characterSheetPrompt' highly descriptive but compact (under 55 words). Focus strictly on key items: subject with precise pose/gesture/action/expression, setting, weather/lighting, and style.
- This is a critical latency optimization. Fields under 55 words guarantee the analysis completes rapidly in 15-20 seconds without timing out.
`;

    const responseSchema = {
      type: Type.OBJECT,
      description: "Structured analysis of a storyteller storyboard script.",
      properties: {
        characters: {
          type: Type.ARRAY,
          description: "List of extracted core characters (maximum 4 characters).",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Historical or rustic Korean name (e.g., 홍길동, 돌쇠)." },
              gender: { type: Type.STRING, description: "Gender of the character (e.g., '남성', '여성')." },
              age: { type: Type.STRING, description: "Age tier (e.g., '20대 청년', '70대 노인', '10대 소녀')." },
              appearance: { type: Type.STRING, description: "Concrete facial and physical traits (facial hair, look, beard) in Korean." },
              clothing: { type: Type.STRING, description: "Type of Joseon traditional garments wore (e.g., 도포와 갓, 허름한 한복)." },
              traits: { type: Type.STRING, description: "Core traits or role (e.g., '가람 서당의 영리한 제자', '탐욕스러운 양반')." },
              characterSheetPrompt: {
                type: Type.STRING,
                description: "English descriptive visual prompt for character portrait design. Focuses purely on one centered person, white or flat background, highly detailed character concept. Avoid secondary objects or people."
              },
              appearanceEnglish: {
                type: Type.STRING,
                description: "Highly precise English visual key phrase of character's facial and physical traits (e.g. 'handsome 20-year old Joseon man, clean-shaven face, neat classic topknot hair, expressive intense eyes, sharp jawline'). No meta descriptions."
              },
              clothingEnglish: {
                type: Type.STRING,
                description: "Precise English description of character's garments (e.g. 'wearing a navy blue silk scholar durumagi robe and a traditional black translucent gat hat')."
              }
            },
            required: ["name", "gender", "age", "appearance", "clothing", "traits", "characterSheetPrompt", "appearanceEnglish", "clothingEnglish"]
          }
        },
        locations: {
          type: Type.ARRAY,
          description: "Crucial locations relevant to the narrative.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Setting label in Korean (e.g., 숲속 초막, 대감댁 기와방)." },
              description: { type: Type.STRING, description: "Joseon period architectural details, mood, lighting settings (in Korean)." },
              descriptionEnglish: {
                type: Type.STRING,
                description: "Concise yet evocative English atmosphere setting description (e.g., 'inside a dimly lit old Joseon wooden room, a traditional candle casting long shadows on paper screen doors, historical nostalgic atmosphere')."
              }
            },
            required: ["name", "description", "descriptionEnglish"]
          }
        },
        scenes: {
          type: Type.ARRAY,
          description: "The chronologically ordered scene slots for drawing the storyboards.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER, description: "Sequential scene ID starting from 1." },
              stage: {
                type: Type.STRING,
                description: "Story development stage for styling variations (early, middle, late, final).",
                enum: ["early", "middle", "late", "final"]
              },
              locationName: { type: Type.STRING, description: "The corresponding location name from locations list." },
              characterNames: {
                type: Type.ARRAY,
                description: "Names of characters who are present in this specific scene.",
                items: { type: Type.STRING }
              },
              narrationText: { type: Type.STRING, description: "Narrative subtitle or script fragment in Korean." },
              visualDescription: { type: Type.STRING, description: "Detailed stage scene direction (in Korean)." },
              refinedImagePrompt: {
                type: Type.STRING,
                description: "English image generation prompt including characters present, background lighting, angle, Joseon period detail, and mood. Ensure physical acts are described safely and metaphorically."
              }
            },
            required: ["id", "stage", "locationName", "characterNames", "narrationText", "visualDescription", "refinedImagePrompt"]
          }
        }
      },
      required: ["characters", "locations", "scenes"]
    };

    const userPrompt = `
Analyze the following script text and output the results as JSON matching the schema.

--- SCRIPT TEXT ---
${script}

--- QUANTITY MODE ---
Quantity Override: ${quantityOverride ? "ACTIVE" : "INACTIVE"}
Target Scene Count: ${quantityOverride ? quantityValue : "Natural Beats (usually 5 to 12)"}
`;

    const response = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2, // slightly lower for more reliable structured compliance
        },
      }),
      3,
      2000
    );

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedJson);

  } catch (error: any) {
    console.error("Error during script analysis:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during analysis." });
  }
});

/**
 * Helper to wrap image prompts with art style modifiers
 */
function injectArtStyle(prompt: string, style: "realistic" | "3d" | "anime" | "yadam"): string {
  const cleanPrompt = prompt.trim().replace(/[\.+]$/, ""); // remove trailing dot
  switch (style) {
    case "yadam":
      return `${cleanPrompt}, Korean historical webtoon style, Joseon dynasty storytelling illustration, traditional Korean folklore atmosphere, same art style throughout entire story, consistent character appearance, consistent clothing, consistent environment design, clean line art, natural colors, soft shading, warm cinematic lighting, animation-friendly design`;
    case "realistic":
      return `${cleanPrompt}, raw ultra-realistic film shot, 35mm lens photo, historical accuracy Joseon, lifelike skin textures, cinematic lighting and shadows, subtle grain, historical ambient drama`;
    case "3d":
      return `${cleanPrompt}, stylized 3D animation character render, octane render style, soft ambient shadows, Pixar character aesthetic, historical Joseon dynasty detail, cute and clean 3D look`;
    case "anime":
      return `${cleanPrompt}, gorgeous anime layout style, warm Studio Ghibli retro painting aesthetic, hand-drawn background, traditional watercolor, soft ambient line art, nostalgia lighting`;
    default:
      return cleanPrompt;
  }
}

/**
 * Helper to retry Gemini API calls prone to transient deadline exceptions or internal hiccups.
 * Supports exponential backoff and randomized jitter to safely absorb temporal service load spikes.
 */
async function callGoogleGenWithRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 3000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorStr = String(error.message || error.status || JSON.stringify(error) || "").toUpperCase();
      const isRetryable =
        errorStr.includes("DEADLINE") ||
        errorStr.includes("EXPIRED") ||
        errorStr.includes("504") ||
        errorStr.includes("503") ||
        errorStr.includes("TIMEOUT") ||
        errorStr.includes("UNAVAILABLE") ||
        errorStr.includes("INTERNAL") ||
        errorStr.includes("OVERLOADED") ||
        errorStr.includes("BUSY") ||
        errorStr.includes("TEMP") ||
        errorStr.includes("CONGESTED");

      if (isRetryable && attempt < retries) {
        const jitter = Math.floor(Math.random() * 1000);
        const currentDelay = delayMs * Math.pow(1.8, attempt - 1) + jitter;
        console.warn(`[GEMINI RETRY] Attempt ${attempt}/${retries} failed with transient error: ${error.message || error}. Retrying in ${Math.round(currentDelay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

/**
 * API Key Verification Endpoint
 * Validates the provided or server-side API Key with a lightweight text-completion check.
 */
app.post("/api/check-engine", async (req, res): Promise<void> => {
  try {
    const ai = getGenAI(req);
    // Perform an ultra-lightweight check using gemini-2.5-flash which is extremely fast and cheap
    const testResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: "API Key Verification. Please reply only of 'OK' if you see this." }],
    });
    
    const reply = testResponse.text?.trim() || "";
    console.log(`[KEY VERIFICATION] API Key verified successfully. Test response: "${reply}"`);
    res.json({ success: true, reply });
  } catch (error: any) {
    console.error("[KEY VERIFICATION FAIL] API key verification failed:", error);
    let errorDetails = error.message || String(error);
    
    // Help users troubleshoot with clear messages for common API Key error codes
    if (errorDetails.includes("API_KEY_INVALID") || errorDetails.includes("API key not valid") || errorDetails.includes("INVALID_ARGUMENT")) {
      errorDetails = "입력하신 API 키가 유효하지 않습니다. 혹시 키 대신 모델명(예: GEMINI-3.5-FLASH)을 입력하셨거나 잘못 복사하지 않으셨나요? 구글 API 키는 대개 'AIzaSy' 또는 'AQ'로 시작하는 난수 문자열입니다.";
    } else if (errorDetails.includes("API key not found")) {
      errorDetails = "구글 서버에서 해당 API 키를 찾을 수 없습니다. 혹시 입력한 검색어나 텍스트에 오타가 있는지 다시 점검해 주세요. 구글 API 키는 'AIzaSy' 또는 'AQ'로 시작합니다.";
    } else if (errorDetails.includes("RESOURCE_EXHAUSTED")) {
      if (errorDetails.toLowerCase().includes("prepayment") || errorDetails.toLowerCase().includes("depleted")) {
        errorDetails = "입력하신 API 키 프로젝트의 선불 잔액(Prepayment Credits)이 모두 소진되어 구글 호출이 정지되었습니다. 구글 AI 스튜디오 프로젝트 결제 관리 페이지(https://ai.studio/projects)로 직접 이동하셔서 선불 충전(Prepay)을 진행해 주셔야 정상 복원됩니다. 또는, 구글 AI 스튜디오에서 '무료 프로젝트(Default Project)'를 선택하신 후 새 무료 키를 발급받아 등록하시면 선불 충전과 관계없이 분당 요청 제한 하에 무료로 계속 이용하실 수 있습니다.";
      } else {
        errorDetails = "이 API 키는 현재 속도 제한 혹은 사용량 한도 초과 상태입니다. (RESOURCE_EXHAUSTED) 무료 플랜의 경우 짧은 대기 간격을 유념해 주시고, 15~30초 후에 아래 개별 [다시 생성 / 다시 시도] 버튼을 눌러보세요.";
      }
    }
    
    res.json({ success: false, error: errorDetails });
  }
});

/**
 * Endpoint to generate a highly consistent Character Portrait (portrait/concept sheet)
 */
app.post("/api/generate-character-image", async (req, res): Promise<void> => {
  try {
    const { prompt, artStyle, modelName, aspectRatio } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required for image generation." });
      return;
    }

    const ai = getGenAI(req);

    // STRICT PORTRAIT MODIFIERS to avoid multiple people appearing in the frame
    const basePortraitModifiers = "Only ONE person, isolated portrait, single character, no secondary character, no group, no background people, strictly single shot, solo view, plain flat background";
    
    // Stitch modifiers together
    const finalPrompt = injectArtStyle(`${prompt}, ${basePortraitModifiers}`, artStyle || "yadam");
    const activeModel = modelName || "gemini-2.5-flash-image";

    console.log(`Generating character sheet. Model: ${activeModel}, Prompt: "${finalPrompt}"`);

    const imageResponse = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: activeModel,
        contents: {
          parts: [{ text: finalPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "1:1",
            imageSize: activeModel === "gemini-3.1-flash-image" ? "1K" : undefined,
          },
        },
      }),
      5,
      3000
    );

    let base64Image = "";
    if (imageResponse.candidates?.[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image was returned from the Gemini Image model.");
    }

    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });

  } catch (error: any) {
    console.error("Error generating character portrait:", error);
    let errMsg = error.message || "Failed to generate character sheet image.";
    const errStr = String(errMsg).toUpperCase();
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || errStr.includes("QUOTA")) {
      errMsg = "Gemini 이미지 생성 속도 제한(Quota)이 초과되었습니다 (429 RESOURCE_EXHAUSTED). 구글 등급 정책에 따라 무료 키는 물론, 유료(Pay-as-you-go) API 키 환경이더라도 큐 대기열에서 짧은 간격으로 이미지를 초고속 대량 요청하면 분당 허용 호출 횟수(QPM)가 일시 소모되어 제한될 수 있습니다. 약 15초~30초 후에 아래 개별 [다시 생성 / 다시 렌더 시도] 단추를 누르면 이어서 정상 발급됩니다.";
    } else if (errStr.includes("DEADLINE") || errStr.includes("504") || errStr.includes("EXPIRED")) {
      errMsg = "구글 제미나이 이미지 생성 서버의 일시적인 혼잡으로 타임아웃(DEADLINE_EXCEEDED)이 계속 유발되었습니다. 잠시 후 실패한 장면에 비축된 [다시 생성] 단추를 클릭해 개별 발급을 진행해 주세요.";
    }
    res.status(500).json({ error: errMsg });
  }
});

/**
 * Endpoint to generate a Scene Image
 */
app.post("/api/generate-scene-image", async (req, res): Promise<void> => {
  try {
    const { prompt, artStyle, modelName, aspectRatio, isWanIntro } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required for scene generation." });
      return;
    }

    const ai = getGenAI(req);
    
    let basePrompt = prompt;
    if (isWanIntro) {
      basePrompt = `${prompt}, high-integrity WAN dynamic motion starter frame, capturing the precise tense instant immediately before physical action begins, high energy potential, action-ready pose, crisp clear hair and cloth boundaries, perfect reference starting pose for image-to-video animation generators`;
    }
    
    const finalPrompt = injectArtStyle(basePrompt, artStyle || "yadam");
    const activeModel = modelName || "gemini-2.5-flash-image";

    console.log(`Generating scene image. Model: ${activeModel}, WAN-Intro: ${!!isWanIntro}, Prompt: "${finalPrompt}"`);

    const imageResponse = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: activeModel,
        contents: {
          parts: [{ text: finalPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "16:9",
            imageSize: activeModel === "gemini-3.1-flash-image" ? "1K" : undefined,
          },
        },
      }),
      5,
      3000
    );

    let base64Image = "";
    if (imageResponse.candidates?.[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image was returned from the Gemini Image model.");
    }

    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });

  } catch (error: any) {
    console.error("Error generating scene image:", error);
    let errMsg = error.message || "Failed to generate scene image.";
    const errStr = String(errMsg).toUpperCase();
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || errStr.includes("QUOTA")) {
      errMsg = "Gemini 이미지 생성 속도 제한(Quota)이 초과되었습니다 (429 RESOURCE_EXHAUSTED). 구글 등급 정책에 따라 무료 키는 물론, 유료(Pay-as-you-go) API 키 환경이더라도 큐 대기열에서 짧은 간격으로 이미지를 초고속 대량 요청하면 분당 허용 호출 횟수(QPM)가 일시 소모되어 제한될 수 있습니다. 약 15초~30초 후에 아래 개별 [다시 생성 / 다시 렌더 시도] 단추를 누르면 이어서 정상 발급됩니다.";
    } else if (errStr.includes("DEADLINE") || errStr.includes("504") || errStr.includes("EXPIRED")) {
      errMsg = "구글 제미나이 이미지 생성 서버의 일시적인 혼잡으로 타임아웃(DEADLINE_EXCEEDED)이 계속 유발되었습니다. 잠시 후 실패한 장면에 비축된 [다시 생성] 단추를 클릭해 개별 발급을 진행해 주세요.";
    }
    res.status(500).json({ error: errMsg });
  }
});

/**
 * Endpoint for YouTube Thumbnail Director Analysis & Planning
 */
app.post("/api/analyze-thumbnail-director", async (req, res): Promise<void> => {
  try {
    const { script, scenes, characters, locations } = req.body;
    if (!script || !scenes || !Array.isArray(scenes) || scenes.length === 0) {
      res.status(400).json({ error: "Script text and storyboard scenes array are required." });
      return;
    }

    const ai = getGenAI(req);

    const systemInstruction = `
You are a legendary YouTube Thumbnail Director specializing in historical story, folklore (야담), and dark mystery YouTube channels.
Your target is NOT just to design a technically pretty picture, but to create the absolute highest Click-Through Rate (CTR) thumbnail plan.

=== ROLE & OBJECTIVES ===
1. Analyze the script text, characters, and scenes chronological storyboard to decide on ONE absolute best dramatic scene for the thumbnail.
2. Select the climax beat based on these priority standards:
   ① 가장 충격적인 진실 (The most shocking truth)
   ② 가장 큰 반전 (The greatest twist/revelation)
   ③ 가장 강렬한 감정 (The most intense facial emotion - extreme fear, boiling anger, crying despair)
   ④ 가장 위험한 순간 (The most dangerous/fatal moment)
   ⑤ 가장 극적인 갈등 (The most intense dramatic conflict between two key figures)
   ⑥ 가장 큰 궁금증을 유발하는 장면 (The scene inducing the highest suspense and mystery/curiosity)
3. Selection Constraints:
   - Do NOT pick the final scene just because it is the end.
   - Do NOT pick the most colorful/flamboyant scene if it lacks dramatic or emotional value.
   - Do NOT reveal/spoil the plot's ending or key answer.
   - Select a moment that immediately makes the viewer think: "What on earth is happening?" or "Is he about to die?".
   - Avoid low-intensity peaceful scenes.

=== THUMBNAIL IMAGE COMPOSITION RULES ===
1. Visual Contrast & Composition:
   - Close-Up Focus: Upper-body or face-only focus. Standard viewport should be zoomed onto the characters' expressive faces.
   - Characters: Maximum 1 or 2 key figures (never crowd the screen with background characters). The character's face/upper body must occupy 50% to 70% of the entire picture.
   - Facial Expressions: The emotion (shock, fear, wrath, sorrow, resolution) must be extremely sharp, clean, and easily recognizable even when viewed at small thumbnail dimensions (e.g. on mobile screens).
   - Simple Background: Keep the background extremely simple, blurred, dark, or atmospheric (e.g., dark trees in fog, flickering candlelight shadows on a paper door, deep royal red background) so the viewer's eyes instantly lock onto the characters.
   - Cinematic Lighting: High-contrast chiaroscuro or dramatic rim lighting. High-contrast colors, strong spotlight focus. Film-poster quality finish.
2. Graphic Restrictions (STRICT BANS):
   - Absolutely NO text, NO overlay letters, NO watermarks, NO logos, NO dialogue bubbles.
   - Absolutely NO modern products, NO modern weapons, NO cars, NO modern clothes, NO sci-fi elements.
   - No blurriness or low resolution. Faces must not be cropped out of the canvas boundaries.
3. Character Consistency:
   - You MUST utilize exactly the same character descriptions from the Character DB to ensure visual consistency.
   - Incorporate the English attributes if present (e.g. appearanceEnglish, clothingEnglish) of the characters chosen.
   

=== KOREAN CAPTION HOOKS (THUMBNAIL TEXT) ===
Propose exactly 5 highly compelling Korean clickbait phrases for the thumbnail text, plus select the single best one:
- Content: Short, intense, curiosity-inducing phrases (2~5 words, maximum 12 characters).
- Style: Focus on shocks, twists, secrets, dark conspiracies, or high curiosity.
- Banned: No explanatory titles, no spoilers, no copying of the video's original title.
- Examples: '왕도 속았다', '독살의 진실', '범인은 따로 있었다', '왕이 감춘 비밀', '모두가 거짓이었다', '죽은 줄 알았다', '절대 들켜선 안 됐다', '그날 밤의 진실'.
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        chosenSceneId: { type: Type.INTEGER, description: "The sequential ID of the selected storyboard scene (from 1 to N)." },
        sceneTitle: { type: Type.STRING, description: "Brief Korean title or label of the chosen scene." },
        selectionReason: { type: Type.STRING, description: "2 to 3 lines in Korean explaining why this specific scene was selected as the sovereign high-CTR thumbnail climax according to the rules." },
        visualPrompt: { type: Type.STRING, description: "Evocative, precise English image generation prompt designed for Imagen 3. Focuses heavily on zoomed face/upper bodies of a maximum of 1-2 characters, high-contrast emotional facial features matching character descriptions, dark thematic chiaroscuro lighting, and a heavily simplified blurred background." },
        textCandidates: {
          type: Type.ARRAY,
          description: "Exactly 5 short, dramatic Korean clickbait text candidates (2~5 words, maximum 12 characters each, suspense-focused).",
          items: { type: Type.STRING }
        },
        recommendedText: { type: Type.STRING, description: "The single best caption recommended for generating the highest possible CTR." },
        recommendationReason: { type: Type.STRING, description: "Detailed Korean explanation of the tactical psychological reason why this recommended text will hook viewers." }
      },
      required: ["chosenSceneId", "sceneTitle", "selectionReason", "visualPrompt", "textCandidates", "recommendedText", "recommendationReason"]
    };

    const userPrompt = `
Analyze the provided storyboard material and script to create the ultimate premium CTR YouTube thumbnail.

--- SCRIPT TEXT ---
${script}

--- CHARACTER REGISTER (CHARACTER DB) ---
${JSON.stringify(characters, null, 2)}

--- STAGE LOCATIONS ---
${JSON.stringify(locations, null, 2)}

--- STORYBOARD SCENES ---
${JSON.stringify(scenes.map(s => ({
  id: s.id,
  locationName: s.locationName,
  characterNames: s.characterNames,
  narrationText: s.narrationText,
  visualDescription: s.visualDescription,
  refinedImagePrompt: s.refinedImagePrompt
})), null, 2)}

Analyze carefully and output the final choice as highly-structured JSON matching the required schema.
`;

    const modelResponse = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.3,
        },
      }),
      3,
      2000
    );

    const text = modelResponse.text || "";
    const parsed = JSON.parse(text);
    res.json(parsed);

  } catch (error: any) {
    console.error("Error in YouTube Thumbnail Director:", error);
    res.status(500).json({ error: error.message || "Failed to analyze and plan YouTube thumbnail." });
  }
});

/**
 * Run setup for Vite environment or production files serving
 */
async function startServer() {
  // Support static loading of assets first if we need
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  if (process.env.NODE_ENV !== "production") {
    // Development server with Vite middleware hot module reloading
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production builds files service
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[STORYBOARD ENGINE] Full-stack server running at http://0.0.0.0:${PORT}`);
  });

  // Set explicit timeouts on the node server to prevent premature connection terminations during long generation tasks
  server.timeout = 180000; // 3 minutes
  server.headersTimeout = 185000; // 3 minutes 5 seconds
  server.requestTimeout = 180000; // 3 minutes
}

/**
 * 고정 형식의 정형화된 고도화 대본(S1., S2., [IMAGE GENERATION PROMPT] 등)을
 * AI 서버 연동 없이 안전하게 다이렉트로 정밀 파싱하는 엔진 (0.1초 실행 시간, 타임아웃 0%)
 */
function parseStructuredScript(script: string) {
  interface ParsedCharacter {
    name: string;
    gender: string;
    age: string;
    appearance: string;
    clothing: string;
    traits: string;
    characterSheetPrompt: string;
    appearanceEnglish?: string;
    clothingEnglish?: string;
  }

  interface ParsedLocation {
    name: string;
    description: string;
    descriptionEnglish?: string;
  }

  interface ParsedScene {
    id: number;
    stage: "early" | "middle" | "late" | "final";
    locationName: string;
    characterNames: string[];
    narrationText: string;
    visualDescription: string;
    refinedImagePrompt: string;
  }

  const charactersMap = new Map<string, ParsedCharacter>();
  
  // 1. 캐릭터 정보 자동 추출
  // 예: Ch_A_Adult(27세, 헝클어진 상투 헤어, 수염 없는 깨끗한 얼굴)
  const charRegex = /(Ch_[A-Za-z0-9_]+)\s*\(([^)]+)\)/g;
  let match;
  while ((match = charRegex.exec(script)) !== null) {
    const charId = match[1];
    const details = match[2].split(",").map(s => s.trim());
    
    if (!charactersMap.has(charId)) {
      let displayName = charId;
      if (charId.includes("Ch_A_Adult")) displayName = "사도세자 (성인)";
      else if (charId.includes("Ch_A_Youth")) displayName = "어린 사도세자 (아역)";
      else if (charId.includes("Ch_A_Sado") || charId === "Ch_A") displayName = "사도세자";
      else if (charId.includes("Ch_B_Yeongjo") || charId === "Ch_B") displayName = "영조";
      else if (charId.includes("Ch_C_Hyegyeong") || charId === "Ch_C") displayName = "혜경궁 홍씨";
      else if (charId.includes("Ch_D_Yeongbin") || charId === "Ch_D") displayName = "영빈 이씨";
      else if (charId.includes("Ch_E_Nageon") || charId === "Ch_E") displayName = "나경언";
      else if (charId.includes("Ch_F_Noron") || charId === "Ch_F") displayName = "노론 대감";
      else if (charId.includes("Ch_G_Hongbonghan") || charId === "Ch_G") displayName = "홍봉한";
      else if (charId.includes("Ch_H_Jeongjo") || charId === "Ch_H") displayName = "정조";

      const age = details[0] || "알 수 없음";
      const appearance = details.slice(1).join(", ") || "세부 특징";
      
      let gender = "남성";
      if (charId.includes("Hyegyeong") || charId.includes("Yeongbin") || charId.includes("Ch_C") || charId.includes("Ch_D")) {
        gender = "여성";
      }

      // 인물별 전용 포트레이트 프롬프트 템플릿 매치
      let characterSheetPrompt = "";
      let appearanceEnglish = "";
      let clothingEnglish = "";
      if (charId.includes("Yeongjo") || charId === "Ch_B") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single elderly Joseon king, red royal dragon robe, ikseongwan royal crown, looking silent and stern, traditional grey long beard, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "stern, deeply wrinkled elderly Joseon king, traditional grey long beard";
        clothingEnglish = "majestic red royal dragon robe, black royal crown hat ikseongwan";
      } else if (charId.includes("Adult") || charId.includes("Sado") || charId === "Ch_A") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single young Joseon prince, disheveled royal blue robe, pale tragic face, no beard, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "tragic young Joseon crown prince, pale face, emotional eyes, no beard";
        clothingEnglish = "disheveled royal blue silk robe";
      } else if (charId.includes("Youth")) {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 15-year old Joseon prince, traditional blue royal hanbok, neat royal hair, no beard, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "neat 15-year-old Joseon boy, clear eyes, royal hair knot";
        clothingEnglish = "traditional blue royal court hanbok dress";
      } else if (charId.includes("Hyegyeong") || charId === "Ch_C") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single young beautiful Joseon noblewoman, elegant complex traditional hair ornament with binyeo hairpin, green silk Hanbok dress, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "young beautiful Joseon princess, elegant complex traditional hair ornament";
        clothingEnglish = "gorgeous green silk Hanbok dress with gold patterns";
      } else if (charId.includes("Yeongbin") || charId === "Ch_D") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 60-year old Joseon royal concubine, elegant traditional hair ornament, green silk Hanbok, weep expression, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "wise 60-year-old Joseon court concubine, sorrowful expression";
        clothingEnglish = "traditional dark green royal hanbok";
      } else if (charId.includes("Nageon") || charId === "Ch_E") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 30-year old Joseon man, traditional hanbok and topknot hair, thin sparse mustache, looking anxious, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "anxious-looking 30-year-old Joseon man, neat topknot";
        clothingEnglish = "simple brownish Joseon plebeian hanbok";
      } else if (charId.includes("Noron") || charId === "Ch_F") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 55-year old Joseon nobleman, dark administrative robe and samo hat, thick black-grey beard, look of subtle conspiracy, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "conspiratorial 55-year-old Korean minister, thick greyish beard";
        clothingEnglish = "dark green Joseon administrative uniform robe with samo hat";
      } else if (charId.includes("Hongbonghan") || charId === "Ch_G") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 50-year old Joseon minister, dark administrative hat, long dark beard, complex calculating look, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "calculating 50-year-old Joseon politician minister, long dark beard";
        clothingEnglish = "traditional administrative navy silk robe with samo hat";
      } else if (charId.includes("Jeongjo") || charId === "Ch_H") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 25-year old Joseon king Jeongjo, majestic red dragon robe, ikseongwan crown, neat thin mustache beard, powerful direct gaze, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "young confident Joseon king with strong direct gaze, thin neat mustache beard";
        clothingEnglish = "red royal dragon robe with gold emblems, royal crown ikseongwan";
      } else {
        characterSheetPrompt = `masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single Joseon period person, styled with ${details.join(", ")}, clean studio light grey background, solo card portrait focus`;
        appearanceEnglish = "Joseon period person";
        clothingEnglish = "traditional Joseon period Hanbok garments";
      }

      charactersMap.set(charId, {
        name: displayName,
        gender,
        age,
        appearance,
        clothing: charId.includes("Yeongjo") || charId === "Ch_B" || charId.includes("Jeongjo") || charId === "Ch_H" ? "붉은 곤룡포, 익선관" : (gender === "여성" ? "당의, 전통 한복" : "조선 도포, 상투"),
        traits: `${displayName}의 대본 인물 정보 역학`,
        characterSheetPrompt,
        appearanceEnglish,
        clothingEnglish
      });
    }
  }

  // 기본 캐릭터 폴백 (유실 방지)
  if (charactersMap.size === 0) {
    charactersMap.set("DefaultJoseon", {
      name: "조선 인물",
      gender: "남성",
      age: "30대",
      appearance: "전통 상투 머리, 단정한 한복 차림",
      clothing: "도포 한복",
      traits: "기본 조선시대 인용 인물",
      characterSheetPrompt: "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single Joseon period scholar wearing traditional white robe and gat hat, centered portrait, studio grey background, solo portrait focus",
      appearanceEnglish: "a traditional Joseon period scholar with topknot hair, looking calm",
      clothingEnglish: "traditional white scholar hanbok robe and a black gat hat"
    });
  }

  const scenes: ParsedScene[] = [];
  const locationsMap = new Map<string, string>();

  // 고유 씬 블록을 분류하기 위해 '[S(숫자)]' 또는 '[S(숫자).]' 정규식 컴포지션 수행
  const rawSceneBlocksMap = new Map<number, string>();
  const splitPattern = /\[S(\d+)\.?\]/g;
  let splitMatch;
  let lastIndex = 0;
  let currentId: number | null = null;
  
  // 최초 매치 이전 텍스트 인덱싱 세팅
  const firstMatch = splitPattern.exec(script);
  if (firstMatch) {
    currentId = parseInt(firstMatch[1], 10);
    lastIndex = firstMatch.index;
    
    while ((splitMatch = splitPattern.exec(script)) !== null) {
      if (currentId !== null) {
        rawSceneBlocksMap.set(currentId, script.slice(lastIndex, splitMatch.index));
      }
      currentId = parseInt(splitMatch[1], 10);
      lastIndex = splitMatch.index;
    }
    if (currentId !== null) {
      rawSceneBlocksMap.set(currentId, script.slice(lastIndex));
    }
  }

  let idCounter = 1;

  for (const [id, blockText] of rawSceneBlocksMap.entries()) {
    // 씬 헤더에서 장소, 인물 정보, 나레이션과 비주얼 텍스트 추출
    // 양식 예: [조선시대 창경궁 문정전 앞마당, 밤 / 인물 없음] / "비바람이..." (빗물이...)
    // 패턴을 포용력 있게 매치하기 위한 넉넉한 정규식
    const headerRegex = /\[S\d+\.?\]\s*\[\s*([^/\]]+?)(?:\s*\/\s*([^\]]+))?\]\s*(?:\/)?\s*"([^"]+)"\s*(?:\(([^)]+)\))?/;
    const headMatch = blockText.match(headerRegex);
    
    if (!headMatch) continue;
    
    const locationRaw = headMatch[1].trim();
    const characterRaw = headMatch[2] ? headMatch[2].trim() : "인물 없음";
    const narrationText = headMatch[3].trim();
    const visualDescription = headMatch[4] ? headMatch[4].trim() : "";

    // 위치 라벨 가공
    const cleanLocName = locationRaw.split(",")[0].trim();
    locationsMap.set(cleanLocName, locationRaw);

    // 씬 내 등장인물 추출
    const sceneCharacters: string[] = [];
    for (const [charId, charObj] of charactersMap.entries()) {
      if (characterRaw.includes(charId)) {
        sceneCharacters.push(charObj.name);
      }
    }
    if (sceneCharacters.length === 0 && characterRaw !== "인물 없음" && characterRaw.trim().length > 0) {
      // Ch_ID 외에 일반 텍스트 매칭 보조
      for (const [charId, charObj] of charactersMap.entries()) {
        const simpleName = charObj.name.split(" ")[0];
        if (characterRaw.includes(charObj.name) || characterRaw.includes(simpleName)) {
          sceneCharacters.push(charObj.name);
        }
      }
    }

    // [IMAGE GENERATION PROMPT] 추출
    const promptRegex = /\[IMAGE\s*GENERATION\s*PROMPT\]:\s*([^\n\r\[]+)/i;
    const promptMatch = blockText.match(promptRegex);
    let refinedImagePrompt = "";
    if (promptMatch && promptMatch[1]) {
      refinedImagePrompt = promptMatch[1].trim();
    } else {
      refinedImagePrompt = `masterpiece, best quality, year 2024, artistic rendering, Joseon period traditional backdrop, ${visualDescription || narrationText}, dramatic lighting, cinematic composition`;
    }

    // 씬 스테이지 자동 지정
    const totalScenes = rawSceneBlocksMap.size;
    let stage: "early" | "middle" | "late" | "final" = "early";
    const ratio = idCounter / (totalScenes || 1);
    if (ratio <= 0.25) stage = "early";
    else if (ratio <= 0.6) stage = "middle";
    else if (ratio <= 0.85) stage = "late";
    else stage = "final";

    scenes.push({
      id: idCounter++,
      stage,
      locationName: cleanLocName,
      characterNames: sceneCharacters,
      narrationText,
      visualDescription,
      refinedImagePrompt
    });
  }

  // 위치들
  const locations = Array.from(locationsMap.entries()).map(([name, desc]) => {
    // Light translation translation for offline structured scripts to elevate environment consistency
    let descEng = "traditional Joseon dynasty environment";
    const title = name.toLowerCase();
    const descriptiveText = desc.toLowerCase();
    if (title.includes("궁") || title.includes("전") || title.includes("대감")) {
      descEng = `historical Joseon royal court room or noble palace hall, elegant wooden architecture with traditional screen panels, ${name}`;
    } else if (title.includes("오두막") || title.includes("초막") || title.includes("처막") || descriptiveText.includes("초가집")) {
      descEng = `humble old Joseon wooden cottage with oil lanterns and flickering candles, ${name}`;
    } else if (title.includes("산") || title.includes("숲") || descriptiveText.includes("나무") || descriptiveText.includes("안개")) {
      descEng = `mystical dark Joseon forest mountains with dense trees, fog, and soft ambient moonlight, ${name}`;
    } else if (title.includes("서당") || title.includes("방") || descriptiveText.includes("마루")) {
      descEng = `traditional Joseon study room with low paper screen doors, small antique floor desk, inkstones, ${name}`;
    }
    
    return {
      name,
      description: `${desc}의 배경 무대 설정`,
      descriptionEnglish: descEng
    };
  });

  if (scenes.length === 0) {
    return null;
  }

  return {
    characters: Array.from(charactersMap.values()),
    locations,
    scenes
  };
}

startServer().catch((err) => {
  console.error("Failed to boot full-stack server:", err);
});
