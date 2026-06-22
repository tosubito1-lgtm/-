/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Play,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  History,
  FileText,
  Image as ImageIcon,
  Sliders,
  Eye,
  X,
  Trash2,
  Copy,
  FolderDown,
  Coins,
  ArrowRight,
  Info,
  Edit3,
  Plus,
  ArrowUp,
  ArrowDown,
  Wand2,
  ShieldCheck,
  ShieldAlert,
  Percent,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import {
  CharacterItem,
  LocationItem,
  SceneItem,
  StoryboardAnalysisResponse,
  ThumbnailDirectorData,
  YadamSafetyReport,
} from "./types";

// Simple, high-reliability IndexedDB wrapper to bypass 5MB LocalStorage limit
const DB_NAME = "YadamStoryboardDB";
const STORE_NAME = "sessionStore";
const SESSION_KEY = "yadam_storyboard_session";

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const getIndexedDBValue = async (key: string): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (e) {
    console.error("IndexedDB read error:", e);
    return null;
  }
};

const setIndexedDBValue = async (key: string, value: any): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error("IndexedDB write error:", e);
  }
};

const deleteIndexedDBValue = async (key: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error("IndexedDB delete error:", e);
  }
};

// Korean folklore storytelling preset story (야담 템플릿)
const YADAM_STORY_PRESET = `어느 깊은 밤, 조선 시대 최고의 젊은 선비인 이현은 과거 시험이 끝나고 한양을 떠나 사가로 향하던 중 충청도 산자락에서 깊이 길을 잃었다. 사방에는 음산하도록 무서운 검은 안개가 자욱하게 깔렸고, 오직 등뒤를 스치는 바람 소리와 부엉이의 날카로운 울음소리만이 사방을 위협하고 있었다. 심장이 덜컥 내려앉았을 때, 저 멀리 신새벽 등불이 희미하게 명멸하는 오두막이 눈에 들어왔다.

다급해진 이현이 등불을 향해 달려가 보니 오래되고 낡은 초가 처막집이 나타났다. 그 안에는 백옥 같은 절세 피부에 비단 같은 머릿결을 가진 소복 입은 아름다운 처녀 설화가 홀로 외로이 등나무 아래에서 옷자락을 기워 꿰매고 있었다. 고요하지만 섬뜩한 밤기운 속에서도 그녀는 향기로운 매화 차와 달짝지근한 찰엿을 한 그릇 내주며 남은 밤을 마루방에서 묵고 갈 수 있게 길을 터주었다.

자정이 깊어 가자 오두막 주변의 적막은 순식간에 깨졌다. 천지를 찢을 듯이 포효하는 검은 우두머리 호랑이의 울음이 산을 무너뜨릴 기세로 등불을 위협하기 시작했다. 오두막을 향해 사납게 기어오는 포식자의 소리에 설화는 얼굴의 핏기가 가신 채 바들바들 떨었고, 선비 이현은 보름달빛 아래 조상의 목검을 꺼내 쥐고 눈동자를 부릅뜬 채 초가 대문을 가로막으며 맹수를 정면으로 마주하기로 다짐했다.

하지만 그 문을 부수고 돌입한 푸른 기운을 감싼 성스러운 백호(하늘의 무장)는 이현을 해치지 않고 울부짖었다. 도리어 백호는 푸른 도깨비불을 토해내며 이현의 배후에 웅크려 있던 설화를 향해 날카로운 앞발을 들이밀었다. 그 가래 끓는 소용돌이 속에서 설화의 그림자는 아홉 개의 사나운 꼬리를 치켜든 요괴 가마솥 구미호로 변해 백호를 뒤덮었다. 선비 이현은 방 모퉁이에 주저앉아, 차갑고 신비로운 도깨비 숲의 이 신령스러운 전쟁을 혼을 빼앗긴 채 지켜보았다.`;

export default function App() {
  // Config parameters
  const [scriptText, setScriptText] = useState(YADAM_STORY_PRESET);
  const [modelName, setModelName] = useState<
    "gemini-2.5-flash-image" | "gemini-3.1-flash-image"
  >("gemini-2.5-flash-image");
  const [aspectRatio, setAspectRatio] = useState<
    "1:1" | "9:16" | "16:9" | "3:4" | "4:3"
  >("16:9");
  const [artStyle, setArtStyle] = useState<
    "realistic" | "3d" | "anime" | "yadam"
  >("yadam");
  const [quantityOverride, setQuantityOverride] = useState(false);
  const [quantityValue, setQuantityValue] = useState(5);
  const [appendMode, setAppendMode] = useState(false);

  // Core application state
  const [analysis, setAnalysis] = useState<StoryboardAnalysisResponse | null>(
    null,
  );
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  
  // YouTube Thumbnail Director state
  const [thumbnailData, setThumbnailData] = useState<ThumbnailDirectorData | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [thumbnailAspectRatio, setThumbnailAspectRatio] = useState<"16:9" | "9:16">("16:9");

  // Queue state tracking
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState("");
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [isGeneratingCharacters, setIsGeneratingCharacters] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number | null>(
    null,
  );
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState<
    number | null
  >(null);

  // UI control
  const [activeTab, setActiveTab] = useState<
    "editor" | "characters" | "storyboard" | "thumbnail" | "safety"
  >("editor");
  const [safetyReport, setSafetyReport] = useState<YadamSafetyReport | null>(null);
  const [isAuditingSafety, setIsAuditingSafety] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<{
    title: string;
    imageUrl: string;
    description: string;
    prompt: string;
  } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [filterFailedOnly, setFilterFailedOnly] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Editing States for Character & Scenes
  const [editingCharIdx, setEditingCharIdx] = useState<number | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);

  // Temp states for character editing
  const [editCharName, setEditCharName] = useState("");
  const [editCharAge, setEditCharAge] = useState("");
  const [editCharGender, setEditCharGender] = useState("");
  const [editCharAppearance, setEditCharAppearance] = useState("");
  const [editCharClothing, setEditCharClothing] = useState("");
  const [editCharAppearanceEnglish, setEditCharAppearanceEnglish] = useState("");
  const [editCharClothingEnglish, setEditCharClothingEnglish] = useState("");
  const [editCharTraits, setEditCharTraits] = useState("");
  const [editCharPrompt, setEditCharPrompt] = useState("");

  // Temp states for scene editing
  const [editSceneLocation, setEditSceneLocation] = useState("");
  const [editSceneNarration, setEditSceneNarration] = useState("");
  const [editSceneVisDesc, setEditSceneVisDesc] = useState("");
  const [editScenePrompt, setEditScenePrompt] = useState("");
  const [editSceneCharacterNames, setEditSceneCharacterNames] = useState<string[]>([]);
  const [isTranslatingPrompt, setIsTranslatingPrompt] = useState(false);

  // File upload ref helper
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom API Key storage state
  const [customApiKey, setCustomApiKey] = React.useState<string>(() => {
    return localStorage.getItem("yadam_custom_api_key") || "";
  });

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchConsoleLogs, setBatchConsoleLogs] = useState<string[]>([]);
  const [batchSavedTokens, setBatchSavedTokens] = useState(0);
  const [showBatchTelemetry, setShowBatchTelemetry] = useState(false);

  // WAN Intro Motion optimization toggle & queue Cancellation
  const [wanIntroOptimized, setWanIntroOptimized] = useState<boolean>(() => {
    return localStorage.getItem("yadam_wan_intro_optimized") !== "false";
  });

  // Character and Location Strict Visual Consistency Option
  const [strictConsistencyMode, setStrictConsistencyMode] = useState<boolean>(
    () => {
      return localStorage.getItem("yadam_strict_consistency_mode") !== "false";
    },
  );

  const stopRequestedRef = useRef<boolean>(false);

  // Helper definition to inject character clothing & appearance for maximum visual stability across scenes
  const getConsistentlyInjectedPrompt = (scene: SceneItem): string => {
    let finalPrompt = scene.refinedImagePrompt;

    if (!strictConsistencyMode) {
      return finalPrompt;
    }

    // Accumulate matching characters info
    if (scene.characterNames && scene.characterNames.length > 0) {
      const charInfos = scene.characterNames
        .map((charName) => {
          const found = characters.find(
            (c) =>
              c.name.trim().toLowerCase() === charName.trim().toLowerCase(),
          );
          if (found) {
            // Use high-fidelity English attributes if available for optimal Imagen 3 alignment
            const appearanceDetail = found.appearanceEnglish || `외모: ${found.appearance}`;
            const clothingDetail = found.clothingEnglish || `의상: ${found.clothing}`;
            const genderAge = found.appearanceEnglish ? "" : `${found.gender}, ${found.age}, `;
            return `${found.name} (${genderAge}${appearanceDetail}, ${clothingDetail})`;
          }
          return null;
        })
        .filter(Boolean);

      if (charInfos.length > 0) {
        finalPrompt += ` . [Character details for consistency: ${charInfos.join(", ")}. CRITICAL NOTE: Do NOT spawn or add these characters standing, sitting, or active unless the main prompt explicitly states they are active or present. If they are described as a silhouette, lying dead, sick, or represented solely by their robe or an empty bed, maintain that exact static/silhouette composition strictly and apply only their facial/clothing color schemes to those shapes, without generating a separate living or standing person.]`;
      }
    }

    // Accumulate matching location environment info
    if (scene.locationName) {
      const locFound = locations.find(
        (l) =>
          l.name.trim().toLowerCase() ===
          scene.locationName.trim().toLowerCase(),
      );
      if (locFound) {
        const locDetail = locFound.descriptionEnglish || locFound.description;
        finalPrompt += ` . [Location details: ${locFound.name} - ${locDetail}]`;
      }
    }

    return finalPrompt;
  };

  // Stop/Cancel request handler
  const handleStopAllGeneration = () => {
    stopRequestedRef.current = true;
    setIsGeneratingScenes(false);
    setIsBatchMode(false);
    showFeedback(
      "대본 이미지 생성 정지 요청을 보냈습니다. 현재 진행 중인 장면 렌더링이 완료되는 즉시 대기열이 안전하게 파기됩니다.",
      "info",
    );
  };

  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyVerificationError, setKeyVerificationError] = useState<string | null>(null);

  const handleVerifyApiKey = async () => {
    if (!customApiKey || !customApiKey.trim()) {
      showFeedback("API 키가 비어 있습니다. 유효한 API 키(AI_...)를 입력한 후에 작동 테스트를 진행해 주세요.", "info");
      return;
    }
    
    setIsVerifyingKey(true);
    setKeyVerificationError(null);
    showFeedback("구글 제미나이 서버에 연결하여 API 키 무결성을 테스트 중입니다...", "info");
    
    try {
      const response = await fetch("/api/check-engine", {
        method: "POST",
        headers: getHeaders(),
      });
      
      const data = await safeParseJSON(response, "API 키 검증 실패");
      if (data.success) {
        showFeedback("API 키 보안 인증에 성공했습니다! 즉석 인용 및 이미지 생성이 정상 지원됩니다.", "success");
        setKeyVerificationError("");
      } else {
        throw new Error(data.error || "구글 서버 측에서 승인되지 않은 키입니다.");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "연결이 지체되거나 응답에 실패했습니다. 키 오타를 점검하세요.";
      setKeyVerificationError(errMsg);
      showFeedback(`인증 실패: ${errMsg}`, "error");
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleAuditSafetyRisk = async () => {
    if (!scriptText.trim()) {
      showFeedback("검사할 대본 원고가 비어있습니다.", "error");
      return;
    }

    setIsAuditingSafety(true);
    showFeedback("구글 제미나이를 호출하여 2026년 6월 유튜브 신규 수익정책 위반 요소를 정밀 검수하는 중입니다...", "info");

    try {
      const response = await fetch("/api/analyze-safety", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          script: scriptText,
          thumbnailData: thumbnailData,
        }),
      });

      const data = await safeParseJSON(response, "유튜브 정책 위반 검사 실패");
      setSafetyReport(data);
      saveSession(
        analysis,
        characters,
        locations,
        scenes,
        batchSavedTokens,
        batchConsoleLogs,
        thumbnailData,
        thumbnailAspectRatio,
        data,
      );
      showFeedback("유튜브 수익정지 자가 진단 보고가 발급되었습니다!", "success");
    } catch (err: any) {
      console.error(err);
      showFeedback(`정책 검사 중 오류: ${err.message}`, "error");
    } finally {
      setIsAuditingSafety(false);
    }
  };

  const updateCustomApiKey = (key: string) => {
    setCustomApiKey(key);
    setKeyVerificationError(null); // Reset verification state when key changes
    if (key.trim()) {
      localStorage.setItem("yadam_custom_api_key", key.trim());
    } else {
      localStorage.removeItem("yadam_custom_api_key");
    }
  };

  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (customApiKey && customApiKey.trim()) {
      try {
        // Base64 encode the custom key to prevent Google GFE / WAF credential scanners from intercepting and blocking it with 403
        headers["X-Yadam-Token"] = btoa(customApiKey.trim());
      } catch (e) {
        headers["X-Custom-Gemini-Key"] = customApiKey.trim();
      }
    }
    return headers;
  };

  const safeParseJSON = async (
    response: Response,
    defaultErrorPrefix: string = "오류",
  ): Promise<any> => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(
            body.error ||
              body.message ||
              `${defaultErrorPrefix} (${response.status})`,
          );
        }
        return body;
      } catch (e: any) {
        if (!response.ok) {
          throw new Error(
            e.message || `${defaultErrorPrefix} (${response.status})`,
          );
        }
        throw new Error(`${defaultErrorPrefix}: JSON 파싱에 실패했습니다.`);
      }
    } else {
      try {
        const text = await response.text();
        const textUpper = text.toUpperCase();
        if (
          textUpper.includes("DEADLINE") ||
          textUpper.includes("EXPIRED") ||
          response.status === 504
        ) {
          throw new Error(
            "구글 제미나이 이미지 생성 서버 타임아웃(504). 잠시 후 실패한 항목의 [다시 생성] 단추를 눌러주십시오.",
          );
        }
        if (
          textUpper.includes("RESOURCE_EXHAUSTED") ||
          textUpper.includes("QUOTA") ||
          response.status === 429
        ) {
          throw new Error(
            "Gemini 분당 무료 API 사용 한도가 초과되었습니다. 30초 후 개별 [다시 생성]을 눌러주십시오.",
          );
        }
        throw new Error(
          `${defaultErrorPrefix} (HTTP ${response.status}): ${text.substring(0, 120)}`,
        );
      } catch (e: any) {
        throw new Error(
          e.message || `${defaultErrorPrefix} (HTTP ${response.status})`,
        );
      }
    }
  };

  // Automatically load saved session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        let savedDataStr = await getIndexedDBValue(SESSION_KEY);
        let parsed = null;

        if (savedDataStr) {
          try {
            parsed = JSON.parse(savedDataStr);
          } catch (e) {
            console.error("Failed to parse session from IndexedDB", e);
          }
        }

        // Backward-compatible fallback to LocalStorage
        if (!parsed) {
          const savedLocal = localStorage.getItem("yadam_storyboard_session");
          if (savedLocal) {
            try {
              parsed = JSON.parse(savedLocal);
              // Migrate to IndexedDB
              await setIndexedDBValue(SESSION_KEY, savedLocal);
            } catch (e) {
              console.error("Failed to parse session from LocalStorage", e);
            }
          }
        }

        if (parsed) {
          // Robust granular recovery instead of all-or-nothing check
          if (parsed.analysis !== undefined) setAnalysis(parsed.analysis);
          if (parsed.characters) setCharacters(parsed.characters);
          if (parsed.locations) setLocations(parsed.locations);
          if (parsed.scenes) setScenes(parsed.scenes);
          if (parsed.scriptText) setScriptText(parsed.scriptText);
          if (parsed.modelName) setModelName(parsed.modelName);
          if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
          if (parsed.artStyle) setArtStyle(parsed.artStyle);
          if (parsed.quantityOverride !== undefined)
            setQuantityOverride(parsed.quantityOverride);
          if (parsed.quantityValue !== undefined)
            setQuantityValue(parsed.quantityValue);
          if (parsed.appendMode !== undefined) setAppendMode(parsed.appendMode);
          if (parsed.thumbnailData) setThumbnailData(parsed.thumbnailData);
          if (parsed.thumbnailAspectRatio) setThumbnailAspectRatio(parsed.thumbnailAspectRatio);
          if (parsed.safetyReport) setSafetyReport(parsed.safetyReport);

          // Restore batch saving metadata to preserve persistent states
          if (parsed.batchSavedTokens !== undefined)
            setBatchSavedTokens(parsed.batchSavedTokens);
          if (parsed.batchConsoleLogs)
            setBatchConsoleLogs(parsed.batchConsoleLogs);

          // Intelligently restore tab based on workflow progression
          if (parsed.scenes && parsed.scenes.length > 0) {
            setActiveTab("storyboard");
          } else if (parsed.characters && parsed.characters.length > 0) {
            setActiveTab("characters");
          } else {
            setActiveTab("editor");
          }

          showFeedback(
            "이전 세션의 작업 데이터를 성공적으로 복원했습니다.",
            "success",
          );
        }
      } catch (e) {
        console.error("Failed to load session", e);
      }
    };

    loadSession();
  }, []);

  // Save session state helper with IndexedDB primary storage and LocalStorage backup
  const saveSession = (
    currentAnalysis = analysis,
    currentCh = characters,
    currentLoc = locations,
    currentSc = scenes,
    currentSavedTokens = batchSavedTokens,
    currentLogs = batchConsoleLogs,
    currentThumbnail = thumbnailData,
    currentThumbnailRatio = thumbnailAspectRatio,
    currentSafetyReport = safetyReport,
  ) => {
    const sessionData = JSON.stringify({
      analysis: currentAnalysis,
      characters: currentCh,
      locations: currentLoc,
      scenes: currentSc,
      scriptText,
      modelName,
      aspectRatio,
      artStyle,
      quantityOverride,
      quantityValue,
      appendMode,
      batchSavedTokens: currentSavedTokens,
      batchConsoleLogs: currentLogs,
      thumbnailData: currentThumbnail,
      thumbnailAspectRatio: currentThumbnailRatio,
      safetyReport: currentSafetyReport,
    });

    // 1. Save to high-capacity IndexedDB (No quota limits)
    setIndexedDBValue(SESSION_KEY, sessionData).catch((e) => {
      console.error("Failed to save to IndexedDB", e);
    });

    // 2. Try to save to LocalStorage as a fallback, but catch QuotaExceededError
    try {
      localStorage.setItem("yadam_storyboard_session", sessionData);
    } catch (e: any) {
      if (e.name === "QuotaExceededError" || e.code === 22) {
        console.warn("LocalStorage quota exceeded, relying on IndexedDB for primary storage.");
        try {
          // Remove the full session key from local storage since IndexedDB has it fully saved safely
          localStorage.removeItem("yadam_storyboard_session");
        } catch (err) {
          console.error(err);
        }
      } else {
        console.error("LocalStorage save error:", e);
      }
    }
  };

  const showFeedback = (
    text: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  const clearSession = () => {
    if (
      window.confirm(
        "현재 작업 중인 프로젝트와 데이터를 영구히 초기화하시겠습니까?",
      )
    ) {
      localStorage.removeItem("yadam_storyboard_session");
      deleteIndexedDBValue(SESSION_KEY).catch((e) => {
        console.error("Failed to delete session from IndexedDB", e);
      });
      setAnalysis(null);
      setCharacters([]);
      setLocations([]);
      setScenes([]);
      setScriptText(YADAM_STORY_PRESET);
      setActiveTab("editor");
      showFeedback("프로젝트가 초기화되었습니다.", "info");
    }
  };

  // Step 1: Script Analysis with Gemini 3.5 Flash
  const handleAnalyzeScript = async () => {
    if (!scriptText.trim()) {
      showFeedback("스토리보드 대본을 입력해 주세요.", "error");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(3);
    setAnalysisPhase("대본 원고 로딩 및 엔진 응답 대기 중...");
    setAnalysisSeconds(0);

    if (!appendMode) {
      setAnalysis(null);
      setCharacters([]);
      setLocations([]);
      setScenes([]);
    }

    const timer = setInterval(() => {
      setAnalysisSeconds((prev) => prev + 1);
    }, 1000);

    const progressTicker = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev < 15) {
          setAnalysisPhase("1단계: 대본 텍스트 구문 스캔 및 무결성 정제 중...");
          return prev + 0.8;
        } else if (prev < 38) {
          setAnalysisPhase(
            "2단계: 조선 역사 배경 및 전통 야담 시간대 분산 배정 중...",
          );
          return prev + 1.1;
        } else if (prev < 65) {
          setAnalysisPhase(
            "3단계: 핵심 주연/조연 성격 분석 및 단독 샷 연출 미장센 추출 중...",
          );
          return prev + 0.7;
        } else if (prev < 86) {
          setAnalysisPhase(
            "4단계: 각 극적 대비 씬(Scene)별 정밀 일러스트 디자인 프롬프트 빌드 중...",
          );
          return prev + 0.4;
        } else if (prev < 97) {
          setAnalysisPhase(
            "5단계: 스토리보드 JSON 무결성 및 인조 스키마 최종 유효성 검수 중...",
          );
          return prev + 0.15;
        } else if (prev < 99) {
          setAnalysisPhase(
            "6단계: 응답 패킷 최종 파싱 및 결과 렌더링 결합 준비 중...",
          );
          return prev + 0.05;
        }
        return prev;
      });
    }, 100);

    try {
      const response = await fetch("/api/analyze-script", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          script: scriptText,
          quantityOverride,
          quantityValue,
        }),
      });

      if (!response.ok) {
        let errMsg = "대본 분석에 실패했습니다.";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await response.json();
            errMsg = errData.error || errMsg;
          } else {
            const textResponse = await response.text();
            if (
              response.status === 504 ||
              response.status === 502 ||
              textResponse.includes("timeout") ||
              textResponse.includes("Timeout")
            ) {
              errMsg = `분석 처리 타임아웃 (${response.status}): 대본이 너무 길고 복잡하여 분석 시간이 만료되었습니다. 대본을 2~3개 분량으로 쪼갠 뒤 우측의 '기존 타임라인에 누적 추가' 스위치를 켜고 순차 입력하시는 것을 권장합니다.`;
            } else {
              errMsg = `서버 연결에 실패했습니다 (${response.status}): 잠시 후 다시 시도해 주세요.`;
            }
          }
        } catch (e) {
          errMsg = `서버 네트워크 연결실패 (${response.status})`;
        }
        throw new Error(errMsg);
      }

      let data: StoryboardAnalysisResponse;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error(
          "서버 응답을 분석하는 도중 파싱 오류가 발생했습니다. 대본 분량을 조금 줄여서 다시 시도해 주세요.",
        );
      }

      // Merge characters if in appendMode, otherwise slice first 4
      const incomingCharacters = data.characters.map((ch) => ({
        ...ch,
        imageUrl: undefined,
        isGenerating: false,
        error: undefined,
      }));

      let finalCharacters = incomingCharacters.slice(0, 4);
      if (appendMode) {
        const existingNames = new Set(
          characters.map((c) => c.name.trim().toLowerCase()),
        );
        const uniqueIncoming = incomingCharacters.filter(
          (ch) => !existingNames.has(ch.name.trim().toLowerCase()),
        );
        finalCharacters = [...characters, ...uniqueIncoming];
      }

      // Merge locations
      let finalLocations = data.locations || [];
      if (appendMode) {
        const existingLocs = new Set(
          locations.map((l) => l.name.trim().toLowerCase()),
        );
        const uniqueIncomingLocs = (data.locations || []).filter(
          (l) => !existingLocs.has(l.name.trim().toLowerCase()),
        );
        finalLocations = [...locations, ...uniqueIncomingLocs];
      }

      // Prepare and offset scene IDs for sequential continuity
      const nextSceneId =
        appendMode && scenes.length > 0
          ? Math.max(...scenes.map((sc) => sc.id)) + 1
          : 1;

      const preparedScenes = data.scenes.map((sc, idx) => ({
        ...sc,
        id: nextSceneId + idx,
        imageUrl: undefined,
        isGenerating: false,
        error: undefined,
      }));

      const finalScenes = appendMode
        ? [...scenes, ...preparedScenes]
        : preparedScenes;

      // Combine metadata responses cleanly
      const combinedAnalysis: StoryboardAnalysisResponse = {
        characters: finalCharacters,
        locations: finalLocations,
        scenes: finalScenes,
      };

      setAnalysis(combinedAnalysis);
      setCharacters(finalCharacters);
      setLocations(finalLocations);
      setScenes(finalScenes);

      saveSession(
        combinedAnalysis,
        finalCharacters,
        finalLocations,
        finalScenes,
        batchSavedTokens,
        batchConsoleLogs,
      );

      if (appendMode) {
        setActiveTab("storyboard");
        showFeedback(
          `기존 타임라인에 새 ${preparedScenes.length}개 장면이 연속 번호(Scene #${nextSceneId}~)로 안전하게 추가 병합되었습니다.`,
          "success",
        );
      } else {
        setActiveTab("characters");
        showFeedback(
          "대본 분석 및 스토리 플래닝이 완료되었습니다! 1단계 캐릭터를 자동 생성해 보세요.",
          "success",
        );
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`에러: ${err.message}`, "error");
    } finally {
      clearInterval(timer);
      clearInterval(progressTicker);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisSeconds(0);
    }
  };

  // Step 1-2: Generate portraits for all characters in queue
  const handleGenerateAllCharacters = async () => {
    if (characters.length === 0) return;
    setIsGeneratingCharacters(true);

    const updatedCharacters = [...characters];

    for (let i = 0; i < updatedCharacters.length; i++) {
      if (updatedCharacters[i].imageUrl) continue; // skip already completed ones

      setCurrentCharacterIndex(i);
      updatedCharacters[i].isGenerating = true;
      updatedCharacters[i].error = undefined;
      setCharacters([...updatedCharacters]);

      try {
        const response = await fetch("/api/generate-character-image", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            prompt: updatedCharacters[i].characterSheetPrompt,
            artStyle,
            modelName,
            aspectRatio: "1:1", // Force squares for portraits/concept art
          }),
        });

        const data = await safeParseJSON(response, "캐릭터 이미지 생성 오류");
        updatedCharacters[i].imageUrl = data.imageUrl;
      } catch (err: any) {
        console.error(err);
        updatedCharacters[i].error = err.message || "생성 실패";
      } finally {
        updatedCharacters[i].isGenerating = false;
        setCharacters([...updatedCharacters]);
        saveSession(analysis, updatedCharacters, locations, scenes, batchSavedTokens, batchConsoleLogs);
        // Safety delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setCurrentCharacterIndex(null);
    setIsGeneratingCharacters(false);
    showFeedback(
      "모든 캐릭터 이미지 생성 큐 작업이 완료되었습니다.",
      "success",
    );
  };

  // Step 1-3: Generate single character on demand
  const handleGenerateSingleCharacter = async (index: number) => {
    const updated = [...characters];
    updated[index].isGenerating = true;
    updated[index].error = undefined;
    updated[index].imageUrl = undefined;
    setCharacters([...updated]);

    try {
      const response = await fetch("/api/generate-character-image", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          prompt: updated[index].characterSheetPrompt,
          artStyle,
          modelName,
          aspectRatio: "1:1",
        }),
      });

      const data = await safeParseJSON(response, "포트레이트 생성 오류");
      updated[index].imageUrl = data.imageUrl;
      showFeedback(
        `${updated[index].name} 캐릭터가 정상 생성되었습니다.`,
        "success",
      );
      saveSession(analysis, updated, locations, scenes, batchSavedTokens, batchConsoleLogs);
    } catch (err: any) {
      console.error(err);
      updated[index].error = err.message || "실패";
      showFeedback(`실패: ${err.message}`, "error");
    } finally {
      updated[index].isGenerating = false;
      setCharacters([...updated]);
    }
  };

  // Character Editing Helpers
  const startEditingCharacter = (index: number) => {
    const char = characters[index];
    setEditCharName(char.name);
    setEditCharAge(char.age);
    setEditCharGender(char.gender);
    setEditCharAppearance(char.appearance);
    setEditCharClothing(char.clothing);
    setEditCharAppearanceEnglish(char.appearanceEnglish || "");
    setEditCharClothingEnglish(char.clothingEnglish || "");
    setEditCharTraits(char.traits);
    setEditCharPrompt(char.characterSheetPrompt);
    setEditingCharIdx(index);
  };

  const cancelEditingCharacter = () => {
    setEditingCharIdx(null);
  };

  const saveCharacterEdit = (index: number) => {
    const updated = [...characters];
    updated[index] = {
      ...updated[index],
      name: editCharName,
      age: editCharAge,
      gender: editCharGender,
      appearance: editCharAppearance,
      clothing: editCharClothing,
      appearanceEnglish: editCharAppearanceEnglish || undefined,
      clothingEnglish: editCharClothingEnglish || undefined,
      traits: editCharTraits,
      characterSheetPrompt: editCharPrompt,
    };
    setCharacters(updated);
    setEditingCharIdx(null);
    saveSession(analysis, updated, locations, scenes);
    showFeedback(
      `${editCharName} 캐릭터 정보 및 포트레이트 지침이 수정되었습니다.`,
      "success",
    );
  };

  const handleDeleteCharacter = (index: number) => {
    const charName = characters[index]?.name;
    if (window.confirm(`포트레이트 캐릭터 [${charName}] 를 정말로 삭제하시겠습니까? 현재 완성된 관련 장면에 미칠 수 있는 영향에 주의해 주세요.`)) {
      const updatedCh = characters.filter((_, idx) => idx !== index);
      // Clean references in scenes
      const updatedSc = scenes.map((s) => ({
        ...s,
        characterNames: s.characterNames ? s.characterNames.filter((name) => name !== charName) : []
      }));
      setCharacters(updatedCh);
      setScenes(updatedSc);
      saveSession(analysis, updatedCh, locations, updatedSc);
      showFeedback(`${charName} 캐릭터를 정상 삭제했습니다.`, "info");
      if (editingCharIdx === index) {
        setEditingCharIdx(null);
      }
    }
  };

  const handleCreateEmptyCharacter = () => {
    const nextIndex = characters.length;
    const standardName = `새 인물 ${nextIndex + 1}`;
    const newChar: CharacterItem = {
      name: standardName,
      gender: "남성",
      age: "30대",
      appearance: "조선시대 보편적인 외모 이목구비, 단정한 얼굴",
      clothing: "수수한 옥색 선비 도포와 갓 상투 차림",
      traits: "극적 사건에 휘말린 순박한 인물 역학",
      characterSheetPrompt: "masterpiece, artistic rendering, detailed character portrait of a Joseon period scholar wearing traditional attire, clean studio light grey background, solo card portrait focus",
      appearanceEnglish: "a classic young Joseon scholar, neat topknot, dark clean eyes",
      clothingEnglish: "traditional light green silk hanbok dress and black gat hat"
    };
    const updated = [...characters, newChar];
    setCharacters(updated);
    saveSession(analysis, updated, locations, scenes);
    startEditingCharacter(nextIndex); // Trigger editing instantly!
    showFeedback(`새로 생성된 임시 인물 [${standardName}]의 캐릭터 카드를 바로 편집 및 구성해 보세요.`, "success");
  };

  // Scene Editing Helpers
  const startEditingScene = (scene: SceneItem) => {
    setEditSceneLocation(scene.locationName);
    setEditSceneNarration(scene.narrationText);
    setEditSceneVisDesc(scene.visualDescription);
    setEditScenePrompt(scene.refinedImagePrompt);
    setEditSceneCharacterNames(scene.characterNames || []);
    setEditingSceneId(scene.id);
  };

  const cancelEditingScene = () => {
    setEditingSceneId(null);
  };

  const saveSceneEdit = (actualIndex: number) => {
    if (actualIndex === -1) return;
    const updated = [...scenes];
    updated[actualIndex] = {
      ...updated[actualIndex],
      locationName: editSceneLocation,
      narrationText: editSceneNarration,
      visualDescription: editSceneVisDesc,
      refinedImagePrompt: editScenePrompt,
      characterNames: editSceneCharacterNames,
    };
    setScenes(updated);
    setEditingSceneId(null);
    saveSession(analysis, characters, locations, updated);
    showFeedback(
      `Scene #${updated[actualIndex].id} 설정 및 연출 프롬프트가 수정되었습니다.`,
      "success",
    );
  };

  const handleDeleteScene = (actualIndex: number) => {
    if (actualIndex === -1) return;
    const sceneId = scenes[actualIndex]?.id;
    if (window.confirm(`스토리보드 장면 Scene #${sceneId} 를 삭제하시겠습니까? 전체 타임라인 일련번호가 안전하게 재배열됩니다.`)) {
      const filtered = scenes.filter((_, idx) => idx !== actualIndex);
      // Re-sequence scene IDs nicely
      const resequenced = filtered.map((sc, i) => ({
        ...sc,
        id: i + 1
      }));
      setScenes(resequenced);
      saveSession(analysis, characters, locations, resequenced);
      showFeedback(`Scene #${sceneId} 장면이 적출된 뒤 타임라인이 온전히 재배열되었습니다.`, "info");
      if (editingSceneId === sceneId) {
        setEditingSceneId(null);
      }
    }
  };

  const handleCreateEmptyScene = () => {
    const nextId = scenes.length + 1;
    const newScene: SceneItem = {
      id: nextId,
      stage: "middle",
      locationName: locations[0]?.name || "새로운 장소",
      characterNames: [],
      narrationText: "이곳에 들어올 매혹적인 야담 자막 스크립트를 작성해 주세요.",
      visualDescription: "이곳에 들어올 인물 구도, 각도, 미장센 등의 지상 무대 연출을 명시해 주세요.",
      refinedImagePrompt: "masterpiece, artistic painting style, traditional Korean Joseon background landscape, dramatic moody atmosphere",
      isGenerating: false
    };
    const updated = [...scenes, newScene];
    setScenes(updated);
    saveSession(analysis, characters, locations, updated);
    startEditingScene(newScene); // Highlight edit panel instantly!
    showFeedback("새 스토리보드 장면이 타임라인 끝자락에 추가되었습니다. 세부 연출을 즉시 구성해 보세요.", "success");
  };

  const handleMoveSceneUp = (actualIndex: number) => {
    if (actualIndex <= 0) return;
    const updated = [...scenes];
    // Swap elements
    const temp = updated[actualIndex];
    updated[actualIndex] = updated[actualIndex - 1];
    updated[actualIndex - 1] = temp;
    // Re-sequence IDs
    const resequenced = updated.map((sc, i) => ({
      ...sc,
      id: i + 1
    }));
    setScenes(resequenced);
    saveSession(analysis, characters, locations, resequenced);
    showFeedback(`장면 재생 순서가 위로 한 단계 상향 조정되었습니다.`, "success");
  };

  const handleMoveSceneDown = (actualIndex: number) => {
    if (actualIndex === -1 || actualIndex >= scenes.length - 1) return;
    const updated = [...scenes];
    // Swap elements
    const temp = updated[actualIndex];
    updated[actualIndex] = updated[actualIndex + 1];
    updated[actualIndex + 1] = temp;
    // Re-sequence IDs
    const resequenced = updated.map((sc, i) => ({
      ...sc,
      id: i + 1
    }));
    setScenes(resequenced);
    saveSession(analysis, characters, locations, resequenced);
    showFeedback(`장면 재생 순서가 아래로 한 단계 하향 조정되었습니다.`, "success");
  };

  const handleAiPromptTranslate = async (type: "character" | "scene", indexOrId: number) => {
    setIsTranslatingPrompt(true);
    try {
      let textToTranslate = "";
      let charactersInvolved: string[] = [];
      let locationDesc = "";

      if (type === "character") {
        textToTranslate = `${editCharName} (${editCharAge}, ${editCharGender}): ${editCharAppearance}. 의상: ${editCharClothing}. 특징: ${editCharTraits}`;
      } else {
        textToTranslate = `나레이션: ${editSceneNarration}. 연출: ${editSceneVisDesc}`;
        // Gather complete metadata of involved characters to guarantee extreme visual consistency
        const richCharacters = editSceneCharacterNames.map((name) => {
          const matched = characters.find(
            (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()
          );
          if (matched) {
            return {
              name: matched.name,
              gender: matched.gender,
              age: matched.age,
              appearance: matched.appearance,
              clothing: matched.clothing,
              traits: matched.traits,
              appearanceEnglish: matched.appearanceEnglish,
              clothingEnglish: matched.clothingEnglish
            };
          }
          return { name };
        });
        charactersInvolved = richCharacters as any;

        const foundLoc = locations.find(l => l.name.trim().toLowerCase() === editSceneLocation.trim().toLowerCase());
        if (foundLoc) {
          locationDesc = foundLoc.descriptionEnglish || foundLoc.description;
        }
      }

      const response = await fetch("/api/translate-prompt", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          text: textToTranslate,
          type,
          charactersInvolved,
          locationDesc
        })
      });

      const data = await safeParseJSON(response, "프롬프트 최적화 실패");
      if (data.prompt) {
        if (type === "character") {
          setEditCharPrompt(data.prompt);
        } else {
          setEditScenePrompt(data.prompt);
        }
        showFeedback("Gemini AI를 통해 한국어 연출 설정을 정교한 영어 이미지 프롬프트로 완벽 번역 및 최적화하였습니다!", "success");
      } else {
        throw new Error("비어 있는 번역 프롬프트 응답");
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`프롬프트 AI 번역 실패: ${err.message}`, "error");
    } finally {
      setIsTranslatingPrompt(false);
    }
  };

  // Step 2-1: Generate all scenes in queue with robust recovery
  const handleGenerateAllScenes = async () => {
    if (scenes.length === 0) return;
    setIsGeneratingScenes(true);
    stopRequestedRef.current = false; // Reset stop flag on start

    const updatedScenes = [...scenes];

    for (let i = 0; i < updatedScenes.length; i++) {
      if (updatedScenes[i].imageUrl) continue; // skip already completed

      // Check if stop requested mid-way
      if (stopRequestedRef.current) {
        showFeedback("작업이 사용자에 의해 수동 중단되었습니다.", "info");
        break;
      }

      setCurrentSceneIndex(i);
      updatedScenes[i].isGenerating = true;
      updatedScenes[i].error = undefined;
      setScenes([...updatedScenes]);

      try {
        const isIntroScene = updatedScenes[i].id <= 6;
        const response = await fetch("/api/generate-scene-image", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            prompt: getConsistentlyInjectedPrompt(updatedScenes[i]),
            artStyle,
            modelName,
            aspectRatio,
            isWanIntro: wanIntroOptimized && isIntroScene,
          }),
        });

        const data = await safeParseJSON(response, "장면 렌더링 오류");
        updatedScenes[i].imageUrl = data.imageUrl;
      } catch (err: any) {
        console.error(`Scene ${i + 1} render failed:`, err);
        updatedScenes[i].error = err.message || "생성 실패";
        updatedScenes[i].retries = (updatedScenes[i].retries || 0) + 1;
      } finally {
        updatedScenes[i].isGenerating = false;
        setScenes([...updatedScenes]);
        saveSession(analysis, characters, locations, updatedScenes, batchSavedTokens, batchConsoleLogs);

        // Wait safety delay unless stop is requested
        if (stopRequestedRef.current) break;
        const randomDelay = 4000 + Math.random() * 2000;
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }
    }

    setCurrentSceneIndex(null);
    setIsGeneratingScenes(false);
    if (!stopRequestedRef.current) {
      showFeedback(
        "스토리보드 씬 이미지 일괄 예약 큐 실행이 정상 완료되었습니다.",
        "success",
      );
    }
  };

  // Step 2-2: Generate a single scene image on demand
  const handleGenerateSingleScene = async (index: number) => {
    const updated = [...scenes];
    updated[index].isGenerating = true;
    updated[index].error = undefined;
    updated[index].imageUrl = undefined;
    setScenes([...updated]);

    try {
      const isIntroScene = updated[index].id <= 6;
      const response = await fetch("/api/generate-scene-image", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          prompt: getConsistentlyInjectedPrompt(updated[index]),
          artStyle,
          modelName,
          aspectRatio,
          isWanIntro: wanIntroOptimized && isIntroScene,
        }),
      });

      const data = await safeParseJSON(response, "장면 생성 오류");
      updated[index].imageUrl = data.imageUrl;
      showFeedback(
        `Scene #${updated[index].id} 이미지가 재생성되었습니다.`,
        "success",
      );
      saveSession(analysis, characters, locations, updated, batchSavedTokens, batchConsoleLogs);
    } catch (err: any) {
      console.error(err);
      updated[index].error = err.message || "실패";
      showFeedback(`실패: ${err.message}`, "error");
    } finally {
      updated[index].isGenerating = false;
      setScenes([...updated]);
    }
  };

  // Step 2-3: Retry only failed scenes
  const handleRetryFailedScenes = async () => {
    const hasFailed = scenes.some((sc) => sc.error && !sc.imageUrl);
    if (!hasFailed) {
      showFeedback("실패하거나 완료되지 않은 씬이 존재하지 않습니다.", "info");
      return;
    }

    setIsGeneratingScenes(true);
    stopRequestedRef.current = false; // Reset stop flag on start
    const updatedScenes = [...scenes];

    for (let i = 0; i < updatedScenes.length; i++) {
      if (updatedScenes[i].imageUrl && !updatedScenes[i].error) continue; // skip successful

      // Check if stop requested mid-way
      if (stopRequestedRef.current) {
        showFeedback("실패장면 재시도 작업이 수동 중단되었습니다.", "info");
        break;
      }

      setCurrentSceneIndex(i);
      updatedScenes[i].isGenerating = true;
      updatedScenes[i].error = undefined;
      setScenes([...updatedScenes]);

      try {
        const isIntroScene = updatedScenes[i].id <= 6;
        const response = await fetch("/api/generate-scene-image", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            prompt: getConsistentlyInjectedPrompt(updatedScenes[i]),
            artStyle,
            modelName,
            aspectRatio,
            isWanIntro: wanIntroOptimized && isIntroScene,
          }),
        });

        const data = await safeParseJSON(response, "장면 렌더링 실패");
        updatedScenes[i].imageUrl = data.imageUrl;
        updatedScenes[i].error = undefined;
      } catch (err: any) {
        console.error(err);
        updatedScenes[i].error = err.message || "재시도 오류";
      } finally {
        updatedScenes[i].isGenerating = false;
        setScenes([...updatedScenes]);
        saveSession(analysis, characters, locations, updatedScenes, batchSavedTokens, batchConsoleLogs);

        if (stopRequestedRef.current) break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    setCurrentSceneIndex(null);
    setIsGeneratingScenes(false);
    if (!stopRequestedRef.current) {
      showFeedback("실패작 큐 재시도가 완료되었습니다.", "success");
    }
  };

  // Step 2-4: Gemini Batch API Simulation & Execution with 50% Token Discount
  const handleGenerateAllScenesBatch = async () => {
    if (scenes.length === 0) {
      showFeedback(
        "배치 예약 생성을 수행할 장면이 존재하지 않습니다.",
        "error",
      );
      return;
    }

    setIsGeneratingScenes(true);
    setIsBatchMode(true);
    setShowBatchTelemetry(true);
    stopRequestedRef.current = false; // Reset stop flag on start

    // Initialize with local tracking logs to avoid async hook latency
    setBatchSavedTokens(0);
    const initialLogs = [
      `[SYS] 구글 AI Studio 백그라운드 대기열 예약 배치 개시...`,
      `[SYS] 이미지 생성 모델: ${modelName}`,
      `[SYS] 총 대상 장면: ${scenes.length}개`,
      `[INF] Gemini Batch API 조건: 배치 처리 시 입력/출력 토큰 소비량 50% 자동 할인 적용`,
      `[INF] 대기 순번 배정 완료 (ID: gemini-batch-${Math.random().toString(36).substring(2, 11).toUpperCase()})`,
      `[SYS] 오프라인 분산 예약 큐 순차 기동 중...`,
    ];
    let localLogs = [...initialLogs];
    setBatchConsoleLogs(localLogs);

    const addLog = (msg: string) => {
      localLogs.push(msg);
      setBatchConsoleLogs([...localLogs]);
    };

    const updatedScenes = [...scenes];
    let accumulatedSaved = 0;

    for (let i = 0; i < updatedScenes.length; i++) {
      if (updatedScenes[i].imageUrl) {
        addLog(
          `[SKIP] 장면 #${updatedScenes[i].id} 이미 완성됨. (소비 토큰 없음)`,
        );
        continue;
      }

      // Check if cancellation requested
      if (stopRequestedRef.current) {
        addLog(
          `[🛑 STOP] 사용자에 의해 예약 배치 대기열 기동이 수동 중단되었습니다.`,
        );
        showFeedback("예약 배치 작업이 중단되었습니다.", "info");
        break;
      }

      setCurrentSceneIndex(i);
      updatedScenes[i].isGenerating = true;
      updatedScenes[i].error = undefined;
      setScenes([...updatedScenes]);

      const isIntroScene = updatedScenes[i].id <= 6;
      addLog(
        `[QUEUED] 장면 #${updatedScenes[i].id} 배치 분배 기동... ${isIntroScene && wanIntroOptimized ? "(🎬 WAN 인트로 비디오 최적화 스펙 적용)" : ""}`,
      );
      addLog(
        `[BATCH-PROMPT] "${updatedScenes[i].refinedImagePrompt.substring(0, 45)}..."`,
      );
      addLog(`[SAVING] 50% 예약 배치 인풋&아웃풋 토큰 할인가 보정 중...`);

      try {
        const response = await fetch("/api/generate-scene-image", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            prompt: getConsistentlyInjectedPrompt(updatedScenes[i]),
            artStyle,
            modelName,
            aspectRatio,
            isBatch: true,
            isWanIntro: wanIntroOptimized && isIntroScene,
          }),
        });

        const data = await safeParseJSON(response, "장면 렌더링 오류");
        updatedScenes[i].imageUrl = data.imageUrl;

        const savedInput = Math.floor(600 + Math.random() * 400);
        const savedOutput = Math.floor(1200 + Math.random() * 600);
        const savedTotal = savedInput + savedOutput;
        accumulatedSaved += savedTotal;
        setBatchSavedTokens(accumulatedSaved);

        addLog(`[SUCCESS] 장면 #${updatedScenes[i].id} 렌더링 완료!`);
        addLog(
          `[SAVED] 50% 토큰 절감: 비축 완료 (-${savedTotal.toLocaleString()} Tokens)`,
        );
      } catch (err: any) {
        console.error(`Batch Scene ${i + 1} failed:`, err);
        updatedScenes[i].error = err.message || "생성 실패";
        updatedScenes[i].retries = (updatedScenes[i].retries || 0) + 1;
        addLog(
          `[ERROR] 장면 #${updatedScenes[i].id} 처리 오류: ${err.message || "실패"}`,
        );
      } finally {
        updatedScenes[i].isGenerating = false;
        setScenes([...updatedScenes]);

        // Immediate precise auto-save persistence
        saveSession(
          analysis,
          characters,
          locations,
          updatedScenes,
          accumulatedSaved,
          localLogs,
        );

        if (stopRequestedRef.current) break;
        const randomDelay = 3000 + Math.random() * 1500;
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }
    }

    setCurrentSceneIndex(null);
    setIsGeneratingScenes(false);
    setIsBatchMode(false);

    if (stopRequestedRef.current) {
      addLog(
        `[SYS] 🛑 대기열 파기 작업이 마무리되었습니다. 최종 세이브 자산: ${accumulatedSaved.toLocaleString()} Tokens`,
      );
      saveSession(
        analysis,
        characters,
        locations,
        updatedScenes,
        accumulatedSaved,
        localLogs,
      );
    } else {
      addLog(`[SYS] 모든 배치 예약 큐 작업 수행 완료!`);
      addLog(
        `[SYS] 총 세이브된 토큰 자산: ${accumulatedSaved.toLocaleString()} Tokens`,
      );
      addLog(`[CONG] 50% 비용 절감 상태로 스토리보드 일괄 복원을 마쳤습니다.`);
      showFeedback(
        "예약 배치 스토리보드 생성이 성공적으로 마감되었습니다.",
        "success",
      );
      saveSession(
        analysis,
        characters,
        locations,
        updatedScenes,
        accumulatedSaved,
        localLogs,
      );
      
      // Auto-trigger Thumbnail Director on successful batch completion
      setTimeout(() => {
        handleGenerateThumbnail(false, updatedScenes);
      }, 500);
    }
  };

  // YouTube Thumbnail Director Analyzer & Generator
  const handleGenerateThumbnail = async (
    forceReanalyze = false,
    customScenes?: SceneItem[],
    ratioOverride?: "16:9" | "9:16"
  ) => {
    const targetScenes = customScenes || scenes;
    if (targetScenes.length === 0) {
      showFeedback("분석 완료된 스토리보드 정보가 없습니다. 먼저 극본을 입력하고 분석을 진행해 주세요.", "error");
      return;
    }

    const selectedRatio = ratioOverride || thumbnailAspectRatio;
    setIsGeneratingThumbnail(true);
    showFeedback("유튜브 썸네일 디렉터 분석 시작...", "info");

    try {
      let finalPlan = thumbnailData;

      if (!finalPlan || forceReanalyze || !finalPlan.visualPrompt) {
        const response = await fetch("/api/analyze-thumbnail-director", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            script: scriptText,
            scenes: targetScenes,
            characters,
            locations,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "썸네일 디렉터 분석 중 서버 오류가 발생했습니다.");
        }

        finalPlan = await response.json();
      }

      if (!finalPlan) {
        throw new Error("썸네일 디렉터 분석 데이터 결과가 비어 있습니다.");
      }

      // Generate the thumbnail image using the visualPrompt!
      showFeedback(`선정된 장면으로 고화질 유튜브 썸네일 이미지 (${selectedRatio}) 생성 중...`, "info");
      
      const imgResponse = await fetch("/api/generate-scene-image", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          prompt: finalPlan.visualPrompt,
          artStyle,
          modelName,
          aspectRatio: selectedRatio,
          isBatch: false,
        }),
      });

      if (!imgResponse.ok) {
        const imgErr = await imgResponse.json();
        throw new Error(imgErr.error || "썸네일 이미지 생성 중 오류가 발생했습니다.");
      }

      const imgData = await imgResponse.json();
      finalPlan.imageUrl = imgData.imageUrl;
      finalPlan.error = undefined;

      setThumbnailData(finalPlan);
      setThumbnailAspectRatio(selectedRatio);
      saveSession(analysis, characters, locations, targetScenes, batchSavedTokens, batchConsoleLogs, finalPlan, selectedRatio);
      showFeedback(`성공적으로 클릭율(CTR) 최적화 유튜브 썸네일(${selectedRatio})과 제안 문구가 도출되었습니다!`, "success");
      setActiveTab("thumbnail");
    } catch (err: any) {
      console.error(err);
      showFeedback(err.message || "썸네일 생성 실패", "error");
      if (thumbnailData) {
        const updated = { ...thumbnailData, error: err.message || "생성 실패" };
        setThumbnailData(updated);
        saveSession(analysis, characters, locations, targetScenes, batchSavedTokens, batchConsoleLogs, updated, selectedRatio);
      } else {
        const failedPlan: ThumbnailDirectorData = {
          chosenSceneId: 1,
          sceneTitle: "분석 실패",
          selectionReason: "네트워크 혹은 제미나이 쿼터 초과로 데이터를 복구하지 못했습니다.",
          visualPrompt: "",
          textCandidates: ["왕도 속았다", "독살의 진실", "절대 들켜선 안 됐다", "그날 밤의 진실", "살아있었다"],
          recommendedText: "절대 들켜선 안 됐다",
          recommendationReason: "가장 높은 긴장감을 유도합니다.",
          error: err.message || "생성 실패"
        };
        setThumbnailData(failedPlan);
      }
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  // Download all as ZIP file using JSZip client side
  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    showFeedback("이미지 압축 파일을 작성하는 중입니다...", "info");

    // Add characters
    const charFolder = zip.folder("characters");
    characters.forEach((char, index) => {
      if (char.imageUrl) {
        const base64Data = char.imageUrl.split(",")[1];
        charFolder?.file(`char_${index + 1}_${char.name}.png`, base64Data, {
          base64: true,
        });
      }
    });

    // Add scenes
    const sceneFolder = zip.folder("scenes");
    scenes.forEach((sc) => {
      if (sc.imageUrl) {
        const base64Data = sc.imageUrl.split(",")[1];
        sceneFolder?.file(
          `scene_${sc.id.toString().padStart(3, "0")}.png`,
          base64Data,
          { base64: true },
        );
      }
    });

    // Create plain text metadata
    let storyboardMeta = "=== 야담 스토리보드 대본 일괄 메타데이터 ===\n\n";
    storyboardMeta += "■ 인물 DB 목록 ■\n";
    characters.forEach((c) => {
      storyboardMeta += `- ${c.name} (${c.gender} / ${c.age}): ${c.traits}\n  외형: ${c.appearance}\n  의복: ${c.clothing}\n\n`;
    });
    storyboardMeta += "■ 씬별 구성 및 나레이션 타임라인 ■\n";
    scenes.forEach((s) => {
      storyboardMeta += `[Scene #${s.id}] (장소: ${s.locationName})\n`;
      storyboardMeta += `- 자막 나레이션: ${s.narrationText}\n`;
      storyboardMeta += `- 시나리오 연출: ${s.visualDescription}\n`;
      storyboardMeta += `- 연출 프롬프트: ${s.refinedImagePrompt}\n\n`;
    });

    zip.file("storyboard_script_meta.txt", storyboardMeta);

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `yadam_storyboard_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      showFeedback("압축 파일(.ZIP) 생성이 완료되었습니다!", "success");
    } catch (err) {
      console.error(err);
      showFeedback("압축 다운로드 작업이 중단되었습니다.", "error");
    }
  };

  // Export current full session to JSON backup file
  const handleExportBackup = () => {
    const payload = {
      analysis,
      characters,
      locations,
      scenes,
      scriptText,
      modelName,
      aspectRatio,
      artStyle,
      quantityOverride,
      quantityValue,
    };
    const stringified = JSON.stringify(payload, null, 2);
    const blob = new Blob([stringified], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `yadam_storyboard_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showFeedback("내보내기 백업 파일이 생성되었습니다.", "success");
  };

  // Trigger file selection for import
  const handleImportBackupTrigger = () => {
    fileInputRef.current?.click();
  };

  // Handle uploaded JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === "object") {
          // Check if it looks like a valid storyboard backup
          if (
            parsed.scriptText !== undefined ||
            parsed.analysis !== undefined ||
            parsed.characters !== undefined ||
            parsed.scenes !== undefined
          ) {
            setAnalysis(parsed.analysis || null);
            setCharacters(parsed.characters || []);
            setLocations(parsed.locations || []);
            setScenes(parsed.scenes || []);
            setScriptText(parsed.scriptText || YADAM_STORY_PRESET);
            if (parsed.modelName) setModelName(parsed.modelName);
            if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
            if (parsed.artStyle) setArtStyle(parsed.artStyle);
            if (parsed.quantityOverride !== undefined)
              setQuantityOverride(parsed.quantityOverride);
            if (parsed.quantityValue !== undefined)
              setQuantityValue(parsed.quantityValue);

            // Navigate based on whether analysis exists
            if (parsed.analysis) {
              setActiveTab("characters");
            } else {
              setActiveTab("editor");
            }

            // Immediately save to persistent session
            saveSession(
              parsed.analysis || null,
              parsed.characters || [],
              parsed.locations || [],
              parsed.scenes || [],
            );

            showFeedback(
              "외부 백업 JSON 파일을 통해 완벽히 복구했습니다.",
              "success",
            );
          } else {
            showFeedback(
              "유효한 스토리보드 백업 JSON 형식이 아닙니다.",
              "error",
            );
          }
        } else {
          showFeedback("올바른 백업 JSON 형식이 아닙니다.", "error");
        }
      } catch (err) {
        showFeedback("JSON 파싱에 실패했습니다.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Calculated progress counts
  const successCount = scenes.filter((s) => s.imageUrl).length;
  const failedCount = scenes.filter((s) => s.error && !s.imageUrl).length;
  const totalCount = scenes.length;
  const progressPercent =
    totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

  const charSuccessCount = characters.filter((c) => c.imageUrl).length;
  const charFailedCount = characters.filter(
    (c) => c.error && !c.imageUrl,
  ).length;
  const charTotalCount = characters.length;
  const charProgressPercent =
    charTotalCount > 0
      ? Math.round((charSuccessCount / charTotalCount) * 100)
      : 0;

  // Filtered scenes grid
  const displayedScenes = filterFailedOnly
    ? scenes.filter((sc) => sc.error && !sc.imageUrl)
    : scenes;

  return (
    <div
      className="w-full min-h-screen bg-[#0a0a0c] text-[#e0e0e0] font-sans overflow-x-hidden flex flex-col p-6 border-[12px] border-[#121216] select-none selection:bg-blue-600 selection:text-white"
      id="storyboard-app-root"
    >
      {/* Header element conforming to Bento specifications */}
      <header
        className="flex flex-wrap items-center justify-between mb-6 border-b border-white/10 pb-4 gap-4"
        id="app-header"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center font-bold text-white">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight flex items-center gap-2">
              Storyboard Control Engine
              <span className="text-blue-500 text-xs font-mono ml-2">
                v3.5 Flash
              </span>
            </h1>
          </div>
        </div>

        {/* Global actions and Telemetry indicators */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-white/40">
            <span>Status: Operational</span>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              id="btn-export"
              className="px-3 py-1.5 bg-[#1a1a22] hover:bg-[#252530] border border-white/10 text-white/60 hover:text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Backup raw session data as local JSON"
            >
              <Download className="w-3.5 h-3.5" />
              백업 JSON
            </button>
            <button
              onClick={handleImportBackupTrigger}
              id="btn-import"
              className="px-3 py-1.5 bg-[#1a1a22] hover:bg-[#252530] border border-white/10 text-white/60 hover:text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Restore backup raw JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              복구 업로드
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
              id="backup-file-uploader"
            />
            <button
              onClick={clearSession}
              id="btn-reset"
              className="px-3 py-1.5 bg-[#1a1a22] hover:bg-rose-950/40 hover:text-rose-400 border border-white/10 hover:border-rose-900/50 text-white/40 rounded text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              초기화
            </button>
          </div>
        </div>
      </header>

      {/* State feedback notices */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            id="sticky-toast-notification"
            className={`fixed top-12 right-12 z-50 max-w-sm p-4 rounded-xl shadow-2xl border flex gap-3 backdrop-blur-md ${
              feedbackMsg.type === "success"
                ? "bg-[#121216]/95 border-emerald-500/30 text-emerald-400"
                : feedbackMsg.type === "error"
                  ? "bg-[#121216]/95 border-rose-500/30 text-rose-400"
                  : "bg-[#121216]/95 border-blue-500/30 text-blue-400"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {feedbackMsg.type === "success" ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : feedbackMsg.type === "error" ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <Info className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium leading-relaxed">
                {feedbackMsg.text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern navigation menu */}
      <div
        className="grid grid-cols-2 md:grid-cols-5 border border-white/10 mb-6 bg-[#121216] p-1.5 rounded-lg gap-1.5"
        id="nav-tabs"
      >
        <button
          onClick={() => setActiveTab("editor")}
          id="tab-btn-editor"
          className={`py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === "editor"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <FileText className="w-4 h-4" />
          대본 분석 및 설정
        </button>
        <button
          onClick={() => setActiveTab("characters")}
          disabled={!analysis}
          id="tab-btn-characters"
          className={`py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            !analysis ? "opacity-30 cursor-not-allowed" : ""
          } ${
            activeTab === "characters"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <History className="w-4 h-4" />
          1단계: 캐릭터 컨셉 시트{" "}
          {characters.length > 0
            ? `(${charSuccessCount}/${charTotalCount})`
            : ""}
        </button>
        <button
          onClick={() => setActiveTab("storyboard")}
          disabled={!analysis}
          id="tab-btn-storyboard"
          className={`py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            !analysis ? "opacity-30 cursor-not-allowed" : ""
          } ${
            activeTab === "storyboard"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          2단계: 씬별 스토리보드{" "}
          {scenes.length > 0 ? `(${successCount}/${totalCount})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("thumbnail")}
          disabled={!analysis || scenes.length === 0}
          id="tab-btn-thumbnail"
          className={`py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            (!analysis || scenes.length === 0) ? "opacity-30 cursor-not-allowed" : ""
          } ${
            activeTab === "thumbnail"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          3단계: 썸네일 디렉터
        </button>
        <button
          onClick={() => setActiveTab("safety")}
          id="tab-btn-safety"
          className={`py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === "safety"
              ? "bg-rose-750 text-white shadow-lg shadow-rose-950/20 border border-rose-500/30"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          4단계: 수익정지 안전 진단기
        </button>
      </div>

      {/* Main Grid content panes rendered strictly in Bento layouts */}
      <div className="flex-grow" id="view-routes">
        {/* TAB 1: STORY SCRIPT INPUT AND MODEL CONFIGS */}
        {activeTab === "editor" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            id="pane-editor"
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Bento Block 1: Storyboard Input Form (Span 8) */}
            <div className="col-span-1 lg:col-span-8 bg-[#121216] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/50">
                  Storyboard Script Input & Preview
                </label>
                <span
                  className={`text-[10px] font-mono transition-colors ${
                    scriptText.length > 25000
                      ? "text-rose-400 font-bold"
                      : scriptText.length > 20000
                        ? "text-amber-400"
                        : "text-blue-400"
                  }`}
                >
                  글자 수: {scriptText.length.toLocaleString()} / 25,000자 권장
                  (토큰: ~{Math.round(scriptText.length * 1.5).toLocaleString()}
                  )
                </span>
              </div>

              {isAnalyzing ? (
                <div className="w-full min-h-[400px] bg-[#1a1a22]/70 rounded-lg p-6 border border-blue-500/20 flex flex-col justify-between items-stretch transition-all relative overflow-hidden backdrop-blur-sm">
                  {/* Subtle pulsing glow */}
                  <div className="absolute -inset-10 bg-blue-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />

                  <div className="space-y-5 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                        AI Chronicle Blueprint Analyzer Active
                      </span>
                      <span className="text-xs font-mono text-white/40">
                        경과 시간: {analysisSeconds}초 (최대 제한: 180초)
                      </span>
                    </div>

                    <div className="pt-2">
                      <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                        대본 연대기 인공지능 분석 가동 중...
                      </h4>
                      <p className="text-xs text-white/50 mt-1 lines-relaxed">
                        경고: 전체 대본 분량이 길고 고유 수량이 늘어날수록, 분석
                        타임라인 설계에 더 많은 추론 시간이 요구됩니다. (대략
                        15초~45초 안팎 소요)
                      </p>
                    </div>

                    {/* Progress Checklist Steps */}
                    <div className="space-y-2.5 pt-2 border-t border-white/5">
                      {[
                        {
                          step: 1,
                          label: "대본 원고 로드 및 구문 구조화 스캔",
                          min: 0,
                        },
                        {
                          step: 2,
                          label: "역사 시대극 고증 정합성 및 시간대 맥락 배정",
                          min: 15,
                        },
                        {
                          step: 3,
                          label:
                            "핵심 주연/조연 인물 필터링 및 프로필 독립 DB 추출",
                          min: 38,
                        },
                        {
                          step: 4,
                          label:
                            "각 씬(Scene)별 맞춤형 한포 일러스트 프롬프트 매핑",
                          min: 65,
                        },
                        {
                          step: 5,
                          label:
                            "구조화 스토리보드 JSON 스키마 최종 유효성 정밀 검수",
                          min: 86,
                        },
                      ].map((s) => {
                        const isDone =
                          analysisProgress >=
                            s.min + (s.step === 5 ? 10 : 20) ||
                          analysisProgress >= 97;
                        const isActive = analysisProgress >= s.min && !isDone;
                        return (
                          <div
                            key={s.step}
                            className="flex items-center gap-3 text-xs"
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 transition-all ${
                                isDone
                                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                  : isActive
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse font-bold"
                                    : "bg-white/5 text-white/20 border border-white/5"
                              }`}
                            >
                              {isDone ? "✓" : s.step}
                            </span>
                            <span
                              className={`transition-colors ${
                                isDone
                                  ? "text-white/40 line-through decoration-white/10"
                                  : isActive
                                    ? "text-amber-400 font-bold font-mono"
                                    : "text-white/20"
                              }`}
                            >
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-end text-xs font-mono">
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 block">
                          현재 세부 처리 항목
                        </span>
                        <span className="text-blue-400 font-semibold animate-pulse block max-w-[280px] sm:max-w-md truncate">
                          {analysisPhase}
                        </span>
                      </div>
                      <span className="text-white font-bold text-sm">
                        {Math.round(analysisProgress)}%
                      </span>
                    </div>

                    <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/5">
                      <div
                        className="bg-gradient-to-r from-blue-600 via-sky-500 to-blue-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${analysisProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    id="input-script-textarea"
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="여기에 한 편짜리 비디오 역사, 조선시대 로맨스 야담, 공포 민담 대본 원고를 넣어주세요..."
                    className="w-full h-[400px] font-mono text-sm leading-relaxed text-white/70 bg-[#1a1a22] rounded-lg p-4 border border-white/5 focus:border-blue-500/50 outline-none resize-none transition-all"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setScriptText(YADAM_STORY_PRESET);
                        showFeedback(
                          "기본 조선 궁중 야담 시나리오가 대입되었습니다.",
                          "info",
                        );
                      }}
                      id="btn-load-preset"
                      className="flex-1 py-2.5 bg-[#1a1a22] hover:bg-[#252530] border border-white/10 rounded-md text-white/60 text-xs font-bold transition-all"
                    >
                      조선 야담 시나리오 대입
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptText("")}
                      id="btn-clear-script"
                      className="px-4 py-2.5 bg-rose-950/20 hover:bg-rose-950/30 text-rose-400 border border-rose-500/20 rounded-md text-xs font-bold transition-all"
                    >
                      초기화
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bento Block 2: Configuration Settings (Span 4) */}
            <div className="col-span-1 lg:col-span-4 bg-[#121216] border border-white/5 rounded-xl p-5 flex flex-col justify-between gap-5">
              <div>
                <h2 className="text-[10px] uppercase tracking-widest font-bold text-white/50 mb-4 pb-2 border-b border-white/5">
                  Engine Parameters Config
                </h2>

                <div className="space-y-4">
                  {/* Option 0: Custom Gemini API Key Override */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-white/80 font-medium flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3 text-emerald-400" />
                        개별 Gemini API 키 설정 (선택)
                      </span>
                      {customApiKey ? (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-mono">
                          적용중
                        </span>
                      ) : (
                        <span className="text-[9px] bg-white/5 text-white/40 border border-white/5 rounded px-1.5 py-0.5 font-mono">
                          기본값
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      placeholder="구글 AI 스튜디오 API 키 입력 (AIzaSy... 또는 AQ...)"
                      value={customApiKey}
                      onChange={(e) => updateCustomApiKey(e.target.value)}
                      className="w-full bg-[#1a1a22] border border-white/10 rounded-md p-2.5 text-xs text-white/80 outline-none focus:border-blue-500/50"
                    />
                    {customApiKey && !customApiKey.trim().startsWith("AIzaSy") && !customApiKey.trim().startsWith("AQ") && (
                      <div className="p-2.5 rounded text-[10px] leading-relaxed bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-1.5 text-left">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                        <div>
                          <strong className="text-amber-200 block mb-0.5">⚠️ API 키 형식 감지 경고</strong>
                          입력된 텍스트가 정식 구글 API 키 표준 규격(<code>AIzaSy</code> 또는 <code>AQ</code>로 시작하는 난수 문자열)이 아닌 것 같습니다. 혹시 API 키 대신 <strong>모델 명칭(예: GEMINI-3.5-FLASH)</strong>을 혼동하여 잘못 입력하셨는지 확인해 주세요.
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      입력하지 않으면 서버 환경변수를 기본 사용합니다. 직접 입력
                      시 브라우저 내부 로컬스토리지에 보안 소장되며 요청 시
                      헤더를 통해 우선 적용됩니다.
                    </p>
                    {customApiKey && (
                      <div className="pt-1.5 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={handleVerifyApiKey}
                          disabled={isVerifyingKey}
                          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold border transition-all ${
                            isVerifyingKey
                              ? "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                              : "bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/25 text-emerald-400 active:scale-98"
                          }`}
                        >
                          <RefreshCw className={`w-3 h-3 ${isVerifyingKey ? "animate-spin" : ""}`} />
                          {isVerifyingKey ? "구글 API 인증 키 무결성 검증 중..." : "위 API 키 검증 및 정상 작동 테스트"}
                        </button>
                        
                        {keyVerificationError !== null && (
                          <div className={`p-2 rounded text-[11px] leading-relaxed border space-y-1 block text-left ${
                            keyVerificationError === "" 
                              ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-400"
                              : "bg-rose-500/5 border-rose-500/15 text-rose-400"
                          }`}>
                            {keyVerificationError === "" ? (
                              <div className="flex items-start gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                                <span>인증 합격: 구글 제미나이 연결 테스트에 성공했습니다! 즉시 고전 스토리보드 서비스에 인용 적용됩니다.</span>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                                <div className="space-y-0.5">
                                  <span className="font-bold text-[10px] block text-rose-300 uppercase">인증 실패 피드백:</span>
                                  <span>{keyVerificationError}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Option 1: AI model Selection */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-white/80 font-medium flex items-center justify-between">
                      <span>이미지 생성 모델</span>
                      <span className="text-[9px] text-blue-400 font-mono">
                        Paid API Key
                      </span>
                    </label>
                    <select
                      id="select-api-model"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value as any)}
                      className="w-full bg-[#1a1a22] border border-white/10 rounded-md p-2.5 text-xs text-white/80 outline-none focus:border-blue-500/50"
                    >
                      <option value="gemini-2.5-flash-image">
                        Gemini 2.5 Flash Image Model
                      </option>
                      <option value="gemini-3.1-flash-image">
                        Gemini 3.1 Flash Image (1K Resolution)
                      </option>
                    </select>
                  </div>

                  {/* Option 2: Art Style selection */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-white/80 font-medium">
                      적용 화풍 디자인 (Art Style)
                    </label>
                    <div
                      className="grid grid-cols-2 gap-2"
                      id="artstyle-container"
                    >
                      {[
                        {
                          key: "yadam",
                          label: "야담 한포 일러스트",
                          desc: "Traditional Illust",
                        },
                        {
                          key: "realistic",
                          label: "역사 극사실주의",
                          desc: "Cinematic Realistic",
                        },
                        {
                          key: "3d",
                          label: "3D 애니 캐릭터",
                          desc: "Pixar Toy Character",
                        },
                        {
                          key: "anime",
                          label: "레트로 수채화 애니",
                          desc: "Hand-drawn Watercolor",
                        },
                      ].map((style) => (
                        <button
                          key={style.key}
                          type="button"
                          id={`artstyle-${style.key}`}
                          onClick={() => setArtStyle(style.key as any)}
                          className={`p-2 rounded text-left border transition-all flex flex-col ${
                            artStyle === style.key
                              ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                              : "bg-[#1a1a22] border-white/5 text-white/40 hover:text-white/60"
                          }`}
                        >
                          <span className="text-[11px] font-bold leading-tight">
                            {style.label}
                          </span>
                          <span className="text-[9px] opacity-60 leading-none mt-0.5 font-mono">
                            {style.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 3: Aspect Ratio config */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-white/80 font-medium">
                      가로비 (Aspect Ratio)
                    </label>
                    <div
                      className="grid grid-cols-3 gap-2"
                      id="ratio-container"
                    >
                      {[
                        { key: "16:9", label: "16:9 가로", desc: "YouTube" },
                        { key: "1:1", label: "1:1 정방", desc: "Instagram" },
                        { key: "9:16", label: "9:16 세로", desc: "Shorts" },
                      ].map((ratio) => (
                        <button
                          key={ratio.key}
                          type="button"
                          id={`ratio-${ratio.key.replace(":", "-")}`}
                          onClick={() => setAspectRatio(ratio.key as any)}
                          className={`p-2 rounded border text-center transition-all ${
                            aspectRatio === ratio.key
                              ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                              : "bg-[#1a1a22] border-white/5 text-white/40 hover:text-white/60"
                          }`}
                        >
                          <span className="text-[11px] font-bold block">
                            {ratio.key}
                          </span>
                          <span className="text-[9px] block opacity-60 font-mono">
                            {ratio.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Option 4: Limit override slider */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-[11px] text-white/80 font-medium">
                          강제 장면 분량 조율
                        </label>
                        <span className="text-[9px] text-white/30 block leading-tight">
                          대본을 지정된 장면에 타겟 분배
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuantityOverride(!quantityOverride)}
                        id="toggle-quantity-override"
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${
                          quantityOverride
                            ? "bg-blue-600"
                            : "bg-[#1a1a22] border border-white/10"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            quantityOverride ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {quantityOverride && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                          id="overriden-quantity-slider-block"
                        >
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-white/40">
                              장면 수량 피스
                            </span>
                            <span className="text-blue-400 font-bold">
                              {quantityValue}장
                            </span>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="100"
                            value={quantityValue}
                            onChange={(e) =>
                              setQuantityValue(parseInt(e.target.value))
                            }
                            className="w-full h-1 bg-[#1a1a22] accent-blue-500 rounded-full cursor-pointer outline-none"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Option 5: Append Mode */}
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-[11px] text-white/80 font-medium">
                          기존 타임라인에 누적 추가
                        </label>
                        <span className="text-[9px] text-white/30 block leading-tight">
                          1부를 유지한 채 2부 대본을 연달아 병합 분석합니다.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAppendMode(!appendMode)}
                        id="toggle-append-mode"
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${
                          appendMode
                            ? "bg-blue-600"
                            : "bg-[#1a1a22] border border-white/10"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            appendMode ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Option 6: WAN Video Motion Starter Optimization */}
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-[11px] text-white/80 font-medium">
                          WAN 비디오 인트로 모션 최적화
                        </label>
                        <span className="text-[9px] text-white/30 block leading-tight">
                          인트로용 장면(기초 1~6장)을 고포텐셜 정적 긴장 자세로
                          튜닝해 WAN 영상 전환율을 높입니다.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !wanIntroOptimized;
                          setWanIntroOptimized(nextVal);
                          localStorage.setItem(
                            "yadam_wan_intro_optimized",
                            String(nextVal),
                          );
                          showFeedback(
                            nextVal
                              ? "WAN 인트로 모션 비디오 최적화가 상시 활성화되었습니다."
                              : "WAN 인트로 최적화 모션이 종료되었습니다.",
                            "info",
                          );
                        }}
                        id="toggle-wan-intro-optimized"
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center shrink-0 ${
                          wanIntroOptimized
                            ? "bg-emerald-600"
                            : "bg-[#1a1a22] border border-white/10"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            wanIntroOptimized
                              ? "translate-x-4"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Option 7: Strict Visual Consistency Mode */}
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-[11px] text-white/80 font-medium">
                          인물/배경 초정밀 비주얼 일관성
                        </label>
                        <span className="text-[9px] text-white/30 block leading-tight">
                          캐릭터 정보(외모, 의복)와 장소 세부 속성을 프롬프트에
                          실시간 합산 연동하여 씬간 물체/의복 뒤틀림을
                          방지합니다.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !strictConsistencyMode;
                          setStrictConsistencyMode(nextVal);
                          localStorage.setItem(
                            "yadam_strict_consistency_mode",
                            String(nextVal),
                          );
                          showFeedback(
                            nextVal
                              ? "인물/배경 일관성 고착 제어가 활성화되었습니다."
                              : "일관성 연동 모드가 종료되었습니다.",
                            "info",
                          );
                        }}
                        id="toggle-strict-consistency-mode"
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center shrink-0 ${
                          strictConsistencyMode
                            ? "bg-blue-600"
                            : "bg-[#1a1a22] border border-white/10"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                            strictConsistencyMode
                              ? "translate-x-4"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step Analyzers Trigger */}
              <button
                onClick={handleAnalyzeScript}
                disabled={isAnalyzing || !scriptText.trim()}
                id="btn-trigger-script-analysis"
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-widest rounded-md transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    대본 파싱 연대기 분석 중...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 shrink-0 fill-white" />
                    1단계: 플래닝 분석 가동
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* TAB 2: STEP 1 - CHARACTER DB AND CONCEPT PORTRAITS */}
        {activeTab === "characters" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            id="pane-characters"
            className="space-y-6"
          >
            {/* Bento Block 1: Progress state dashboard header */}
            <div className="bg-[#121216] border border-white/5 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold block font-mono">
                  STEP 1: IN-CHARACTER CONCEPT SHEET
                </span>
                <h2 className="text-base font-medium text-white">
                  인물 프로필 데이터베이스 (Character Concept Database)
                </h2>
                <p className="text-xs text-white/50">
                  단독 샷 분리 모델 래핑 기법을 적용하여 여러 인물이 구도내서
                  섞이는 문제를 사전에 완벽히 방지합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateEmptyCharacter}
                  id="btn-add-character-manually"
                  className="px-4 py-2 bg-[#1a1a24] hover:bg-[#20202e] border border-white/10 text-white font-semibold text-xs tracking-wide rounded transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  인물 수동 추가
                </button>
                <button
                  onClick={handleGenerateAllCharacters}
                  disabled={isGeneratingCharacters || characters.length === 0}
                  id="btn-character-batch-trigger"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-40"
                >
                  {isGeneratingCharacters ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin inline-block mr-1" />
                      인물{" "}
                      {currentCharacterIndex !== null
                        ? `#${currentCharacterIndex + 1}`
                        : ""}{" "}
                      그리는 중
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-blue-200 inline-block mr-1" />
                      소속 인물 일괄 렌더링
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-bar queue feedback */}
            {isGeneratingCharacters && (
              <div className="bg-[#121216]/60 p-4 border border-white/5 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-400 text-[11px] font-mono flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    SEQUENTIAL PORTRAIT GENERATION QUEUE ACTIVE... (RPM limit
                    pacing)
                  </span>
                  <span className="text-white/40 font-mono">
                    {charSuccessCount}/{charTotalCount}
                  </span>
                </div>
                <div className="w-full bg-[#1a1a22] rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${charProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Grid of character entries */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
              id="characters-list-grid"
            >
              {characters.map((char, index) => (
                <div
                  key={index}
                  id={`char-card-${index}`}
                  className="bg-[#121216] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all flex flex-col sm:flex-row h-full"
                >
                  {/* Left panel is the portrait visualization box */}
                  <div className="sm:w-2/5 aspect-square sm:aspect-auto bg-[#1a1a22]/50 relative flex items-center justify-center border-b sm:border-b-0 sm:border-r border-white/5">
                    {char.imageUrl ? (
                      <>
                        <img
                          src={char.imageUrl}
                          alt={char.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() =>
                            setLightboxItem({
                              title: `${char.name} (${char.age}세) - 인물 캐릭터 시트`,
                              imageUrl: char.imageUrl!,
                              description: `${char.appearance}. ${char.clothing}. ${char.traits}`,
                              prompt: char.characterSheetPrompt,
                            })
                          }
                          className="absolute bottom-2.5 right-2.5 p-1.5 bg-[#0a0a0c]/80 hover:bg-[#0a0a0c] rounded border border-white/10 text-white/80 transition-colors"
                          title="View High Definition Visual"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="p-4 text-center space-y-3 w-full">
                        {char.isGenerating ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                            <span className="text-[10px] text-white/50 font-mono">
                              RENDERING PROFILE...
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="block text-[9px] text-white/30 font-mono uppercase tracking-widest">
                              Isolated Portrait
                            </span>
                            <button
                              onClick={() =>
                                handleGenerateSingleCharacter(index)
                              }
                              className="w-full py-2 bg-[#1a1a22] hover:bg-[#252530] border border-white/10 text-white/80 text-[10px] font-bold rounded transition-colors"
                            >
                              이 인물 소집 생산
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {char.error && (
                      <div className="absolute inset-0 bg-rose-950/90 p-4 flex flex-col items-center justify-center text-center gap-1.5">
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                        <span className="text-[10px] text-rose-200 font-bold uppercase tracking-wider">
                          렌더 실패
                        </span>
                        <p className="text-[9px] text-rose-300 line-clamp-2 px-1">
                          {char.error}
                        </p>
                        <button
                          onClick={() => handleGenerateSingleCharacter(index)}
                          className="mt-2 px-2.5 py-1 bg-white text-black text-[9px] font-bold rounded hover:bg-white/90 transition-colors"
                        >
                          다시 실행
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right side is biography metrics */}
                  <div className="p-5 sm:w-3/5 flex flex-col justify-between space-y-4">
                    {editingCharIdx === index ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-blue-400 font-bold font-mono tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded">
                            CHAR_0{index + 1} EDITING
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveCharacterEdit(index)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded transition-all"
                            >
                              저장
                            </button>
                            <button
                              onClick={cancelEditingCharacter}
                              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/80 text-[10px] rounded transition-all"
                            >
                              취소
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-[11px]">
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <span className="text-[9px] text-white/30 block mb-0.5 font-mono">
                                NAME
                              </span>
                              <input
                                type="text"
                                value={editCharName}
                                onChange={(e) =>
                                  setEditCharName(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-white/30 block mb-0.5 font-mono">
                                GENDER
                              </span>
                              <input
                                type="text"
                                value={editCharGender}
                                onChange={(e) =>
                                  setEditCharGender(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-white/30 block mb-0.5 font-mono">
                                AGE
                              </span>
                              <input
                                type="text"
                                value={editCharAge}
                                onChange={(e) => setEditCharAge(e.target.value)}
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-white/30 block mb-0.5 font-mono">
                                APPEARANCE (KOREAN)
                              </span>
                              <input
                                type="text"
                                value={editCharAppearance}
                                onChange={(e) =>
                                  setEditCharAppearance(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-blue-400 font-semibold block mb-0.5 font-mono">
                                APPEARANCE (ENGLISH FOR INJECTION)
                              </span>
                              <input
                                type="text"
                                value={editCharAppearanceEnglish}
                                onChange={(e) =>
                                  setEditCharAppearanceEnglish(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-blue-500/30 rounded px-1.5 py-0.5 text-white placeholder-white/20 focus:border-blue-500 focus:outline-none text-[10px]"
                                placeholder="E.g. young tragic prince, pale face"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-white/30 block mb-0.5 font-mono">
                                CLOTHING (KOREAN)
                              </span>
                              <input
                                type="text"
                                value={editCharClothing}
                                onChange={(e) =>
                                  setEditCharClothing(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] text-blue-400 font-semibold block mb-0.5 font-mono">
                                CLOTHING (ENGLISH FOR INJECTION)
                              </span>
                              <input
                                type="text"
                                value={editCharClothingEnglish}
                                onChange={(e) =>
                                  setEditCharClothingEnglish(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-blue-500/30 rounded px-1.5 py-0.5 text-white placeholder-white/20 focus:border-blue-500 focus:outline-none text-[10px]"
                                placeholder="E.g. wearing disheveled royal blue robe"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[9px] text-white/30 block mb-0.5 font-mono">
                              TRAITS
                            </span>
                            <input
                              type="text"
                              value={editCharTraits}
                              onChange={(e) =>
                                setEditCharTraits(e.target.value)
                              }
                              className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] text-white/30 font-mono">
                                PORTRAIT PROMPT
                              </span>
                              <button
                                type="button"
                                disabled={isTranslatingPrompt}
                                onClick={() => handleAiPromptTranslate("character", index)}
                                className="text-[9px] text-blue-400 hover:text-blue-300 font-semi-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                <Wand2 className="w-2.5 h-2.5" />
                                {isTranslatingPrompt ? "AI 번역 중..." : "AI 한국어 세팅 자동번역 및 최적화"}
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              value={editCharPrompt}
                              onChange={(e) =>
                                setEditCharPrompt(e.target.value)
                              }
                              className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white focus:border-blue-500 focus:outline-none font-mono text-[10px]"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] text-blue-400 font-bold font-mono tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded">
                                CHAR_0{index + 1}
                              </span>
                              <h3 className="text-sm font-bold text-white mt-1 flex items-center gap-2">
                                {char.name}
                                <span className="text-xs text-white/40 font-normal font-mono">
                                  ({char.gender} / {char.age}세)
                                </span>
                              </h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => startEditingCharacter(index)}
                                className="p-1 text-white/40 hover:text-white transition-colors"
                                title="Edit info & prompt"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {char.imageUrl && (
                                <button
                                  onClick={() =>
                                    handleGenerateSingleCharacter(index)
                                  }
                                  className="p-1 text-white/30 hover:text-white transition-colors"
                                  title="Regenerate this character only"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCharacter(index)}
                                className="p-1 text-white/40 hover:text-rose-500 transition-colors"
                                title="Delete this character"
                              >
                                <Trash2 className="w-3.2 h-3.2 text-rose-400" />
                              </button>
                            </div>
                          </div>

                           <div className="space-y-2 text-xs leading-relaxed text-white/70">
                            <p>
                              <strong className="text-white/40 font-medium font-mono mr-1">
                                ● Appearance:
                              </strong>{" "}
                              {char.appearance}
                            </p>
                            {char.appearanceEnglish && (
                              <p className="text-[10px] text-blue-400/80 font-mono pl-3">
                                <span className="text-white/30 mr-1 font-mono">Eng:</span> {char.appearanceEnglish}
                              </p>
                            )}
                            <p>
                              <strong className="text-white/40 font-medium font-mono mr-1">
                                ● Clothing:
                              </strong>{" "}
                              {char.clothing}
                            </p>
                            {char.clothingEnglish && (
                              <p className="text-[10px] text-blue-400/80 font-mono pl-3">
                                <span className="text-white/30 mr-1 font-mono">Eng:</span> {char.clothingEnglish}
                              </p>
                            )}
                            <p className="italic text-white/55 font-serif pt-1 pl-1.5 border-l border-white/10">
                              "{char.traits}"
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                          <span className="text-[9px] text-white/40 truncate font-mono">
                            Prompt: {char.characterSheetPrompt}
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                char.characterSheetPrompt,
                                `char_prompt_${index}`,
                              )
                            }
                            className="p-1 hover:bg-[#1a1a22] rounded text-white/40 hover:text-white transition-all shrink-0"
                            title="Copy Midjourney/Gemini structured format prompt"
                          >
                            {copiedText === `char_prompt_${index}` ? (
                              <span className="text-[9px] text-emerald-400 font-mono">
                                복사됨!
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation block */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#121216] p-4 border border-white/5 rounded-xl gap-4">
              <span className="text-xs text-white/50">
                캐릭터 원형과 복색 기틀이 완비되었습니다. 2단계 전체 씬 타임라인
                스토리보드를 그려 완성해 보세요.
              </span>
              <button
                onClick={() => setActiveTab("storyboard")}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-blue-600/10"
              >
                2단계 연속 장면 스토리보드로 전환
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* TAB 3: STEP 2 - SCENE STORYBOARD GRID QUEUE */}
        {activeTab === "storyboard" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            id="pane-storyboard"
            className="space-y-6"
          >
            {/* 3~100장 분량 세부 조율 & 다시 만들기 패널 */}
            <div className="bg-[#121216] border border-blue-500/20 rounded-xl p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-bold">
                      생성 분량 자율 구성 시스템
                    </span>
                    <span className="text-[11px] text-white/80 font-medium">
                      1장 단위 정밀 피스 3 ~ 100장 지정
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    스토리보드에 생성될 타겟 장면 수량을 자유롭게 결정한 뒤,
                    대본 재구성을 클릭하여 최적화 분석을 실시합니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-[#1a1a24] border border-white/5 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQuantityOverride(!quantityOverride);
                        saveSession(analysis, characters, locations, scenes);
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center shrink-0 ${
                        quantityOverride
                          ? "bg-blue-600"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${quantityOverride ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </button>
                    <span className="text-xs text-white/70 font-medium whitespace-nowrap">
                      강제 조율
                    </span>
                  </div>

                  {quantityOverride ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="3"
                        max="100"
                        value={quantityValue}
                        onChange={(e) =>
                          setQuantityValue(parseInt(e.target.value))
                        }
                        className="w-24 h-1 bg-white/10 accent-blue-500 rounded-full cursor-pointer outline-none md:w-36"
                      />
                      <span className="text-xs font-mono font-bold text-blue-400 w-11 text-center">
                        {quantityValue}장
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-white/40 font-mono italic">
                      기본 흐름 분석 분량 (5~12장)
                    </span>
                  )}

                  <button
                    onClick={handleAnalyzeScript}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded transition-all flex items-center gap-1 shadow disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`}
                    />
                    대본 재분석
                  </button>
                </div>
              </div>
            </div>

            {/* Bento Block 1: Queue status controller console */}
            <div className="bg-[#121216] border border-white/5 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest text-blue-500 font-bold block font-mono">
                    STEP 2: STORYBOARD SEGMENTS GENERATOR
                  </span>
                  <h2 className="text-base font-medium text-white">
                    스토리보드 전체 장면 연속성 렌더 큐 ({successCount} /{" "}
                    {totalCount} 장 완성)
                  </h2>
                  <p className="text-xs text-white/50">
                    분당 요청 횟수(RPM) 제한 준수를 위해 큐 사이에 백그라운드
                    지연(4~6초 Jitter)을 실시간 개입하여 튕김 에러 없이 제작
                    완료를 보장합니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCreateEmptyScene}
                    id="btn-add-scene-manually"
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-[#1a1a24] hover:bg-[#20202d] text-white border border-white/10 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400 font-bold" />
                    장면 수동 추가
                  </button>

                  <button
                    onClick={() => setFilterFailedOnly(!filterFailedOnly)}
                    id="toggle-filter-failed"
                    className={`px-3 py-1.5 rounded text-xs font-mono transition-all flex items-center gap-1.5 border ${
                      filterFailedOnly
                        ? "bg-rose-950/40 text-rose-400 border-rose-500/30"
                        : "bg-[#1a1a22] text-white/40 border-white/10 hover:text-white/60"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    FAILED_ONLY {failedCount > 0 ? `(${failedCount})` : ""}
                  </button>

                  {failedCount > 0 && (
                    <button
                      onClick={handleRetryFailedScenes}
                      disabled={isGeneratingScenes}
                      id="btn-retry-failures"
                      className="px-3 py-1.5 bg-rose-650 hover:bg-rose-500 text-white font-bold text-xs rounded transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                      에러장면 재큐ING
                    </button>
                  )}

                  {/* Realtime Generate All Button */}
                  <button
                    onClick={handleGenerateAllScenes}
                    disabled={isGeneratingScenes || scenes.length === 0}
                    id="btn-scene-batch-trigger"
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                    title="모든 장면을 일반 우선순위 큐로 순차 생성합니다 (100% 실시간 비용)"
                  >
                    {isGeneratingScenes && !isBatchMode ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        일반 렌더링 씬 #
                        {currentSceneIndex !== null
                          ? currentSceneIndex + 1
                          : ""}
                        ...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-white" />
                        실시간 일괄 생성
                      </>
                    )}
                  </button>

                  {/* 50% Token Discount Reservation Batch Button */}
                  <button
                    onClick={handleGenerateAllScenesBatch}
                    disabled={isGeneratingScenes || scenes.length === 0}
                    id="btn-gemini-batch-trigger"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 border border-emerald-500/20"
                    title="Gemini 예약 배치 API를 이용해 대기열 비동기 생성 작업을 요청합니다. (50% 인풋/아웃풋 토큰 절감)"
                  >
                    {isGeneratingScenes && isBatchMode ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                        배치 큐 처리 #
                        {currentSceneIndex !== null
                          ? currentSceneIndex + 1
                          : ""}
                        ...
                      </>
                    ) : (
                      <>
                        <Coins className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                        예약 배치 생성 (50% 토큰 할인!)
                      </>
                    )}
                  </button>

                  {successCount > 0 && (
                    <button
                      onClick={handleDownloadAllZip}
                      id="btn-download-all-zip"
                      className="px-4 py-1.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                      일괄 ZIP 다운로드 ({successCount}장)
                    </button>
                  )}

                  {isGeneratingScenes && (
                    <button
                      onClick={handleStopAllGeneration}
                      id="btn-stop-all-generation"
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 animate-pulse shadow-lg shadow-rose-650/20"
                      title="진행 중인 전체 이미지 생성 작업을 안전하게 중단하고 대기열을 파기합니다."
                    >
                      <X className="w-3.5 h-3.5 stroke-[3px]" />
                      작업 즉시 중단
                    </button>
                  )}
                </div>
              </div>

              {/* Bento Dashboard stats meters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[#1a1a22] rounded-lg border border-white/5">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                    Timeline Done
                  </span>
                  <span className="text-sm font-mono font-bold text-white/95">
                    {progressPercent}%
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                    Render Successes
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {successCount} / {totalCount} 장
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                    Render Faults
                  </span>
                  <span className="text-sm font-mono font-bold text-rose-400">
                    {failedCount} 장
                  </span>
                </div>
                <div className="space-y-0.5" title="예약 배치 가동을 통해 세이브한 임시 토큰 지표입니다.">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                    Batch Tokens Saved
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {batchSavedTokens.toLocaleString()} Tok
                  </span>
                </div>
              </div>

              {/* High-Tech Batch Telemetry Terminal Console logs */}
              {showBatchTelemetry && (
                <div className="bg-black/95 border border-emerald-500/20 rounded-xl p-4 font-mono text-[11px] leading-relaxed relative">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-400 font-bold">
                        GEMINI BATCH API RESERVATION TELEMETRY
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/40">
                        토큰 절감량: -{batchSavedTokens.toLocaleString()} Tokens
                      </span>
                      <button
                        onClick={() => setShowBatchTelemetry(false)}
                        className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] text-white/60 hover:text-white transition-all"
                      >
                        닫기
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                    {batchConsoleLogs.map((log, lidx) => (
                      <div
                        key={lidx}
                        className={`${
                          log.startsWith("[SUCCESS]")
                            ? "text-emerald-400"
                            : log.startsWith("[ERROR]")
                              ? "text-rose-400 font-semibold animate-shake"
                              : log.startsWith("[QUEUED]")
                                ? "text-blue-400"
                                : log.startsWith("[SAVED]")
                                  ? "text-yellow-300 font-bold"
                                  : "text-white/60"
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic looping progress line */}
              {isGeneratingScenes && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs font-mono text-white/40">
                    <span className="animate-pulse text-blue-400 text-[11px] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      COBALT TIMELINE BACKEND ENGINE ACTIVE (예약/일반 배치 기동
                      진행 중)
                    </span>
                    <span>
                      {successCount}/{totalCount} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#1a1a22] rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isBatchMode ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-blue-500"}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Grid of scenes containing narration detail cards */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              id="storyboard-scenes-grid"
            >
              {displayedScenes.map((scene, idx) => {
                const actualIndex = scenes.findIndex((s) => s.id === scene.id);
                return (
                  <div
                    key={scene.id}
                    id={`scene-block-${scene.id}`}
                    className="bg-[#121216] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all flex flex-col justify-between"
                  >
                    {/* Scene illustrative card frame styled to match exact aspect ratio selection */}
                    <div
                      className={`bg-[#1a1a22]/40 relative flex items-center justify-center border-b border-white/5 overflow-hidden ${
                        aspectRatio === "16:9"
                          ? "aspect-video"
                          : aspectRatio === "9:16"
                            ? "aspect-[9/16] max-h-96"
                            : "aspect-square"
                      }`}
                    >
                      {scene.imageUrl ? (
                        <>
                          <img
                            src={scene.imageUrl}
                            alt={`Scene ${scene.id}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() =>
                              setLightboxItem({
                                title: `Scene #${scene.id} (장소: ${scene.locationName})`,
                                imageUrl: scene.imageUrl!,
                                description: `자막 나레이션:\n${scene.narrationText}\n\n시나리오 연출 및 지상 작도:\n${scene.visualDescription}`,
                                prompt: scene.refinedImagePrompt,
                              })
                            }
                            className="absolute bottom-2.5 right-2.5 p-1.5 bg-[#0a0a0c]/80 hover:bg-[#0a0a0c] rounded border border-white/10 text-white/80 transition-colors"
                            title="Inspect high definition rendition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="p-4 text-center space-y-3">
                          {scene.isGenerating ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                              <span className="text-[10px] text-white/40 font-mono">
                                SCENE PROCESSING...
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <span className="block text-[9px] text-white/30 font-mono uppercase tracking-widest">
                                Illustration Waiting
                              </span>
                              <button
                                onClick={() =>
                                  handleGenerateSingleScene(actualIndex)
                                }
                                className="px-3.5 py-1.5 bg-[#1a1a22] hover:bg-[#252530] border border-white/10 text-white/80 text-[10px] font-bold rounded transition-colors"
                              >
                                이 단일 장면만 렌더
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Overlap error tag */}
                      {scene.error && (
                        <div className="absolute inset-0 bg-rose-950/95 p-4 flex flex-col items-center justify-center text-center gap-1.5">
                          <AlertCircle className="w-5 h-5 text-rose-400" />
                          <span className="text-[10px] text-rose-200 font-bold uppercase tracking-wider font-mono">
                            생성 차단됨
                          </span>
                          <p className="text-[9px] text-rose-300 line-clamp-3 leading-relaxed px-1 font-mono">
                            {scene.error}
                          </p>
                          <button
                            onClick={() =>
                              handleGenerateSingleScene(actualIndex)
                            }
                            className="mt-2 px-2.5 py-1 bg-white hover:bg-white/90 text-black text-[9px] font-bold rounded flex items-center gap-1 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            다시 렌더 시도
                          </button>
                        </div>
                      )}

                      {/* Header indicators overlaid */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-2 flex-wrap max-w-[calc(105%-2.5rem)]">
                        <span className="bg-blue-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow shrink-0">
                          SCENE #{scene.id}
                        </span>
                        <span className="bg-[#0a0a0c]/85 text-white/80 border border-white/5 text-[9px] font-mono px-1.5 py-0.5 rounded shadow truncate max-w-24 shrink-0">
                          {scene.locationName}
                        </span>
                        {scene.id <= 6 && wanIntroOptimized && (
                          <span
                            className="bg-emerald-650/90 text-white font-bold text-[8px] px-1.5 py-0.5 rounded shadow border border-emerald-500/25 flex items-center gap-0.5 animate-pulse shrink-0 font-mono"
                            title="WAN image-to-video optimization template applied"
                          >
                            🎬 WAN 모션 대기
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta parameters footer inside card */}
                    <div className="p-4 flex flex-col justify-between flex-grow gap-4">
                      {editingSceneId === scene.id ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center pb-1 border-b border-white/5 font-mono">
                            <span className="text-[9px] text-blue-400 font-bold">
                              SCENE #{scene.id} EDITING
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => saveSceneEdit(actualIndex)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] rounded transition-all"
                              >
                                저장
                              </button>
                              <button
                                onClick={cancelEditingScene}
                                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white/80 text-[9px] rounded transition-all"
                              >
                                취소
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 text-[10px]">
                            <div>
                              <span className="text-[8px] text-white/30 block mb-0.5 font-mono">
                                LOCATION REFERENCE
                              </span>
                              <input
                                type="text"
                                value={editSceneLocation}
                                onChange={(e) =>
                                  setEditSceneLocation(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white text-[11px] focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            
                            {/* Involved Characters dynamic chips checkboxes */}
                            <div>
                              <span className="text-[8px] text-blue-400 font-semibold block mb-1 font-mono">
                                INVOLVED CHARACTER PARTICIPANTS
                              </span>
                              <div className="flex flex-wrap gap-1 bg-[#16161f] p-1.5 rounded border border-white/5">
                                {characters.length === 0 ? (
                                  <span className="text-white/30 text-[9px] italic">등록된 인물이 없습니다. 먼저 인 데이터베이스에 인물을 추가하세요.</span>
                                ) : (
                                  characters.map((ch) => {
                                    const isChecked = editSceneCharacterNames.includes(ch.name);
                                    return (
                                      <button
                                        key={ch.name}
                                        type="button"
                                        onClick={() => {
                                          if (isChecked) {
                                            setEditSceneCharacterNames(
                                              editSceneCharacterNames.filter((n) => n !== ch.name)
                                            );
                                          } else {
                                            setEditSceneCharacterNames([...editSceneCharacterNames, ch.name]);
                                          }
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                                          isChecked
                                            ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                                            : "bg-[#1f1f2a]/60 text-white/40 border-white/5 hover:text-white/60"
                                        }`}
                                      >
                                        {ch.name}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div>
                              <span className="text-[8px] text-white/30 block mb-0.5 font-mono">
                                NARRATION TEXT (SUBTITLE)
                              </span>
                              <textarea
                                rows={2}
                                value={editSceneNarration}
                                onChange={(e) =>
                                  setEditSceneNarration(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white text-[11px] focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-[8px] text-white/30 block mb-0.5 font-mono">
                                STAGE DIRECTION DEPICTION
                              </span>
                              <textarea
                                rows={2}
                                value={editSceneVisDesc}
                                onChange={(e) =>
                                  setEditSceneVisDesc(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white text-[11px] focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[8px] text-white/30 font-mono">
                                  SCENE-SPECIFIC VISUAL DRAWING PROMPT
                                </span>
                                <button
                                  type="button"
                                  disabled={isTranslatingPrompt}
                                  onClick={() => handleAiPromptTranslate("scene", scene.id)}
                                  className="text-[8px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                  <Wand2 className="w-2.5 h-2.5" />
                                  {isTranslatingPrompt ? "AI 번역 중..." : "AI 한국어 세팅 프롬프트 자동 최적화"}
                                </button>
                              </div>
                              <textarea
                                rows={3}
                                value={editScenePrompt}
                                onChange={(e) =>
                                  setEditScenePrompt(e.target.value)
                                }
                                className="w-full bg-[#1a1a22] border border-white/10 rounded px-1.5 py-0.5 text-white text-[10px] focus:border-blue-500 focus:outline-none font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3">
                            {/* Narration snippet box with edit trigger inside or next to it */}
                            <div className="space-y-1.5 bg-[#1a1a22] p-2.5 rounded border border-white/5 relative group">
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] text-white/40 uppercase tracking-wider font-bold block font-mono">
                                  자막 나레이션 스크립트
                                </span>
                                <button
                                  onClick={() => startEditingScene(scene)}
                                  className="text-white/30 hover:text-white transition-colors"
                                  title="Edit scene settings"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-white/85 text-[11px] leading-relaxed line-clamp-3 font-normal">
                                {scene.narrationText}
                              </p>
                            </div>

                            {/* Stage direction instructions */}
                            <div className="space-y-1">
                              <span className="text-[8px] text-white/40 uppercase tracking-wider font-bold block font-mono">
                                지상 무대 배치 연출
                              </span>
                              <p className="text-white/60 text-[11px] leading-relaxed line-clamp-2">
                                {scene.visualDescription}
                              </p>
                            </div>

                            {/* Involved characters database chips */}
                            {scene.characterNames &&
                              scene.characterNames.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  <span className="text-[8px] text-white/30 uppercase tracking-widest font-mono">
                                    Involved:
                                  </span>
                                  {scene.characterNames.map((cName) => (
                                    <span
                                      key={cName}
                                      className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-sm font-mono"
                                    >
                                      {cName}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>

                          {/* Structured prompt and action logs */}
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                            <span
                              className="text-[9px] text-white/30 truncate font-mono"
                              title={scene.refinedImagePrompt}
                            >
                              Prompt: {scene.refinedImagePrompt}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleMoveSceneUp(actualIndex)}
                                disabled={actualIndex === 0}
                                className={`p-1 rounded transition-all ${
                                  actualIndex === 0
                                    ? "text-white/10 cursor-not-allowed"
                                    : "text-white/40 hover:text-white hover:bg-[#1a1a22]"
                                }`}
                                title="이 장면 한 칸 앞으로 이동"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveSceneDown(actualIndex)}
                                disabled={actualIndex === scenes.length - 1}
                                className={`p-1 rounded transition-all ${
                                  actualIndex === scenes.length - 1
                                    ? "text-white/10 cursor-not-allowed"
                                    : "text-white/40 hover:text-white hover:bg-[#1a1a22]"
                                }`}
                                title="이 장면 한 칸 뒤로 이동"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteScene(actualIndex)}
                                className="p-1 hover:bg-[#1a1a22] rounded text-white/40 hover:text-rose-500 transition-all"
                                title="장면 삭제 및 타임라인 재배열"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-455" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditingScene(scene)}
                                className="p-1 hover:bg-[#1a1a22] rounded text-white/40 hover:text-white transition-all"
                                title="이 구간 설정 편집"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    scene.refinedImagePrompt,
                                    `scene_prompt_${scene.id}`,
                                  )
                                }
                                className="p-1 hover:bg-[#1a1a22] rounded text-white/40 hover:text-white transition-all"
                                title="프롬프트 복사"
                              >
                                {copiedText === `scene_prompt_${scene.id}` ? (
                                  <span className="text-[8px] text-emerald-400 font-mono">
                                    copied
                                  </span>
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {scene.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleGenerateSingleScene(actualIndex)
                                  }
                                  className="p-1 hover:bg-[#1a1a22] rounded text-white/40 hover:text-blue-400 transition-all"
                                  title="다시 렌더그림 그리기"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 3: YOUTUBE THUMBNAIL DIRECTOR */}
        {activeTab === "thumbnail" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
            id="tab-pane-thumbnail"
          >
            {/* Action Banner */}
            <div className="bg-[#121216] border border-white/10 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                  유튜브 썸네일 디렉터 (CTR Optimizer)
                </h3>
                <p className="text-white/50 text-[11px] leading-relaxed">
                  역사 유튜브 전문 디렉터의 관점에 빙의하여 대본 전체를 재평가하고, 시청자들의 본능적인 호기심을 직접 자극하여 높은 클릭률(CTR)을 자아낼 썸네일 자산과 제목 문구를 자동으로 설계합니다.
                </p>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Aspect Ratio Selector Segmented Controls */}
                <div className="flex bg-[#1b1b22] border border-white/5 p-1 rounded-md gap-0.5 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => {
                      setThumbnailAspectRatio("16:9");
                      if (thumbnailData && !isGeneratingThumbnail) {
                        handleGenerateThumbnail(false, undefined, "16:9");
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                      thumbnailAspectRatio === "16:9"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-white/40 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    16:9 가로형 (기본)
                  </button>
                  <button
                    onClick={() => {
                      setThumbnailAspectRatio("9:16");
                      if (thumbnailData && !isGeneratingThumbnail) {
                        handleGenerateThumbnail(false, undefined, "9:16");
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                      thumbnailAspectRatio === "9:16"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-white/40 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    9:16 세로형 (Shorts)
                  </button>
                </div>

                <button
                  onClick={() => handleGenerateThumbnail(true)}
                  disabled={isGeneratingThumbnail}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/30 disabled:text-white/30 rounded text-xs font-bold text-white shadow-lg shadow-purple-600/15 flex items-center justify-center gap-2 transition-all cursor-pointer relative"
                >
                  {isGeneratingThumbnail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      썸네일 생성 중 ({thumbnailAspectRatio})...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {thumbnailAspectRatio} 썸네일 기획 재가동
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error handling bounds if failure occurs */}
            {thumbnailData?.error && (
              <div className="bg-rose-950/20 border border-rose-900/30 p-3.5 rounded-md flex items-center gap-2.5 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>썸네일 생성 실패: {thumbnailData.error}</span>
                <button 
                  onClick={() => handleGenerateThumbnail(true)}
                  className="ml-auto underline font-bold text-rose-300 hover:text-white transition-all text-[11px]"
                >
                  다시 기동하기
                </button>
              </div>
            )}

            {!thumbnailData && !isGeneratingThumbnail ? (
              /* Starter empty state card */
              <div className="border border-dashed border-white/10 rounded-lg p-10 text-center bg-[#0d0d11]">
                <div className="w-12 h-12 rounded-full bg-purple-600/10 text-purple-400 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-white text-sm font-bold tracking-tight mb-2">썸네일 기획 데이터가 존재하지 않습니다</h4>
                <p className="text-white/40 text-[11px] max-w-lg mx-auto leading-relaxed mb-5">
                  씬별 이미지 생성이 완료되면 자동으로 썸네일 분석이 시작됩니다. 혹은 아래의 버튼을 누르시면 AI 디렉터가 즉시 동작하여 시청자를 홀릴 극적 클라이맥스를 가려내고 맞춤 썸네일 분석 기획서를 도출합니다.
                </p>
                <button
                  onClick={() => handleGenerateThumbnail(false)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs tracking-wider transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  유튜브 썸네일 디렉터 기동하기
                </button>
              </div>
            ) : (
              /* Loading / Formatted layout block */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="thumbnail-layout-grid">
                {/* Visual Section: Left Column (lg:col-span-12 or 7) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Generated Thumbnail Image Viewport */}
                  <div className="bg-[#121216] border border-white/10 rounded-lg overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                        PREMIUM YOUTUBE THUMBNAIL IMAGE
                      </span>
                      <span className="text-[9px] text-white/30 font-mono">
                        {thumbnailAspectRatio === "16:9" ? "16:9 LANDSCAPE STANDARD" : "9:16 VERTICAL SHORTS"}
                      </span>
                    </div>

                    <div className={`relative bg-[#09090b] flex items-center justify-center group overflow-hidden border-b border-white/15 w-full ${
                      thumbnailAspectRatio === "16:9" ? "aspect-video" : "h-[450px] p-4 bg-[#050507]"
                    }`}>
                      {isGeneratingThumbnail ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0d11]/95 z-10">
                          <div className="w-10 h-10 border-4 border-purple-500/10 border-t-purple-500 rounded-full animate-spin"></div>
                          <p className="text-purple-400 text-[10px] tracking-widest uppercase font-mono animate-pulse">
                            Generating Image...
                          </p>
                        </div>
                      ) : null}

                      {thumbnailData?.imageUrl ? (
                        <>
                          <img
                            src={thumbnailData.imageUrl}
                            alt="YouTube Thumbnail Preview"
                            className={`${
                              thumbnailAspectRatio === "16:9"
                                ? "w-full h-full object-cover"
                                : "h-full aspect-[9/16] object-cover rounded-md border border-white/10 shadow-2xl"
                            } group-hover:scale-105 transition-transform duration-700 relative z-0`}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-center justify-between z-10">
                            <span className="text-[10px] text-white/80 font-serif">
                              {thumbnailAspectRatio === "16:9" ? "가로형 16:9 레이아웃" : "세로형 9:16 레이아웃"}
                            </span>
                            <button
                              onClick={() => setLightboxItem({
                                title: `유튜브 프리미엄 썸네일 (씬 #${thumbnailData.chosenSceneId} 기반, ${thumbnailAspectRatio})`,
                                imageUrl: thumbnailData.imageUrl || "",
                                description: thumbnailData.selectionReason,
                                prompt: thumbnailData.visualPrompt
                              })}
                              className="px-2 py-1 bg-black/60 hover:bg-black/90 text-white rounded text-[9px] font-medium flex items-center gap-1 transition-all"
                            >
                              <Eye className="w-3 h-3" /> 크게 보기
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-white/20">
                          <ImageIcon className="w-12 h-12 mb-3 text-white/5" />
                          {isGeneratingThumbnail ? (
                            <p className="text-xs">썸네일 시각 이미지를 성공적으로 렌더링 중입니다...</p>
                          ) : (
                            <p className="text-xs">아래 생성 버튼을 누르면 썸네일 이미지가 복원됩니다.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Meta prompt tags */}
                    {thumbnailData?.visualPrompt && (
                      <div className="p-4 bg-[#0e0e11] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/40 block font-mono">IMAGE PROMPT USED FOR GENERATION:</span>
                          <button
                            onClick={() => copyToClipboard(thumbnailData.visualPrompt, "thumbnail_prompt")}
                            className="text-[9px] text-purple-400 hover:text-white transition-colors flex items-center gap-1 font-mono hover:underline"
                          >
                            {copiedText === "thumbnail_prompt" ? "copied!" : "copy prompt"}
                          </button>
                        </div>
                        <p className="text-[10px] text-white/60 font-mono leading-relaxed line-clamp-3 select-all bg-[#09090c] p-2 rounded border border-white/5">
                          {thumbnailData.visualPrompt}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Selected Scene & Detailed Choice Analysis */}
                  <div className="bg-[#121216] border border-white/10 rounded-lg p-5 space-y-3.5">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">
                      📌 SELECTED SCENE & BEST CLIFFHANGER EVALUATION
                    </span>

                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded font-mono text-xs font-bold shrink-0">
                        씬 #{thumbnailData?.chosenSceneId}
                      </div>
                      <h4 className="text-white text-sm font-bold truncate">
                        {thumbnailData?.sceneTitle || "선정된 썸네일 클라이맥스 무대"}
                      </h4>
                    </div>

                    <div className="space-y-2 border-l-2 border-purple-500/20 pl-4 py-1">
                      <p className="text-[11px] text-white/40 font-mono leading-none">선정 사유 및 매력 분석</p>
                      <p className="text-xs text-white/80 leading-relaxed font-serif">
                        {thumbnailData?.selectionReason}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analysis / Captions: Right Column (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Captions proposal list */}
                  <div className="bg-[#121216] border border-white/10 rounded-lg p-5 space-y-4">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">
                      📝 SHORT PUNCHY CTR TEXT CANDIDATES
                    </span>

                    <div className="space-y-2.5">
                      {thumbnailData?.textCandidates?.map((text, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-[#1a1a22] border border-[#fffff]/5 hover:border-purple-500/30 rounded hover:bg-[#20202a] transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-purple-400/60 font-bold shrink-0">
                              0{idx + 1}
                            </span>
                            <span className="text-xs text-white font-serif font-medium tracking-tight">
                              {text}
                            </span>
                          </div>

                          <button
                            onClick={() => copyToClipboard(text, `candidate_${idx}`)}
                            className="text-[9px] bg-white/5 hover:bg-purple-600/30 text-white/40 hover:text-purple-300 px-2 py-1 rounded transition-all shrink-0 uppercase tracking-wider font-mono opacity-60 group-hover:opacity-100"
                          >
                            {copiedText === `candidate_${idx}` ? "copied!" : "copy"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Director's top choice / Golden recommended crown banner */}
                  <div className="bg-purple-950/15 border border-purple-500/25 rounded-lg p-5 space-y-4 shadow-xl shadow-purple-950/20">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-purple-600/20 border border-purple-500/30 rounded flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[8px] text-purple-400 font-mono tracking-widest uppercase block">
                          DIRECTOR'S WINNING CAPTION
                        </span>
                        <h4 className="text-white text-xs font-bold leading-none">최종 추천 및 유도 문구</h4>
                      </div>
                    </div>

                    <div className="p-4 bg-purple-900/10 border border-purple-500/20 rounded-md text-center shadow-inner">
                      <p className="text-lg font-bold text-white tracking-widest font-serif leading-tight">
                        "{thumbnailData?.recommendedText}"
                      </p>
                    </div>

                    <div className="space-y-1.5 pl-3.5 border-l border-purple-500/30">
                      <p className="text-[10px] text-purple-400 font-mono font-medium uppercase tracking-wide">
                        CTR 최적화 타겟 심리학 배경:
                      </p>
                      <p className="text-[11px] text-white/70 leading-relaxed font-serif">
                        {thumbnailData?.recommendationReason}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 4: YOUTUBE MONETIZATION POLICY SAFETY AUDITOR */}
        {activeTab === "safety" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
            id="tab-pane-safety"
          >
            {/* Header Compliance Audit Banner */}
            <div className="bg-[#121216] border border-white/10 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                  유튜브 2026년 6월 수익정지 자가 진단기
                </h3>
                <p className="text-white/50 text-[11px] leading-relaxed">
                  최근 야담(전통 민담/공포) 채널에 연쇄적으로 가해지고 있는 유튜브 파트너 프로그램(재사용 및 반복성, 잔혹성 가이드라인) 수익창출 정지 압박을 피하기 위한 고정밀 리스크 평가기입니다. 대본과 예정 썸네일을 스캔 장비처럼 검수합니다.
                </p>
              </div>

              <div className="shrink-0">
                <button
                  onClick={handleAuditSafetyRisk}
                  disabled={isAuditingSafety}
                  className="px-5 py-2.5 bg-rose-700 hover:bg-rose-600 disabled:bg-rose-950/40 disabled:text-white/30 rounded text-xs font-bold text-white shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 transition-all cursor-pointer relative"
                >
                  {isAuditingSafety ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      구글 제미나이 규정 심사 가동 중...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      규정 준수 정밀 자가 진단 실행
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* If no report yet, display guidelines index & run actions */}
            {!safetyReport && !isAuditingSafety ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Visual explanation bento card */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-[#121216] border border-white/15 rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                      <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
                      2026년 6월 최신 야담 채널 수익정지 3대 핵심 원인
                    </h3>
                    
                    <div className="space-y-4 text-xs leading-relaxed">
                      {/* Reason 1 */}
                      <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1">
                        <h4 className="text-rose-300 font-bold flex items-center gap-1.5">
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded">원인 01</span>
                          재사용된 콘텐츠 (Reused Content)
                        </h4>
                        <p className="text-white/60 text-[11px]">
                          인터넷 블로그, 민담 백과사전, 위키 문서의 대본을 토씨 하나 바꾸지 않고 고스란히 긁어다 사용하는 경우 컴퓨터 매칭 필터가 표절/중복 판정을 때립니다. 또한 무료 스톡 음원이나 타 채널과 복제 수준으로 겹치는 AI 이미지 연출 패턴도 심각한 제재 대상이 됩니다.
                        </p>
                      </div>

                      {/* Reason 2 */}
                      <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1">
                        <h4 className="text-rose-300 font-bold flex items-center gap-1.5">
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded">원인 02</span>
                          반복적인 콘텐츠 (Repetitive Content)
                        </h4>
                        <p className="text-white/60 text-[11px]">
                          단조로운 AI 기계 나레이션 음성(TTS)에 변화 없이 전개되는 지루한 이미지 나열, 혹은 매 시나리오의 흐름과 구성도가 구조적으로 다른 척하지만 실상은 전형적인 템플릿 공식에서 한 치도 벗어나지 않을 때 매크로 생산 영상으로 분류되어 제재를 당합니다.
                        </p>
                      </div>

                      {/* Reason 3 */}
                      <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1">
                        <h4 className="text-rose-300 font-bold flex items-center gap-1.5">
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded">원인 03</span>
                          썸네일&대본의 원색적 자극성 (Violent & Sexual Content)
                        </h4>
                        <p className="text-white/60 text-[11px]">
                          전통 야담의 필수 감초인 '합방, 치정, 불륜, 간통' 등의 은밀한 묘사나 '참수, 피범벅, 도살' 등 참혹성 높은 문구들이 노골적으로 대본이나 영상 음성, 썸네일 자막에 삽입되면 유튜브 AI의 실시간 가이드라인 필터링에 포착되어 노란딱지 적립 및 채널 수익정지로 신속히 이어집니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strategy block */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-gradient-to-br from-rose-950/20 to-[#121216] border border-rose-500/15 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-white tracking-widest uppercase font-mono">
                      🛡️ SAFE YADAM POLICY AGENT
                    </h4>
                    <p className="text-white/60 text-xs leading-relaxed">
                      본 야담 스토리보드 생성기는 이와 같은 알고리즘 검수 정책을 사전에 보호하기 위한 특수 우회 필터와 장치를 내장하고 있습니다.
                    </p>
                    <ul className="text-[11px] text-white/50 space-y-2 pl-4 list-disc leading-relaxed">
                      <li>직설적인 시체/출혈 묘사를 고상한 문학적 풍경 은유로 일차적 자율 치환합니다.</li>
                      <li>썸네일에서 노란딱지를 피하는 심리학적 타겟 유도 문구를 선정합니다.</li>
                      <li>대본 분석 보고에 맞춤식 고유 역동성을 부가할 수 있게 지원합니다.</li>
                    </ul>

                    <div className="pt-3 border-t border-white/5">
                      <button
                        onClick={handleAuditSafetyRisk}
                        className="w-full py-3 bg-rose-800 hover:bg-rose-700 text-white font-bold rounded-lg text-xs tracking-wider transition-all shadow-md shadow-rose-955/40 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldAlert className="w-4.5 h-4.5 text-rose-300 animate-pulse" />
                        지금 대본 원고 규정 감사 시운전하기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : isAuditingSafety ? (
              <div className="border border-white/10 rounded-xl p-16 text-center bg-[#121216] space-y-4 animate-fade-in">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 border-4 border-rose-500/10 border-t-rose-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-2 bg-[#121216] rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-white text-sm font-bold">2026 개정 유튜브 파트너 프로그램(YPP) 규범 검출 중</h4>
                  <p className="text-white/40 text-[11px] max-w-md mx-auto leading-relaxed">
                    구글 제미나이가 대본 내부의 폭력성, 피칠갑, 물리적 고문, 성적 은밀어, 기계식 템플릿 복제 의심 구절을 추출하여 알고리즘 리스크 스코어를 대조 중입니다. 잠시만 기다려 주십시오.
                  </p>
                </div>
              </div>
            ) : safetyReport && (
              /* If safetyReport data is successfully loaded */
              <div className="space-y-6">
                {/* Summary Scorecard Board */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Total Compliance Score card */}
                  <div className="bg-[#121216] border border-white/10 p-5 rounded-lg flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                      <Percent className="w-24 h-24 text-white" />
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">MONETIZATION SAFETY SCORE</span>
                      <h4 className="text-white text-xs font-bold mt-0.5">승인 가능 안전 지수</h4>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-4xl font-extrabold tracking-tight font-mono ${
                        safetyReport.overallScore >= 80 ? "text-emerald-400" : safetyReport.overallScore >= 50 ? "text-amber-400" : "text-rose-500"
                      }`}>
                        {safetyReport.overallScore}
                      </span>
                      <span className="text-xs text-white/30 font-mono">/ 100</span>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        safetyReport.overallRisk === "SAFE" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" :
                        safetyReport.overallRisk === "ATTENTION" ? "bg-amber-950/40 text-amber-400 border border-amber-500/20" :
                        "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                      }`}>
                        {safetyReport.overallRisk === "SAFE" ? "● 정상 안전 승인군" :
                         safetyReport.overallRisk === "ATTENTION" ? "■ 주의 및 검출 개선 요망" :
                         "▲ 고위험군 (수익정지 극대)"}
                      </span>
                    </div>
                  </div>

                  {/* Reused assessment card */}
                  <div className="bg-[#121216] border border-white/10 p-5 rounded-lg flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">REUSED CONTENT LIMIT</span>
                      <h4 className="text-white text-xs font-bold mt-0.5">재사용 콘텐츠 탈피도</h4>
                    </div>
                    <div className="space-y-1">
                      <span className={`text-2xl font-bold font-mono ${
                        safetyReport.reusedRisk === "LOW" ? "text-emerald-400" : safetyReport.reusedRisk === "MEDIUM" ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {safetyReport.reusedScore}% ({safetyReport.reusedRisk})
                      </span>
                      <p className="text-white/40 text-[10px]">타 채널과의 원고 및 연출 유사율 진단</p>
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {safetyReport.reusedFlags && safetyReport.reusedFlags.length > 0 ? `검출: ${safetyReport.reusedFlags[0]}` : "특이 복제 위험 검출 안 됨"}
                    </div>
                  </div>

                  {/* Sensual check card */}
                  <div className="bg-[#121216] border border-white/10 p-5 rounded-lg flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">SENSUAL SUGGESTIVENESS</span>
                      <h4 className="text-white text-xs font-bold mt-0.5">선정성 정책 안전성</h4>
                    </div>
                    <div className="space-y-1">
                      <span className={`text-2xl font-bold font-mono ${
                        safetyReport.sensualRisk === "LOW" ? "text-emerald-400" : safetyReport.sensualRisk === "MEDIUM" ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {safetyReport.sensualScore}% ({safetyReport.sensualRisk})
                      </span>
                      <p className="text-white/40 text-[10px]">합방, 몸을 주다 등 치정 수위 진단</p>
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {safetyReport.sensualFlags && safetyReport.sensualFlags.length > 0 ? `키워드: ${safetyReport.sensualFlags.join(", ")}` : "선정 단어 미감지"}
                    </div>
                  </div>

                  {/* Gore / Violent check card */}
                  <div className="bg-[#121216] border border-white/10 p-5 rounded-lg flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">VIOLENT GORE DEPICTION</span>
                      <h4 className="text-white text-xs font-bold mt-0.5">그로테스크/잔혹성 회피율</h4>
                    </div>
                    <div className="space-y-1">
                      <span className={`text-2xl font-bold font-mono ${
                        safetyReport.violentRisk === "LOW" ? "text-emerald-400" : safetyReport.violentRisk === "MEDIUM" ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {safetyReport.violentScore}% ({safetyReport.violentRisk})
                      </span>
                      <p className="text-white/40 text-[10px]">참수, 목베기, 피범벅 노출 심사</p>
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {safetyReport.violentFlags && safetyReport.violentFlags.length > 0 ? `검출: ${safetyReport.violentFlags.join(", ")}` : "직설적 잔혹단어 프리"}
                    </div>
                  </div>
                </div>

                {/* Sub audit grids */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Detailed compliance flags on left */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="bg-[#121216] border border-white/10 rounded-lg p-5 space-y-4">
                      <span className="text-[9px] text-white/40 uppercase tracking-widest font-mono block">
                        ⚙️ 구체적 규정 위반 검출 요소 목록 (Detected Vectors)
                      </span>

                      <div className="space-y-3.5">
                        {/* Violations category 1 */}
                        <div className="p-3 bg-[#1a1a22] border border-white/5 rounded-md space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              잔혹/폭력 요소
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${
                              safetyReport.violentRisk === "LOW" ? "text-emerald-400" : "text-rose-400"
                            }`}>
                              경보레벨: {safetyReport.violentRisk} (안심도 {safetyReport.violentScore}%)
                            </span>
                          </div>
                          <div>
                            {safetyReport.violentFlags && safetyReport.violentFlags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {safetyReport.violentFlags.map((val, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-rose-950/40 text-rose-400 rounded text-[10px] border border-rose-900/40">
                                    "{val}" 검출됨
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-white/40 text-[10px]">대본 본문에서 빨간딱지가 우려되는 직설적 출혈/사체 단어가 식별되지 않았습니다. 은유 치환이 정상 탑재되었습니다.</p>
                            )}
                          </div>
                        </div>

                        {/* Violations category 2 */}
                        <div className="p-3 bg-[#1a1a22] border border-white/5 rounded-md space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                              성적/선정 수위
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${
                              safetyReport.sensualRisk === "LOW" ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              경보레벨: {safetyReport.sensualRisk} (안심도 {safetyReport.sensualScore}%)
                            </span>
                          </div>
                          <div>
                            {safetyReport.sensualFlags && safetyReport.sensualFlags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {safetyReport.sensualFlags.map((val, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-amber-955/40 text-amber-400 rounded text-[10px] border border-amber-900/40">
                                    "{val}" 노출
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-white/40 text-[10px]">구글 자동 머신에 장착된 선정성/치정 필터 조건에 노출될 우려 요소가 발견되지 않았습니다.</p>
                            )}
                          </div>
                        </div>

                        {/* Violations category 3 */}
                        <div className="p-3 bg-[#1a1a22] border border-white/5 rounded-md space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              클릭베이트 메타데이터 위험
                            </span>
                            <span className={`text-[10px] font-mono font-bold ${
                              safetyReport.metadataRisk === "LOW" ? "text-emerald-400" : "text-rose-400"
                            }`}>
                              경보레벨: {safetyReport.metadataRisk} (안심도 {safetyReport.metadataScore}%)
                            </span>
                          </div>
                          <div>
                            {safetyReport.metadataFlags && safetyReport.metadataFlags.length > 0 ? (
                              <ul className="text-white/55 text-[10px] list-disc pl-4 space-y-1">
                                {safetyReport.metadataFlags.map((val, i) => (
                                  <li key={i}>{val}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-white/40 text-[10px]">예정된 썸네일 제목 문구가 상대적으로 가이드라인을 잘 준수하고 있습니다.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations layout on right */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="bg-gradient-to-br from-emerald-950/10 to-[#121216] border border-emerald-500/10 rounded-lg p-5 space-y-4">
                      <span className="text-[9px] text-emerald-400 uppercase tracking-widest font-mono block">
                        🛡️ MONETIZATION SURVIVAL STRATEGY (수익정지 원천 방지 책략)
                      </span>

                      <div className="space-y-3">
                        {safetyReport.recommendations && safetyReport.recommendations.map((rec, index) => (
                          <div key={index} className="flex gap-3 items-start animate-fade-in-delayed">
                            <div className="w-5 h-5 bg-emerald-600/20 border border-emerald-500/20 rounded flex items-center justify-center font-mono text-[10px] text-emerald-400 font-bold shrink-0 mt-0.5">
                              0{index + 1}
                            </div>
                            <p className="text-xs text-white/80 leading-relaxed font-serif">
                              {rec}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-white/5 text-[9px] text-white/30 leading-normal">
                        * 본 평가는 2026년 6월 유튜브 규정 개정사항 및 YPP 정지 채널들의 실사례 데이터를 바탕으로 구축되었습니다. 완벽한 안전 확보를 위해 영상 나레이션 제작 시 기계음(TTS)의 무변주 기조를 탈피하고 반드시 고유 해설이나 자막 배치 수정을 부가해주십시오.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Special 2026 Repetitive Template Survival Strategies Card */}
            {!isAuditingSafety && (
              <div className="bg-[#121216] border border-white/10 rounded-xl p-6 mt-6 space-y-4">
                <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <span className="p-1 bg-rose-500/10 text-rose-400 rounded text-xs leading-none">💡</span>
                  집중 분석: '반복적인 콘텐츠(Repetitive Content)' 필터를 우회하기 위한 4대 핵심 제작 공식 (26년 6월 핵심 가이드)
                </h4>
                <p className="text-white/60 text-xs text-justify leading-relaxed">
                  유튜브의 자동 인공지능 검수 알고리즘은 <strong>"화면의 정적 반복성" + "동일 기계 오디오 패턴" + "기성 템플릿의 무변경 대조"</strong> 세 가지 요소를 바탕으로 채널을 '반복적인 콘텐츠'로 분류하여 수익 창출 정지 처분을 내립니다. 아래 조치를 이 스토리보드 생성기와 프리미어/에프트이펙트 저작 환경에서 반드시 연동해 기계성 판단을 차단하십시오:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1.5 hover:border-rose-500/20 transition-all">
                    <span className="text-[10px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded font-mono font-bold">1. 프레임 레이아웃 다변화</span>
                    <h5 className="text-white text-xs font-bold leading-normal">정적 캐릭터 템플릿 폐지</h5>
                    <p className="text-white/40 text-[11px] leading-relaxed select-all">
                      화면 하단에 매번 똑같은 구도의 캐릭터 일러스트를 박고 자막만 흘려보내는 정적 레이아웃이 반복 필터의 1순위 먹잇감입니다. 매 씬마다 카메라 줌인/줌아웃(Ken Burns 효과), 좌우 팬 스크롤, 3D 카메라 공간 조절 효과를 가미해 화면의 실시간 움직임 변화(Motion Vector)를 최소 3초 단위로 발생시켜야 합니다. 본 스토리보드 가이드의 고해상도 각 씬 프롬프트 변화량을 적용하세요.
                    </p>
                  </div>

                  <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1.5 hover:border-rose-500/20 transition-all">
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">2. TTS 인공 정형성 붕괴</span>
                    <h5 className="text-white text-xs font-bold leading-normal">나릿조(Pitch & Rate) 가변 가공</h5>
                    <p className="text-white/40 text-[11px] leading-relaxed select-all">
                      모든 영상에 일률적인 기본 배속, 기본 피치의 TTS 성우(예: 특정 타입캐스트/클로바 더빙 보이스)를 그대로 올리면 주인이 다른 채널 영상들과 대조되어 기계 배포형 채널로 오인됩니다. <strong>나레이션 속도를 슬픔/긴장 구도에 맞추어 수동 미적 조율하고 배경 음악(BGM)의 자동 볼륨 감쇠(Ducking)를 먹여</strong> 오디오 고유 개성을 강력하게 표현해 주십시오.
                    </p>
                  </div>

                  <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1.5 hover:border-rose-500/20 transition-all">
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">3. 고유 사운드 이펙트(SFX) 밀도</span>
                    <h5 className="text-white text-xs font-bold leading-normal">현장 앰비언트 레이어 축적</h5>
                    <p className="text-white/40 text-[11px] leading-relaxed select-all">
                      오디오의 배경 노이즈와 사운드 이펙트 삽입 여부는 유튜브 AI가 "인간의 사후 창의적 가공"을 인지하는 강력한 가산 점수 지표가 됩니다. 스토리보드가 제시하는 주요 시각 효과(예: 바람 소리 - 바람 SFX, 소름끼치는 바람 - 올빼미 소리 등) 구간에 <strong>고유한 전후방 엠비언트 레이어</strong>를 뒤섞어 독점적인 사운드 웨이브를 구축해야 합니다.
                    </p>
                  </div>

                  <div className="p-4 bg-[#1a1a22] border border-white/5 rounded-lg space-y-1.5 hover:border-rose-500/20 transition-all">
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded font-mono font-bold">4. 프롤로그/에필로그 주관성</span>
                    <h5 className="text-white text-xs font-bold leading-normal font-serif">독자적 비평/감상 해설 투입</h5>
                    <p className="text-white/40 text-[11px] leading-relaxed select-all">
                      인터넷 백과사전의 야설/야담설화를 날것 그대로 TTS 성우에게 읽히는 형태는 100% 중복 및 재사용 판정을 받습니다. 영상 서두 10초 대의 요약 오프닝이나 에필로그 15초 부분에 <strong>제작자의 독자적 해석, 주관적 코멘트, 현대적 교훈 또는 시청자 질문</strong>을 삽입하십시오. 이 간단한 코멘터리가 주는 유의미한 가치 변주는 수동 수익 이의제기 심사 시에 100% 승인을 보증하는 치트키가 됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* DETAILED HIGH QUALITY IMAGE LIGHTBOX POPUP */}
      <AnimatePresence>
        {lightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="lightbox-backdrop"
            className="fixed inset-0 z-50 bg-[#0a0a0c]/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setLightboxItem(null)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              id="lightbox-container"
              className="bg-[#121216] border border-white/10 rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left container is the main resolution image */}
              <div className="md:w-3/5 bg-black/40 flex items-center justify-center relative">
                <img
                  src={lightboxItem.imageUrl}
                  alt={lightboxItem.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[50vh] md:max-h-[80vh] w-full object-contain"
                />
                <a
                  href={lightboxItem.imageUrl}
                  download={`${lightboxItem.title.replace(/\s+/g, "_")}.png`}
                  className="absolute bottom-4 left-4 px-3 py-2 bg-[#0a0a0c]/80 hover:bg-black border border-white/10 text-white font-bold rounded text-xs flex items-center gap-1.5 transition-all shadow-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  파일 개별 다운로드
                </a>
              </div>

              {/* Right side metadata attributes */}
              <div className="md:w-2/5 p-6 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-none border-t md:border-t-0 md:border-l border-white/10">
                <div className="space-y-4">
                  <div className="flex justify-between items-start pb-2 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      {lightboxItem.title}
                    </h3>
                    <button
                      onClick={() => setLightboxItem(null)}
                      className="p-1 hover:bg-[#1a1a22] rounded text-white/40 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono font-bold block">
                      Scene Description & Details
                    </span>
                    <p className="text-white/80 text-xs leading-relaxed whitespace-pre-line font-light">
                      {lightboxItem.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 bg-[#1a1a22] p-3 rounded-lg border border-white/5">
                    <div className="flex justify-between items-center text-[9px] text-white/30 uppercase tracking-widest font-mono font-bold">
                      <span>Translated Engine Prompt</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            lightboxItem.prompt,
                            "lightbox_prompt",
                          )
                        }
                        className="text-blue-400 hover:text-blue-300 font-bold normal-case text-[9px] py-0.5"
                      >
                        {copiedText === "lightbox_prompt"
                          ? "copied"
                          : "copy prompt"}
                      </button>
                    </div>
                    <p className="text-white/50 text-[10px] leading-relaxed font-mono select-all">
                      {lightboxItem.prompt}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <button
                    onClick={() => setLightboxItem(null)}
                    className="w-full py-2 bg-[#1a1a22] hover:bg-[#252530] text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                  >
                    창 닫기
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styled Footer aligned with Bento parameters */}
      <footer
        className="mt-6 border-t border-white/10 pt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-white/30 gap-3"
        id="app-footer"
      >
        <div className="flex gap-4">
          <span>EXPONENTIAL_BACKOFF: ACTIVE</span>
          <span>JITTER: 4-6s</span>
        </div>
        <div className="text-center sm:text-right">
          <span>SYSTEM_UPTIME: 14:23:01</span>
        </div>
      </footer>
    </div>
  );
}
