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
    const { script, quantityOverride, quantityValue, storyFormat = "classic", lengthPreset = "standard" } = req.body;
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
3. Generate a modular sequence of storyboard scene blocks matching the timeline with dynamic scene pacing and LTX Video recommendations.

=== STORY FORMAT TEMPLATE MODE (${storyFormat.toUpperCase()}) ===
- Adapt the narrative progression according to the selected format mode:
  1. 'in_media_res' (충격 장면 선공개 / 반전 추리형):
     - Scenes 1~2: Show the shocking climax/result first ("도대체 조선 최고의 비극은 왜 일어났을까?").
     - Middle Scenes: Rewind to the past to trace hidden conspiracies step-by-step.
  2. 'multi_perspective' (사건 비교 / 평행 시점형):
     - Alternate between two perspectives (e.g. King's vision vs Court record, Official History vs Unofficial Folk Legend).
  3. 'omnibus_3part' (3단계 옴니버스 미스터리형):
     - Divide the timeline into 3 interconnected mini-episodes with high retention bridges.
  4. 'investigation' (질문 - 검증 - 결론 다큐형):
     - Start with a massive historical enigma -> Hypothesis 1, 2 verification -> Final historical truth.
  5. 'classic' (기본 기승전결형):
     - Traditional chronological flow.

=== DYNAMIC SCENE PACING & DURATION RULES ===
- Do NOT use rigid fixed 15-second durations for all scenes.
- Assign dynamic pacing & duration to each scene based on narrative tension:
  * Fast Pacing ('fast', 3~6 seconds): Crisis, sudden shock, action beat, quick clue drop, dramatic cut. Narration: 20~40 Korean characters.
  * Normal Pacing ('normal', 8~12 seconds): Standard dialogue, character psychology, story progression (AVERAGE 9~14s cadence). Narration: 50~75 Korean characters.
  * Slow Pacing ('slow', 15~18 seconds): Majestic landscape establishing, deep emotional linger, ancient document/proof presentation. Narration: 80~110 Korean characters.

=== LTX VIDEO RECOMMENDATION ENGINE (CRITICAL 10~15% RATIO RULE) ===
- Recommend video animation (LTX Video / I2V) for EXACTLY 10% to 15% of the total scene count (e.g., 5 to 8 scenes in a 50-scene storyboard).
- STRICT CONDITION: Recommend LTX Video ONLY for scenes with duration <= 12 SECONDS ('fast' or 'normal' pacing). Never recommend LTX for scenes longer than 12 seconds because video generation latency is too long.
- Select scenes where motion creates maximum impact: dramatic face reactions (eyes widening, tears, shock), candle flicker in dark room, drawing a sword, wind blowing robes, falling rain, door opening.
- For recommended scenes, set 'ltxRecommended': true, provide a concise Korean reason in 'ltxReason', and an English motion prompt in 'ltxPrompt'.

=== ARCHITECTURAL GUIDELINES ===
- Character Sheets: Create clean portrait prompts for characters.
- Multi-Era Historical Adaptability (Joseon, Goryeo, or Three Kingdoms - Silla/Goguryeo/Baekje).
- English Compatibility: Extract 'appearanceEnglish', 'clothingEnglish', 'descriptionEnglish'.
- Style-Agnostic Prompting: Write refinedImagePrompt safely for 2D illustration or Stop-Motion Claymation.
- YouTube safety compliance: No explicit gory blood or gruesome violence. Translate into atmospheric visual metaphors.

=== CAMERA ANGLE & COMPOSITION DIVERSIFICATION ===
- Diversify framing: Extreme Close-Up, Close-Up, Medium, Low-Angle, Wide-Angle, Dutch Angle, Over-the-shoulder.
- Assign matching 'cameraMotion': 'dolly_in', 'dolly_out', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'orbit', 'slow_zoom'.

=== ENFORCED 2-SCENE OUTRO STRUCTURE ===
- Penultimate Scene (Scene N-1): Historical Evidence Verification (Samguk Sagi, Goryeosa, or Joseon Annals).
- Ultimate Scene (Scene N): Cinematic Lingering Closure & Channel Subscribe Call.
`;

    const responseSchema = {
      type: Type.OBJECT,
      description: "Structured analysis of a storyteller storyboard script.",
      properties: {
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              gender: { type: Type.STRING },
              age: { type: Type.STRING },
              appearance: { type: Type.STRING },
              clothing: { type: Type.STRING },
              traits: { type: Type.STRING },
              characterSheetPrompt: { type: Type.STRING },
              appearanceEnglish: { type: Type.STRING },
              clothingEnglish: { type: Type.STRING }
            },
            required: ["name", "gender", "age", "appearance", "clothing", "traits", "characterSheetPrompt", "appearanceEnglish", "clothingEnglish"]
          }
        },
        locations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              descriptionEnglish: { type: Type.STRING }
            },
            required: ["name", "description", "descriptionEnglish"]
          }
        },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              stage: { type: Type.STRING, enum: ["early", "middle", "late", "final"] },
              locationName: { type: Type.STRING },
              characterNames: { type: Type.ARRAY, items: { type: Type.STRING } },
              narrationText: { type: Type.STRING },
              visualDescription: { type: Type.STRING },
              refinedImagePrompt: { type: Type.STRING },
              cameraMotion: {
                type: Type.STRING,
                enum: ["none", "dolly_in", "dolly_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "orbit", "slow_zoom"]
              },
              durationSeconds: { type: Type.INTEGER, description: "Dynamic duration in seconds (3 to 18)." },
              pacingType: { type: Type.STRING, enum: ["fast", "normal", "slow"] },
              ltxRecommended: { type: Type.BOOLEAN, description: "True if recommended for LTX video transformation (must be <=12s duration, total 10-15%)." },
              ltxReason: { type: Type.STRING, description: "Reason for recommending LTX video (in Korean)." },
              ltxPrompt: { type: Type.STRING, description: "English prompt for image-to-video motion generation." }
            },
            required: ["id", "stage", "locationName", "characterNames", "narrationText", "visualDescription", "refinedImagePrompt", "cameraMotion", "durationSeconds", "pacingType"]
          }
        }
      },
      required: ["characters", "locations", "scenes"]
    };

    const userPrompt = `
Analyze the script text and output structured storyboard JSON.

--- SCRIPT TEXT ---
${script}

--- PARAMETERS ---
Story Format: ${storyFormat}
Length Preset: ${lengthPreset}
Quantity Override: ${quantityOverride ? "ACTIVE" : "INACTIVE"}
Target Scene Count: ${quantityOverride ? quantityValue : "Natural Beats according to length preset"}
`;

    const response = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.25,
        },
      }),
      3,
      2000
    );

    const parsedJson = JSON.parse(response.text?.trim() || "{}");

    // Post-process durationSeconds, LTX ratios (enforce <=12s & 10-15% ratio), and SRT timecodes
    if (parsedJson.scenes && Array.isArray(parsedJson.scenes)) {
      const totalScenes = parsedJson.scenes.length;
      let cumulativeSec = 0;

      // Target LTX recommendations count: 10% ~ 15% of totalScenes (at least 1 if scenes >= 5)
      const targetLtxCount = Math.max(1, Math.round(totalScenes * 0.12));
      let currentLtxCount = 0;

      // First pass: sanitize duration and LTX flags
      parsedJson.scenes = parsedJson.scenes.map((sc: any, idx: number) => {
        const sceneNum = sc.id || (idx + 1);
        let duration = sc.durationSeconds || 11;

        // Ensure duration bounds
        if (sc.pacingType === "fast") {
          duration = Math.min(6, Math.max(3, duration));
        } else if (sc.pacingType === "slow") {
          duration = Math.min(18, Math.max(14, duration));
        } else {
          duration = Math.min(13, Math.max(8, duration));
        }

        // LTX Video strictly requires duration <= 12s
        let ltxRec = !!sc.ltxRecommended;
        if (duration > 12) {
          ltxRec = false;
        }

        if (ltxRec) {
          currentLtxCount++;
        }

        return {
          ...sc,
          id: sceneNum,
          durationSeconds: duration,
          ltxRecommended: ltxRec,
        };
      });

      // Second pass: Adjust LTX count to strictly meet 10% ~ 15% if AI recommended too few or too many
      if (currentLtxCount < targetLtxCount) {
        for (let i = 0; i < parsedJson.scenes.length && currentLtxCount < targetLtxCount; i++) {
          const sc = parsedJson.scenes[i];
          if (!sc.ltxRecommended && sc.durationSeconds <= 12) {
            sc.ltxRecommended = true;
            sc.ltxReason = "12초 이하 짧은 호흡의 주요 인물 반응 및 움직임 강조 장면";
            sc.ltxPrompt = `cinematic image-to-video motion, subtle dynamic camera movement, ${sc.visualDescription || "character reacting with intense emotion"}`;
            currentLtxCount++;
          }
        }
      } else if (currentLtxCount > Math.ceil(totalScenes * 0.15)) {
        const maxAllowed = Math.ceil(totalScenes * 0.15);
        let excess = currentLtxCount - maxAllowed;
        for (let i = parsedJson.scenes.length - 1; i >= 0 && excess > 0; i--) {
          if (parsedJson.scenes[i].ltxRecommended) {
            parsedJson.scenes[i].ltxRecommended = false;
            excess--;
          }
        }
      }

      // Calculate timecodes
      parsedJson.scenes = parsedJson.scenes.map((sc: any) => {
        const startSec = cumulativeSec;
        const endSec = startSec + sc.durationSeconds;
        cumulativeSec = endSec;

        const pad = (n: number, z = 2) => String(n).padStart(z, '0');
        const formatSRT = (sec: number) => {
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = Math.floor(sec % 60);
          const ms = Math.floor((sec % 1) * 1000);
          return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
        };

        return {
          ...sc,
          startTimecode: formatSRT(startSec),
          endTimecode: formatSRT(endSec),
        };
      });

      parsedJson.estimatedTotalDurationMinutes = Math.round((cumulativeSec / 60) * 10) / 10;
      parsedJson.storyFormat = storyFormat;
      parsedJson.lengthPreset = lengthPreset;
    }

    res.json(parsedJson);

  } catch (error: any) {
    console.error("Error during script analysis:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during analysis." });
  }
});

/**
 * Endpoint for AI Script Generation based on Topic, Story Format & Length Preset
 */
app.post("/api/generate-script", async (req, res): Promise<void> => {
  try {
    const { topic, storyFormat = "classic", lengthPreset = "standard", targetSceneCount } = req.body;
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      res.status(400).json({ error: "Topic / Keyword is required for script generation." });
      return;
    }

    const ai = getGenAI(req);

    let targetDurationText = "9분 ~ 13분 (약 40~50 장면)";
    if (lengthPreset === "shorts") targetDurationText = "쇼츠 (최대 2분, 약 10 장면)";
    else if (lengthPreset === "deep_dive") targetDurationText = "14분 ~ 18분 대작 (약 60~75 장면)";
    else if (lengthPreset === "auto_flow") targetDurationText = "9분 ~ 18분 AI 자율 가변 (40~75 장면)";
    else if (lengthPreset === "custom" && targetSceneCount) targetDurationText = `사용자 지정 ${targetSceneCount}장면`;

    const formatInstructions: Record<string, string> = {
      in_media_res: "영상의 맨 처음(1~2장면)에 가장 충격적인 결말이나 반전 사건 현장을 먼저 보여준 후, '도대체 조선 왕실에 무슨 일이 벌어진 것일까?'라며 과거로 돌아가 숨겨진 음모를 역추적하는 [충격 장면 선공개/반전 추리형] 서사 구조로 작성하세요.",
      multi_perspective: "한 사건을 두 인물(예: 왕의 시선 vs 사관/피해자의 시선, 또는 실록의 공식 기록 vs 야사의 감춰진 기록)의 시점으로 교차 전환하며 긴장감을 유도하는 [사건 비교/평행 시점형] 서사 구조로 작성하세요.",
      omnibus_3part: "주제와 연관된 3가지 연쇄 에피소드(예: '조선 왕실 미제 사건 TOP 3')를 연속 배치하여 한 에피소드가 끝날 때마다 새로운 기이한 사건으로 시청 지속 시간을 극대화하는 [3단계 옴니버스 미스터리형] 서사 구조로 작성하세요.",
      investigation: "'왜 역사가는 이 기록을 지웠을까?'라는 하나의 거대한 의문으로 시작하여 가설 1, 2를 검증하고 최종 역사적 진실에 도달하는 [질문-검증-결론 다큐 추리형] 서사 구조로 작성하세요.",
      classic: "도입부 사건 발생 -> 본론 갈등 증폭 -> 기이한 진실 규명 -> 역사적 여운의 [전통적 기승전결형] 서사 구조로 작성하세요."
    };

    const systemInstruction = `
You are a master Korean historical storyteller (야담/사극 전문 대본 작가) for high-retention YouTube channels.
Write a rich, dramatic, highly engaging historical script in Korean based on the provided topic.

=== SCRIPT FORMAT REQUIREMENTS ===
1. Structure the script using standardized scene blocks:
   [S1.] [장소이름 / 캐릭터ID] "나래이션 텍스트" (연출 지시어)
   [IMAGE GENERATION PROMPT]: English descriptive visual prompt
2. Apply the requested Story Format:
   ${formatInstructions[storyFormat] || formatInstructions.classic}
3. Target Duration: ${targetDurationText}.
4. Tone: Dignified, immersive Korean historical storytelling tone (품격 있는 조선/고려/삼국시대 야담체).
5. Ensure zero anachronism and high YouTube policy compliance (no gore, safe metaphors for tragedy).
6. End with historical evidence verification (실록/야사 기록 언급) and a channel subscribe call.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `주제/키워드: "${topic}"\n서사 포맷: ${storyFormat}\n목표 길이: ${lengthPreset}\n위 조건에 맞는 최고 품질의 야담 유튜브 대본 원고를 완성해서 작성해 주세요.`,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const generatedScript = response.text || "";
    res.json({ script: generatedScript });

  } catch (error: any) {
    console.error("Error generating script:", error);
    res.status(500).json({ error: error.message || "Failed to generate script." });
  }
});

/**
 * Endpoint for AI Recommendation of Story Format and Length Preset based on Topic
 */
app.post("/api/recommend-story-preset", async (req, res): Promise<void> => {
  try {
    const { topic } = req.body;
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      res.status(400).json({ error: "Topic is required for recommendation." });
      return;
    }

    const ai = getGenAI(req);

    const systemInstruction = `
You are an expert YouTube Historical Content Strategy Director specializing in Korean historical mysteries, royal court conspiracies, and folklore.
Analyze the user's provided topic/keyword and recommend the optimal Story Format (recommendedFormat) and Video Length Preset (recommendedLength).

AVAILABLE STORY FORMATS (recommendedFormat):
1. 'in_media_res': [충격 장면 선공개 / 반전 추리형] - Recommended for shocking historical deaths, sudden treason, tragic betrayals, or mysterious sudden accidents where showing the climax first creates extreme curiosity.
2. 'multi_perspective': [사건 비교 / 평행 시점형] - Recommended for controversial historical events with conflicting records (e.g. King vs Subject, Joseon Annals vs Unofficial Folk Legend, Official vs Secret Diary).
3. 'omnibus_3part': [3단계 옴니버스 미스터리형] - Recommended for listicles or multi-case topics (e.g. 'Top 3 weirdest court cases', '3 strange hauntings').
4. 'investigation': [질문 - 검증 - 결론 다큐형] - Recommended for deep historical enigmas, lost treasures, missing records, medical mystery autopsies, or historical hypothesis testing.
5. 'classic': [기본 기승전결형] - Recommended for standard chronological narrative or life biographies.

AVAILABLE LENGTH PRESETS (recommendedLength):
1. 'shorts': [쇼츠 모드 (~2분)] - Recommended for simple quick impact stories or single brief anecdote.
2. 'standard': [표준 롱폼 (9~13분)] - Recommended for general single historical case or standard story.
3. 'deep_dive': [대작/심층 탐구 (14~18분)] - Recommended for complex political conspiracies, multi-generational royal court struggles, or massive historical events.
4. 'auto_flow': [AI 자율 가변 모드 (9~18분)] - Recommended when narrative depth varies dynamically.

Output strictly in JSON matching the schema with concise Korean reasoning.
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        recommendedFormat: {
          type: Type.STRING,
          enum: ["classic", "in_media_res", "multi_perspective", "omnibus_3part", "investigation"]
        },
        recommendedLength: {
          type: Type.STRING,
          enum: ["shorts", "standard", "deep_dive", "auto_flow"]
        },
        recommendationReason: {
          type: Type.STRING,
          description: "Clear, professional, concise Korean explanation of why this format and length fits the topic best."
        }
      },
      required: ["recommendedFormat", "recommendedLength", "recommendationReason"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `주제/키워드: "${topic}"\n이 주제에 가장 적합한 서사 포맷과 목표 영상 길이를 분석하여 추천해 주세요.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);

  } catch (error: any) {
    console.error("Error recommending preset:", error);
    res.status(500).json({ error: error.message || "Failed to recommend preset." });
  }
});

/**
 * Helper to wrap image prompts with art style modifiers
 */
function injectArtStyle(prompt: string, style: "realistic" | "3d" | "anime" | "yadam" | "claymation"): string {
  const cleanPrompt = prompt.trim().replace(/[\.+]$/, ""); // remove trailing dot
  // Strict negative visual directives to prevent subtitles, text overlays, watermarks, or literal Korean typography/names from cluttering the canvas
  const negativeDirectives = ", absolutely no text overlay, no watermarks, no logos, no subtitles, no captions, no hangul characters, no written letters, no lettering, no written Korean names on image, clean pure visual painting only";
  
  switch (style) {
    case "claymation":
      return `${cleanPrompt}, premium stop-motion claymation style, hand-crafted plasticine clay puppet figures with highly detailed clothing and expressive faces, realistic clay model textures with subtle soft fingerprints and delicate craft lines, masterfully constructed miniature Joseon Dynasty historical sets made of colored clay, wood, and textured papercraft, high-contrast dramatic studio cinematic lighting with deep shadows, volumetric atmospheric fog, cinema-grade grading, sophisticated mature stop-motion aesthetic, shallow depth of field, professional clay artist studio craftsmanship, same cohesive art style throughout entire story, consistent character shapes${negativeDirectives}`;
    case "yadam":
      return `${cleanPrompt}, premium Korean historical webtoon illustration style, high-contrast emotional Joseon dynasty storytelling manhwa, traditional folklore mystery atmosphere, detailed traditional Hanbok textures, clean line art with soft cinematic shading, warm lighting, same art style throughout entire story, consistent character appearance, consistent clothing, animation-friendly layout, high-CTR visual appeal${negativeDirectives}`;
    case "realistic":
      return `${cleanPrompt}, premium Joseon historical drama movie style, high-budget cinematic film still, raw hyper-realistic texture, 35mm lens cinematography, deep chiaroscuro lighting, dramatic shadows, volumetric fog, historical accuracy, highly detailed emotional faces, subtle atmospheric grain, masterpiece storytelling${negativeDirectives}`;
    case "3d":
      return `${cleanPrompt}, stylized 3D animation character render, octane render style, soft ambient shadows, Pixar character aesthetic, historical Joseon dynasty detail, cute and clean 3D look${negativeDirectives}`;
    case "anime":
      return `${cleanPrompt}, gorgeous anime layout style, warm Studio Ghibli retro painting aesthetic, hand-drawn background, traditional watercolor, soft ambient line art, nostalgia lighting${negativeDirectives}`;
    default:
      return cleanPrompt + negativeDirectives;
  }
}

/**
 * Helper to dynamically translate any Korean characters in a prompt to clean English before sending to the Imagen model.
 */
async function translateKoreanToEnglishIfNeeded(prompt: string, ai: any): Promise<string> {
  const trimmed = (prompt || "").trim();
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(trimmed)) {
    try {
      console.log(`[PROMPT TRANSLATION] Korean characters detected. Translating prompt to English: "${trimmed}"`);
      const transResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert translation engine for AI image generators (like Imagen 3).
Translate the following mixed Korean and English prompt into a clean, beautiful, descriptive English-only image prompt.
Keep all character traits, historic structures, clothing, postures, moods, and camera angles intact but fully expressed in English.
IMPORTANT: Do NOT include any Korean letters (Hangul/한글) in the translated version.
IMPORTANT: Avoid adding instructions to render text or subtitles.
Translate "사도세자" to "Crown Prince Sado", "영조" to "King Yeongjo", "정조" to "King Jeongjo".

Input Prompt: ${trimmed}

Output ONLY the translated English prompt itself:`,
        config: {
          temperature: 0.1,
        }
      });
      const translated = transResponse.text?.trim() || trimmed;
      // Safeguard: Strip any remaining Hangul text just in case the translator yielded raw letters
      const englishOnly = translated.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]+/g, " ").replace(/\s+/g, " ").trim();
      console.log(`[PROMPT TRANSLATION] Success: "${englishOnly}"`);
      return englishOnly;
    } catch (err) {
      console.error("[PROMPT TRANSLATION] Failed to translate dynamically:", err);
      // Fallback: Strip any Korean characters so we do not pass hangul text to the image engine
      return trimmed.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return trimmed;
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
 * Unified Translator & Prompt Optimizing Assistant
 */
app.post("/api/translate-prompt", async (req, res): Promise<void> => {
  try {
    const { text, type, charactersInvolved, locationDesc } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Text to translate is required." });
      return;
    }

    const ai = getGenAI(req);

    let systemInstruction = "";
    if (type === "character") {
      systemInstruction = `
You are a translation assistant specializing in image generation prompt engineering for portraits.
Translate the Korean portrayal details of a character into a clean, compact English visual prompt.
Focus strictly on physical traits, clothing style, color, gender, age, and a clean flat background. No metadata, no explanations.
Maximum 40 words.
`;
    } else {
      const formattedChars = Array.isArray(charactersInvolved)
        ? charactersInvolved.map((c: any) => {
            if (typeof c === "string") return c;
            const details = [
              c.gender ? `Gender: ${c.gender}` : "",
              c.age ? `Age_Range: ${c.age}` : "",
              c.appearance ? `Korean_Look: ${c.appearance}` : "",
              c.appearanceEnglish ? `Physical/Hair/Beard: ${c.appearanceEnglish}` : "",
              c.clothing ? `Korean_Attire: ${c.clothing}` : "",
              c.clothingEnglish ? `Attire_Detail: ${c.clothingEnglish}` : "",
            ].filter(Boolean).join(", ");
            return `- Character [${c.name}]: ${details}`;
          }).join("\n")
        : "None";

      systemInstruction = `
You are a translation assistant specializing in image generation prompt engineering.
Translate the Korean storytelling narration and stage directions of a traditional Korean historical scene (such as Joseon, Goryeo, or the Three Kingdoms period - Goguryeo, Baekje, Silla) into a beautiful, evocative English image prompt.

CRITICAL TASK: For the involved characters listed below, you MUST strictly inject and preserve their specific physical traits (such as face details, beard length/grooming, hairstyle, headwear) and clothing style/colors in the active scene. This is essential to enforce absolute storyboard character consistency across different images!
Character Profiles to Enforce:
${formattedChars}

DYNAMIC EXCEPTION RULE: If the Korean narration or stage directions (the input text) explicitly describes temporary state changes, dramatic overrides, or historical age variations (such as childhood/youth memories, severe illness, being gaunt or pale, injuries, undercover disguises, or different garments), you must PRIORITIZE these contextual indicators! Keep the facial structure but adapt details logically:
- DO NOT apply beards, mature wrinkles, or adult accessories if a character is depicted back in childhood/past memories.
- KOREAN CHILDHOOD HAIRSTYLE RULE: When rendering a character in childhood/youth (such as a young prince/king/noble, youth memory), **NEVER** write or generate shaved, bald, or closely cropped hair (as they are not Buddhist monks). Instead, specify traditional Korean child/youth hairstyles like neatly braided ribbon hair ("daenggi-meori braided ponytail", "long braided hair with a crimson ribbon") or classic traditional Korean kids' hair.
- DO NOT render them looking muscular or healthy if the narration describes them as starving, severely wounded, or sick (render pale skin, gaunt cheeks, etc. instead).
- YOUTUBE COMPLIANCE & SAFETY RULE: If there is explicit blood, violence, or gore in the text, DO NOT describe graphic physical wounds or raw red blood splatter directly (this risks safety censorship and YouTube guidelines violations). Instead, render the violence artfully and metaphorically: use cues like "dramatic dark crimson lightning/mist", "fallen crimson petals scattered on the wet dark floor", "ominous shadow of a blade on a paper shoji screen door", "shattered porcelain cups on the ground with dark spill", or "an intense facial expression of physical shock/pain in deep shadows". Use cinematic, poetic expression to convey the tragedy.
- Synthesize the base profile with the temporary dramatic states flawlessly.

- KEY HISTORICAL OBJECTS & ARTIFACTS STABILITY RULE: If the Korean narration or stage directions refers to a narrative-crucial historical Korean artifact or iconic object, you MUST use a highly standardized, precise English visual archetype to preserve flawless object stability across images:
  * "뒤주" (Rice Chest/Duiju) -> Translate as "a heavy, raw rectangular weathered traditional Korean dark-wood grain rice chest ('Duiju'), bound with thick flat black iron bands and a massive vintage dynamic padlock".
  * "자격루" (Water Clock/Jagyeokru) -> Translate as "a grand traditional mechanical water clock ('Jagyeokru') with hierarchical tiered bronze vessels feeding dark flowing water through detailed pipes into a main vertical metallic cylinder".
  * "혼천의" (Celestial Globe/Honcheonui) -> Translate as "a beautiful, complex orbital bronze astronomical model ('Honcheonui') with rotating concentric metallic rings, dense brass celestial gearings, and star map engravings".
  * "칼" (Cangue/Wooden Collar for prisoners) -> Translate as "a wide, split rectangular heavy raw-grain wooden stock collar ('Cangue') with splinters, clamped securely locked around the prisoner's neck".
  * "거북선" / "귀선" (Turtle Ship) -> Translate as "a terrifying armored Turtle Ship ('Geobukseon') with a dark scale-plated iron roof covered in sharp spikes, a smoke-breathing dragon-head bow, and wooden oars dipping into sea".
  * "신기전" (Rocket Launcher Cart) -> Translate as "a wooden traditional multiple rocket launcher box ('Singijeon') holding dozens of black-powder tipped fire arrows mounted on a rugged vintage war-wagon".
  * "마패" (Secret Inspector Seal) -> Translate as "a heavy circular bronze horse medallion inspector seal ('Mapae') with distinct deeply-engraved horse illustrations dangling on a coarse crimson silk tassels".
  * "용포" / "곤룡포" / "어의" (Dragon Robe/King's Robe) -> If Three Kingdoms period, translate as "a royal long silk robe featuring golden bird or wave border embroidery with a wide silk sash belt". If Goryeo, translate as "a royal Goryeo-style round-collared silk robe with delicate gold-embroidered roundels on the shoulders and chest". If Joseon, translate as "a royal crimson-silk dragon robe ('Gonryongpo') featuring a meticulously hand-embroidered, gleaming fine-gold circular five-clawed dragon emblem on the center chest and shoulders".
  * "백제금동대향로" (Baekje Gilt-bronze Incense Burner) -> Translate as "the legendary Baekje gilt-bronze incense burner, a highly ornate crown-topped bronze vessel with intricate relief carvings of mountain peaks, musicians, animals, and a phoenix on top, emitting a thin wisp of incense smoke".
  * "고려청자" (Goryeo Celadon) -> Translate as "an elegant Goryeo-period jade-green glazed celadon vase ('Goryeo Cheongja') with hand-carved flying crane and cloud patterns, boasting a smooth lustrous finish".
  * "환두대도" (Ring-pommel Sword of Three Kingdoms) -> Translate as "a traditional ancient Korean ring-pommel iron sword ('Hwandudaedo'), featuring a circular decorative gold pommel ring with a dragon engraving and a polished dark wood sheath with brass fittings".

Integrated Location Profile: ${locationDesc || "None"}

- CLAYMATION & 2D COMPATIBILITY RULES:
  1. Facial Expressions: Avoid microscopic facial details (e.g., "fine wrinkles on temple", "twitching cheek muscle"). Use bold, hand-molded expressive facial cues (e.g., "wide eyes of terror", "deep downward-curved mouth of intense grief", "raised surprised eyebrow", "beads of sweat on forehead").
  2. Attire: Avoid hyper-intricate embroidery or ultra-detailed continuous floral silk weaves on hanbok garments, as these distort in clay Stop-Motion. Instead, specify solid-colored fabrics, bold solid silk borders, and clean layered folds with distinct silhouettes (e.g., "solid royal crimson robe with simple bold gold borders").
  3. Text: Never describe tiny readable characters or small written letters on scrolls/screens. Use clean, bold symbolic items (e.g., "an open scroll with bold dark calligraphic brushstrokes", "a simple wooden tablet with a carved seal").
  4. Motion & Physics: Avoid hyper-fluid complex multi-body physics interactions (e.g., "dozens of small arrows flying in all directions simultaneously through a dense forest"). Claymation stop-motion requires distinct, deliberate poses. Simplify action beats to a single focused, dramatic, frozen posture or concrete outcome (e.g., "a single arrow stuck on a thick wooden tree trunk", "a character in an active low sword-stance frozen in motion").
  5. Violence / Distress: Never use gory open wounds. Represent distress or danger through symbolic metaphors (e.g., "dark crimson atmospheric lighting casting long shadows", "broken porcelain jar on a dark floor").

Ensure no text overlay or modern elements. Focus strictly on Joseon-era historical accuracy, composition, color grading, lighting, facial expressions, and dynamic postures. Output ONLY the translated visual English rendering prompt.
Maximum 65 words.
`;
    }

    const modelResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate and structure this into a powerful visual prompt in English:\n${text}`,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const reply = modelResponse.text?.trim() || "";
    res.json({ prompt: reply });
  } catch (error: any) {
    console.error("Error in translate-prompt:", error);
    res.status(500).json({ error: error.message || "Failed to translate and optimize prompt." });
  }
});

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
    
    // Auto-translate any accidental Korean words/names to English to avoid text overlays
    const translatedPrompt = await translateKoreanToEnglishIfNeeded(prompt, ai);

    // STRICT PORTRAIT MODIFIERS to avoid multiple people appearing in the frame
    const basePortraitModifiers = "Only ONE person, isolated portrait, single character, no secondary character, no group, no background people, strictly single shot, solo view, plain flat background";
    
    // Stitch modifiers together
    const finalPrompt = injectArtStyle(`${translatedPrompt}, ${basePortraitModifiers}`, artStyle || "claymation");
    const activeModel = modelName || "gemini-3.1-flash-image";

    console.log(`Generating character sheet. Model: ${activeModel}, Prompt: "${finalPrompt}"`);

    const targetRatio = aspectRatio || "1:1";
    let resolvedImageSize: string | undefined = undefined;
    if (activeModel === "gemini-3.1-flash-image") {
      resolvedImageSize = "1K";
    }

    const imageResponse = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: activeModel,
        contents: {
          parts: [{ text: finalPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: targetRatio,
            imageSize: resolvedImageSize,
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
    
    // Auto-translate any accidental Korean words/names to English to avoid text overlays
    const translatedPrompt = await translateKoreanToEnglishIfNeeded(prompt, ai);
    
    let basePrompt = translatedPrompt;
    if (isWanIntro) {
      basePrompt = `${translatedPrompt}, high-integrity WAN dynamic motion starter frame, capturing the precise tense instant immediately before physical action begins, high energy potential, action-ready pose, crisp clear hair and cloth boundaries, perfect reference starting pose for image-to-video animation generators`;
    }
    
    const finalPrompt = injectArtStyle(basePrompt, artStyle || "claymation");
    const activeModel = modelName || "gemini-3.1-flash-image";

    console.log(`Generating scene image. Model: ${activeModel}, WAN-Intro: ${!!isWanIntro}, Prompt: "${finalPrompt}"`);

    const targetRatio = aspectRatio || "16:9";
    let resolvedImageSize: string | undefined = undefined;
    if (activeModel === "gemini-3.1-flash-image") {
      resolvedImageSize = "1K";
    }

    const imageResponse = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: activeModel,
        contents: {
          parts: [{ text: finalPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: targetRatio,
            imageSize: resolvedImageSize,
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
    const { script, scenes, characters, locations, compositionStyleOverride, colorMoodOverride } = req.body;
    if (!script || !scenes || !Array.isArray(scenes) || scenes.length === 0) {
      res.status(400).json({ error: "Script text and storyboard scenes array are required." });
      return;
    }

    const ai = getGenAI(req);

    const systemInstruction = `
You are a legendary YouTube Thumbnail Director specializing in Korean historical story (사극) and folklore (야담) channels.
Your target is NOT just to design a technically pretty picture, but to create the absolute highest Click-Through Rate (CTR) thumbnail plan with extreme visual variety to prevent the channel from looking like standard mass-produced (양산형) content.

=== DYNAMIC MOOD & VIBE PRINCIPLES ===
- This is NOT a horror or ghost story (괴담) channel.
- Avoid treating extreme darkness or horror as a default prerequisite.
- The visual mood must be decided dynamically depending entirely on the content of the script:
  * For warm, everyday, or emotional folklore: Use bright, elegant, warm tones (sunset gold, amber, palace blue).
  * For political conspiracies or tension: Use high-contrast chiaroscuro, intense shadows, or sharp profiles.
  * For mysterious or suspenseful scripts: Use atmospheric fog, candlelights, or nocturnal shades.

=== STRICT POLICY & SAFETY BAN (CRITICAL FOR ADVERTISER-FRIENDLINESS) ===
- Absolutely NO blood, NO bleeding wounds, NO severed limbs, NO gory/violent stabbings, and NO gruesome/grotesque body parts.
- All high-intensity suspense or drama must be delivered cleanly through expressive facial reactions (shock, surprise, sorrow, intense focus), dramatic gestures, tense character gazes, or clean silhouettes.
- Weapons like swords or arrows may be held or pointed to indicate threat or climax, but they must NEVER pierce flesh, draw blood, or look excessively violent.
- Keep the prompts entirely compliant with strict advertiser-friendly guidelines (preventing demonetization or yellow-card status).

=== ROLE & OBJECTIVES ===
1. Analyze the script text, characters, and scenes chronological storyboard to decide on ONE absolute best dramatic scene for the thumbnail.
2. Select the climax beat based on these priority standards:
   ① 가장 충격적인 진실 (The most shocking truth or revelation)
   ② 가장 큰 반전 (The greatest twist)
   ③ 가장 강렬한 감정 (The most intense facial emotion - extreme shock, boiling anger, crying despair)
   ④ 가장 극적인 대립 (The most intense dramatic conflict between two key figures)
   ⑤ 가장 궁금증을 유발하는 장면 (The scene inducing the highest suspense and mystery/curiosity)
3. Selection Constraints:
   - Do NOT pick the final scene just because it is the end.
   - Do NOT pick the most colorful/flamboyant scene if it lacks dramatic or emotional value.
   - Do NOT reveal/spoil the plot's ending or key answer.
   - Select a moment that immediately makes the viewer think: "What on earth is happening?" or "What is this hidden secret?".
   - Avoid low-intensity peaceful scenes unless they carry a deep emotional climax or hidden tension.

=== COMPOSITION & STYLE DIVERSIFICATION RULES (ANTI-REPETITION MANDATE) ===
To prevent thumbnails from looking identical (cookie-cutter style), you MUST dynamically choose ONE of the following 5 distinct composition styles and ONE dramatic color mood that perfectly fits the narrative context:

1. Distinct Composition Styles:
   - "Dynamic Action Climax": Focuses on high physical tension. A dramatic hand reaching from shadows, a sword pointed near a neck, a character falling backwards, or a silhouette escaping. No blood, clean action.
   - "Duo Confrontation Profile": Two main characters facing opposite directions in side-by-side intense profiles. High dramatic tension, deep psychological split screen, asymmetrical alignment.
   - "Atmospheric Mystery Wide-Shot": A solitary figure carrying a flickering lantern, walking into a huge, foggy temple, forest, or open village field. Emphasizes giant environments vs. a tiny vulnerable character.
   - "Extreme Dutch-Angle Close-Up": Tilted, off-balance camera angle. Focuses closely on a secretive, tense gesture (e.g., dropping medicine powder, gripping a sealed letter, wide-open eyes of surprise/fear reflecting a single candle flame). No gore.
   - "Symbolic Silhouette Metaphor": Highly artistic. A majestic shadow cast on a sliding paper door, or a royal hairpin dropped in the dirt with fallen cherry blossom petals, or a silhouette of a crown surrounded by morning mist.

2. Dramatic Color Moods (Pick one perfectly matching the emotional tone of the script):
   - "Vibrant Royal Gold & Imperial Blue": High status, palace dignity, elegant daytime, or grand resolution.
   - "Warm Sunset Amber & Clay": Warm everyday folklore, deep emotional sorrow, traveler nostalgia, or cozy village life.
   - "Ominous Emerald & Shadow Black": Deep forest mystery, secretive nighttime operations, or quiet suspense.
   - "Eerie Ghostly Pale & Moonlit Indigo": Grief, tragedy, heavy nocturnal atmosphere, or cold wind.
   - "Deep Crimson & Ivory": Dramatic passion, vital decree, strong righteous resolution (strictly clean, no blood).
   - "Cold Amber & Monochromatic Ash": Desolation, heavy burden, extreme loneliness, or pure mystery.

=== THUMBNAIL IMAGE COMPOSITION RULES ===
1. Visual Contrast:
   - Make the characters and elements highly recognizable even at small scales on mobile.
   - Simple Background: Keep the background extremely simple, blurred, or atmospheric so the viewer's eyes instantly lock onto the main dramatic focus.
   - Cinematic Lighting: High-contrast chiaroscuro, dramatic rim lighting, or rich sunlight beams.
2. Graphic Restrictions (STRICT BANS):
   - Absolutely NO text, NO overlay letters, NO watermarks, NO logos, NO dialogue bubbles.
   - Absolutely NO modern products, NO modern weapons, NO cars, NO modern clothes, NO sci-fi elements.
   - No blurriness or low resolution. Faces/hands must be perfectly rendered.
3. Character Consistency:
   - You MUST utilize exactly the same character descriptions from the Character DB to ensure visual consistency.
   - Incorporate the English attributes if present (e.g. appearanceEnglish, clothingEnglish) of the characters chosen.

=== CLAYMATION & 2D COMPATIBILITY RULES ===
1. Facial Expressions: Avoid microscopic facial details (e.g., "fine wrinkles on temple", "twitching cheek muscle"). Use bold, hand-molded expressive facial cues (e.g., "wide eyes of terror", "deep downward-curved mouth of intense grief", "raised surprised eyebrow", "beads of sweat on forehead").
2. Attire: Avoid hyper-intricate embroidery or ultra-detailed continuous floral silk weaves on hanbok garments, as these distort in clay Stop-Motion. Instead, specify solid-colored fabrics, bold solid silk borders, and clean layered folds with distinct silhouettes (e.g., "solid royal crimson robe with simple bold gold borders").
3. Text: Never describe tiny readable characters or small written letters on scrolls/screens. Use clean, bold symbolic items (e.g., "an open scroll with bold dark calligraphic brushstrokes", "a simple wooden tablet with a carved seal").
4. Motion & Physics: Avoid hyper-fluid complex multi-body physics interactions (e.g., "dozens of small arrows flying in all directions simultaneously through a dense forest"). Claymation stop-motion requires distinct, deliberate poses. Simplify action beats to a single focused, dramatic, frozen posture or concrete outcome (e.g., "a single arrow stuck on a thick wooden tree trunk", "a character in an active low sword-stance frozen in motion").
5. Violence / Distress: Never use gory open wounds. Represent distress or danger through symbolic metaphors (e.g., "dark crimson atmospheric lighting casting long shadows", "broken porcelain jar on a dark floor").

=== KOREAN CAPTION HOOKS (THUMBNAIL TEXT) ===
Propose exactly 5 highly compelling Korean clickbait phrases for the thumbnail text, plus select the single best one:
- Content: Short, intense, curiosity-inducing phrases (2~5 words, maximum 12 characters).
- Style: Focus on shocks, twists, secrets, royal conspiracies, or high curiosity.
- Banned: No explanatory titles, no spoilers, no copying of the video's original title.
- Examples: '왕도 속았다', '숨겨진 진실', '범인은 따로 있었다', '왕이 감춘 비밀', '모두가 거짓이었다', '죽은 줄 알았다', '절대 들켜선 안 됐다', '그날 밤의 진실'.
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        chosenSceneId: { type: Type.INTEGER, description: "The sequential ID of the selected storyboard scene (from 1 to N)." },
        sceneTitle: { type: Type.STRING, description: "Brief Korean title or label of the chosen scene." },
        selectionReason: { type: Type.STRING, description: "2 to 3 lines in Korean explaining why this specific scene was selected as the sovereign high-CTR thumbnail climax according to the rules." },
        compositionStyle: { type: Type.STRING, description: "The chosen distinct composition style: Dynamic Action Climax, Duo Confrontation Profile, Atmospheric Mystery Wide-Shot, Extreme Dutch-Angle Close-Up, or Symbolic Silhouette Metaphor." },
        colorMood: { type: Type.STRING, description: "The chosen dramatic color mood, e.g. Vibrant Royal Gold & Imperial Blue, Warm Sunset Amber & Clay, Ominous Emerald & Shadow Black, Eerie Ghostly Pale & Moonlit Indigo, Deep Crimson & Ivory, or Cold Amber & Monochromatic Ash." },
        visualPrompt: { type: Type.STRING, description: "Evocative, precise English image generation prompt designed for Imagen 3. You MUST heavily integrate the selected compositionStyle, the selected colorMood, the physical/attire attributes of the characters involved, high-contrast lighting, and a blurred or simplified background. Ensure there is NO blood, NO gore, and NO violence in the description." },
        textCandidates: {
          type: Type.ARRAY,
          description: "Exactly 5 short, dramatic Korean clickbait text candidates (2~5 words, maximum 12 characters each, suspense-focused).",
          items: { type: Type.STRING }
        },
        recommendedText: { type: Type.STRING, description: "The single best caption recommended for generating the highest possible CTR." },
        recommendationReason: { type: Type.STRING, description: "Detailed Korean explanation of the tactical marketing-strategic reason why this recommended text will hook viewers." }
      },
      required: ["chosenSceneId", "sceneTitle", "selectionReason", "compositionStyle", "colorMood", "visualPrompt", "textCandidates", "recommendedText", "recommendationReason"]
    };

    let userPromptOverride = "";
    if (compositionStyleOverride) {
      userPromptOverride += `\nCRITICAL OVERRIDE: You MUST use the composition style "${compositionStyleOverride}" for this thumbnail. Do not choose any other composition style. Make sure the visualPrompt heavily aligns with "${compositionStyleOverride}".`;
    }
    if (colorMoodOverride) {
      userPromptOverride += `\nCRITICAL OVERRIDE: You MUST use the dramatic color mood "${colorMoodOverride}" for this thumbnail. Do not choose any other color mood. Make sure the visualPrompt heavily aligns with "${colorMoodOverride}".`;
    }

    const userPrompt = `
Analyze the provided storyboard material and script to create the ultimate premium CTR YouTube thumbnail.
${userPromptOverride}

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
 * Endpoint for YouTube Monetization Policy Audit & Verification (June 2026 guidelines)
 */
app.post("/api/analyze-safety", async (req, res): Promise<void> => {
  try {
    const { script, thumbnailData } = req.body;
    if (!script || typeof script !== "string" || script.trim().length === 0) {
      res.status(400).json({ error: "Script text is required and cannot be empty for safety check." });
      return;
    }

    const ai = getGenAI(req);

    const systemInstruction = `
You are an expert YouTube Monetization Compliance Officer and Video Policy Auditor specializing in Far-East Asian markets, particularly the Korean partner program for historical storytelling (Yadam, 야담) and thriller channels.
Your target is to perform a rigorous, comprehensive policy risk assessment for a Yadam video script and metadata against June 2026 YouTube Policies (Reused Content, Repetitive Content, Advertiser-Friendly Guidelines regarding violence, murder, decapitation, and sexual scandals/sensual triggers).

=== POLICIES & COMPLIANCE SPECIFICATIONS ===
1. Reused Content Risk (재사용된 콘텐츠 위험):
   - Flag if the generator template or plot structure is too generic, or copied word-for-word from widely published public folklore resources.
   - Suggest detailed production advice (e.g., custom voice recording rather than standard mechanical TTS, adding original historical context, embedding educational commentary, unique dynamic zooms and transitions vs. static image slideshows).
2. Repetitive Content Risk (반복성 위험):
   - Assess if the visual/composition template shows zero variance. Give clear directions on varying camera angles, incorporating sound effects.
3. Sensual, Sensational or Scandalous Triggers (선정성 및 자극성 자극요소):
   - Korean Folk/Yadam stories often feature adultery, concubine affair drama, or intimate scenes (e.g., 동침 - sleeping together, 합방 - marital/bed union, 방사 - sexual act, 욕정 - worldly lust, 간통 - adultery, 기생 - courtesan/gisaeng element, 옷을 벗 - stripping garments).
   - Rate the risk of these terms. Advise rewriting them under safer, subtle literary expressions (e.g., "마음을 나누다", "깊은 밤 대화를 이어가다") to avoid automatic flagging.
4. Violent, Brutal, or Horrific Gore Depiction (잔혹성, 묘사, 폭력성 고증):
   - Yadam stories often deal with historical executions, ghosts, decapitations (e.g., 참수, 목을 벤다, 피범벅, 시체, 고문, 능지처참).
   - YouTube's Advertiser-Friendly policy as of June 2026 immediately flags these for yellow cards (노란딱지) or full demonetization if written literally.
   - Scan for these and recommend translating them into safe, high-contrast, atmospheric visual metaphors (e.g., "붉은 장막이 하늘을 물들였다", "사무치게 시린 빗소리", "부서진 목검").
5. Metadata & clickbait CTR text level (메타데이터 오도 위험):
   - Flag clickbait keywords in titles such as incest, explicit violence, or highly taboo topics ("친딸", "목을 잘라...", "합방의 진실") that cause instant monetization suspention.

=== RESPONSE FORMAT ===
Output a strictly valid, structured JSON object containing:
- overallScore: rating from 0 to 100 (where 100 is completely safe, 0 is full risk)
- overallRisk: 'SAFE' (score >= 80) | 'ATTENTION' (score 50-79) | 'CRITICAL' (score < 50)
- reusedRisk: 'LOW' | 'MEDIUM' | 'HIGH'
- reusedScore: rating from 0 to 100
- reusedFlags: array of strings naming specific reuse vectors in Korean (e.g., "사도세자/영조 대본의 대역 자구 변수 중복", "일반 자동 생성형 템플릿 비조정 노출")
- sensualRisk: 'LOW' | 'MEDIUM' | 'HIGH'
- sensualScore: rating from 0 to 100
- sensualFlags: array of strings identifying sensual/suggestive words or sections flagged
- violentRisk: 'LOW' | 'MEDIUM' | 'HIGH'
- violentScore: rating from 0 to 100
- violentFlags: array of strings of direct gore, execute, or decaptation keywords spotted
- metadataRisk: 'LOW' | 'MEDIUM' | 'HIGH'
- metadataScore: rating from 0 to 100
- metadataFlags: array of strings checking clickbait safety (e.g., thumbnail captions)
- recommendations: array of exactly 4 to 6 detailed, highly professional, actionable Korean advice on how to rewrite terms and how to produce/edit the final video to pass human review with 100% confidence.

Avoid any explanatory markdown outside the JSON.
`;

    const responseSchema = {
      type: Type.OBJECT,
      description: "Detailed YouTube monetization policy risk analysis report with Anti-AI Repetitive Content Detection.",
      properties: {
        overallScore: { type: Type.INTEGER },
        overallRisk: { type: Type.STRING, enum: ["SAFE", "ATTENTION", "CRITICAL"] },
        reusedRisk: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        reusedScore: { type: Type.INTEGER },
        reusedFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
        sensualRisk: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        sensualScore: { type: Type.INTEGER },
        sensualFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
        violentRisk: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        violentScore: { type: Type.INTEGER },
        violentFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
        metadataRisk: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
        metadataScore: { type: Type.INTEGER },
        metadataFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        antiPatternAnalysis: {
          type: Type.OBJECT,
          description: "Analysis on anti-repetitive AI pattern, pacing dynamics and monetization safety.",
          properties: {
            patternScore: { type: Type.INTEGER, description: "Anti-repetition originality score (0-100)." },
            formatVarietyGrade: { type: Type.STRING, description: "Narrative structure variety grade (e.g. 'A+', 'A', 'B', 'C')." },
            pacingVariationGrade: { type: Type.STRING, description: "Scene cadence pacing variation grade (e.g. 'A+', 'A', 'B', 'C')." },
            ltxUtilizationRatio: { type: Type.INTEGER, description: "Estimated percentage of LTX video dynamics (target 10-15%)." },
            riskFactors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific repetitive or AI-like pattern flags." },
            actionableAdvice: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable editing/writing advice to completely pass monetization review." }
          },
          required: ["patternScore", "formatVarietyGrade", "pacingVariationGrade", "ltxUtilizationRatio", "riskFactors", "actionableAdvice"]
        }
      },
      required: [
        "overallScore", "overallRisk", "reusedRisk", "reusedScore", "reusedFlags",
        "sensualRisk", "sensualScore", "sensualFlags", "violentRisk", "violentScore",
        "violentFlags", "metadataRisk", "metadataScore", "metadataFlags", "recommendations",
        "antiPatternAnalysis"
      ]
    };

    const userPrompt = `
Formulate a monetization guidelines compliance report:

--- ACTIVE SCRIPT TO INSPECT ---
${script}

--- CURRENT ACTIVE THUMBNAIL PLAN ---
${thumbnailData ? JSON.stringify(thumbnailData) : "None (No thumbnail metadata configured yet)"}
`;

    const modelResponse = await callGoogleGenWithRetry(
      () => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
        },
      }),
      3,
      2000
    );

    const text = modelResponse.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    res.json(parsed);

  } catch (error: any) {
    console.error("Error during safety audit:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during safety compliance check." });
  }
});

/**
 * Run setup for Vite environment or production files serving
 */
async function startServer() {
  // Support static loading of assets first if we need
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  // Serve the raw yadam helper HTML tools directly
  app.get("/yadam_tts_studio.html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "yadam_tts_studio.html"));
  });

  app.get("/yadam_generator.html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "yadam_generator.html"));
  });

  app.get("/davinci_automation_pro.html", (req, res) => {
    res.sendFile(path.join(process.cwd(), "davinci_automation_pro.html"));
  });

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
    cameraMotion?: "none" | "dolly_in" | "dolly_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "orbit" | "slow_zoom";
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

  // 1.5. 추가 캐릭터 자동 매칭 및 탐지 (대본 맨 위에 명세 정의 문단이 생략된 TTS 원고 입력 경우 대비)
  const defaultCharIds = ["Ch_A", "Ch_B", "Ch_C", "Ch_D", "Ch_E", "Ch_F", "Ch_G", "Ch_H"];
  defaultCharIds.forEach(charId => {
    // Ch_A_Old etc.도 Ch_A를 포함하므로, Ch_[A-H] 형태로 대본에 언급되어 있지만 맵에 정의되지 않은 경우 자동 사전 생성
    if (!charactersMap.has(charId) && (script.includes(charId) || script.includes(charId + "_"))) {
      let displayName = charId;
      if (charId === "Ch_A") displayName = "사도세자";
      else if (charId === "Ch_B") displayName = "영조";
      else if (charId === "Ch_C") displayName = "혜경궁 홍씨";
      else if (charId === "Ch_D") displayName = "영빈 이씨";
      else if (charId === "Ch_E") displayName = "나경언";
      else if (charId === "Ch_F") displayName = "노론 대감";
      else if (charId === "Ch_G") displayName = "홍봉한";
      else if (charId === "Ch_H") displayName = "정조";

      let gender = (charId === "Ch_C" || charId === "Ch_D") ? "여성" : "남성";
      
      let characterSheetPrompt = "";
      let appearanceEnglish = "";
      let clothingEnglish = "";
      
      if (charId === "Ch_B") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single elderly Joseon king, red royal dragon robe, ikseongwan royal crown, looking silent and stern, traditional grey long beard, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "stern, deeply wrinkled elderly Joseon king, traditional grey long beard";
        clothingEnglish = "majestic red royal dragon robe, black royal crown hat ikseongwan";
      } else if (charId === "Ch_A") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single young Joseon prince, disheveled royal blue robe, pale tragic face, no beard, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "tragic young Joseon crown prince, pale face, emotional eyes, no beard";
        clothingEnglish = "disheveled royal blue silk robe";
      } else if (charId === "Ch_C") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single young beautiful Joseon noblewoman, elegant complex traditional hair ornament with binyeo hairpin, green silk Hanbok dress, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "young beautiful Joseon princess, elegant complex traditional hair ornament";
        clothingEnglish = "gorgeous green silk Hanbok dress with gold patterns";
      } else if (charId === "Ch_D") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 60-year old Joseon royal concubine, elegant traditional hair ornament, green silk Hanbok, weep expression, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "wise 60-year-old Joseon court concubine, sorrowful expression";
        clothingEnglish = "traditional dark green royal hanbok";
      } else if (charId === "Ch_E") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 30-year old Joseon man, traditional hanbok and topknot hair, thin sparse mustache, looking anxious, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "anxious-looking 30-year-old Joseon man, neat topknot";
        clothingEnglish = "simple brownish Joseon plebeian hanbok";
      } else if (charId === "Ch_F") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 55-year old Joseon nobleman, dark administrative robe and samo hat, thick black-grey beard, look of subtle conspiracy, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "conspiratorial 55-year-old Korean minister, thick greyish beard";
        clothingEnglish = "dark green Joseon administrative uniform robe with samo hat";
      } else if (charId === "Ch_G") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 50-year old Joseon minister, dark administrative hat, long dark beard, complex calculating look, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "calculating 50-year-old Joseon politician minister, long dark beard";
        clothingEnglish = "traditional administrative navy silk robe with samo hat";
      } else if (charId === "Ch_H") {
        characterSheetPrompt = "masterpiece, best quality, year 2024, artistic rendering, rich texture, dramatic lighting, detailed character design, a single 25-year old Joseon king Jeongjo, majestic red dragon robe, ikseongwan crown, neat thin mustache beard, powerful direct gaze, clean studio light grey background, solo card portrait focus";
        appearanceEnglish = "young confident Joseon king with strong direct gaze, thin neat mustache beard";
        clothingEnglish = "red royal dragon robe with gold emblems, royal crown ikseongwan";
      }

      charactersMap.set(charId, {
        name: displayName,
        gender,
        age: "분석 자동 추정군",
        appearance: "대본 기반 식별 특징",
        clothing: charId === "Ch_B" || charId === "Ch_H" ? "붉은 곤룡포, 익선관" : (gender === "여성" ? "당의, 전통 한복" : "조선 도포, 상투"),
        traits: `${displayName}의 자동 임플리시트 생성 인자`,
        characterSheetPrompt,
        appearanceEnglish,
        clothingEnglish
      });
    }
  });

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
    // 양식 1: [S10.] [조선시대 궁여 앞마당, 밤 / Ch_A] "비바람이..." (빗물이...)
    // 양식 2 (정제형 TTS): [S10.] "비바람이..." (빗물이 Ch_A 얼굴을 적시는...)
    const headerRegex = /\[S\d+\.?\]\s*\[\s*([^/\]]+?)(?:\s*\/\s*([^\]]+))?\]\s*(?:\/)?\s*"([^"]+)"\s*(?:\(([^)]+)\))?/;
    let headMatch = blockText.match(headerRegex);
    
    let locationRaw = "미지정 야담 배경";
    let characterRaw = "인물 자동 분석";
    let narrationText = "";
    let visualDescription = "";

    if (headMatch) {
      locationRaw = headMatch[1].trim();
      characterRaw = headMatch[2] ? headMatch[2].trim() : "인물 없음";
      narrationText = headMatch[3].trim();
      visualDescription = headMatch[4] ? headMatch[4].trim() : "";
    } else {
      // 정제형 TTS 포맷 파싱 및 결합 시도 (S씬번호 다음에 장소 대괄호가 없고 바로 따옴표 내레이션 및 괄호 지시어가 깔렸을 시)
      const fallbackRegex = /\[S\d+\.?\]\s*(?:"([^"]+)"|([^"(\n]+))\s*(?:\(([^)]+)\))?/;
      const fallbackMatch = blockText.match(fallbackRegex);
      if (fallbackMatch) {
        narrationText = (fallbackMatch[1] || fallbackMatch[2] || "").trim();
        visualDescription = fallbackMatch[3] ? fallbackMatch[3].trim() : "";
        locationRaw = "조선 야담 배경";
        characterRaw = "조선 인물";
      } else {
        // 완전 비정형 형태 구제: 씬 번호 제외한 나머지 전체 텍스트를 내레이션으로 전수 투입
        const cleanContent = blockText.replace(/\[S\d+\.?\]/, "").trim();
        if (cleanContent.length > 3) {
          narrationText = cleanContent;
          locationRaw = "야담 유동 배경";
          characterRaw = "조선 인물";
        } else {
          continue; // 유의미한 콘텐츠가 없어 스킵
        }
      }
    }

    // 위치 라벨 가공
    const cleanLocName = locationRaw.split(",")[0].trim();
    if (!locationsMap.has(cleanLocName)) {
      locationsMap.set(cleanLocName, locationRaw);
    }

    // 씬 내 등장인물 추출
    const sceneCharacters: string[] = [];
    if (characterRaw !== "인물 자동 분석" && characterRaw !== "인물 없음") {
      for (const [charId, charObj] of charactersMap.entries()) {
        if (characterRaw.includes(charId)) {
          sceneCharacters.push(charObj.name);
        }
      }
    }

    // 지능형 내 텍스트 인물 언급 분석 (TTS나 연출 지문에 직접 기호화/인명 언급이 있는 지 탐색하여 자동 할당)
    for (const [charId, charObj] of charactersMap.entries()) {
      if (!sceneCharacters.includes(charObj.name)) {
        const simpleName = charObj.name.split(" ")[0];
        if (
          blockText.includes(charId) ||
          narrationText.includes(charObj.name) ||
          narrationText.includes(simpleName) ||
          visualDescription.includes(charId) ||
          visualDescription.includes(charObj.name) ||
          visualDescription.includes(simpleName)
        ) {
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

    const motionOptions: ("none" | "dolly_in" | "dolly_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "orbit" | "slow_zoom")[] = [
      "dolly_in", "pan_left", "dolly_out", "pan_right", "tilt_down", "slow_zoom", "orbit"
    ];
    const cameraMotion = motionOptions[(idCounter - 1) % motionOptions.length];

    scenes.push({
      id: idCounter++,
      stage,
      locationName: cleanLocName,
      characterNames: sceneCharacters,
      narrationText,
      visualDescription,
      refinedImagePrompt,
      cameraMotion
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
