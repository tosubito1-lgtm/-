/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CharacterItem {
  name: string;
  gender: string;
  age: string;
  appearance: string;
  clothing: string;
  traits: string;
  characterSheetPrompt: string;
  appearanceEnglish?: string;
  clothingEnglish?: string;
  imageUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export interface LocationItem {
  name: string;
  description: string;
  descriptionEnglish?: string;
}

export type StoryFormat = 
  | "classic" 
  | "in_media_res" 
  | "multi_perspective" 
  | "omnibus_3part" 
  | "investigation";

export type LengthPreset = 
  | "shorts"      // 최대 2분 (8~15장면)
  | "standard"    // 표준 롱폼 (9~13분, 40~50장면)
  | "deep_dive"   // 대작/심층 탐구 (14~18분, 60~75장면)
  | "auto_flow"   // AI 자율 가변 모드 (9~18분, 40~75장면 자동)
  | "custom";     // 직접 지정

export interface SceneItem {
  id: number;
  stage: "early" | "middle" | "late" | "final";
  locationName: string;
  characterNames: string[];
  narrationText: string;
  visualDescription: string;
  refinedImagePrompt: string;
  cameraMotion?: "none" | "dolly_in" | "dolly_out" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "orbit" | "slow_zoom";
  durationSeconds?: number;
  pacingType?: "fast" | "normal" | "slow"; // fast (3-6s), normal (8-12s), slow (15-18s)
  ltxRecommended?: boolean;                // LTX 비디오 추천 여부 (전체 10~15%, 12초 이하)
  ltxReason?: string;                      // LTX 비디오 추천 사유
  ltxPrompt?: string;                      // LTX 전용 프롬프트
  imageUrl?: string;
  isGenerating?: boolean;
  error?: string;
  retries?: number;
  startTimecode?: string;
  endTimecode?: string;
}

export interface StoryboardAnalysisResponse {
  characters: CharacterItem[];
  locations: LocationItem[];
  scenes: SceneItem[];
  storyFormat?: StoryFormat;
  lengthPreset?: LengthPreset;
  estimatedTotalDurationMinutes?: number;
}

export interface GenerationConfig {
  model: "gemini-2.5-flash-image" | "gemini-3.1-flash-image";
  aspectRatio: "1:1" | "9:16" | "16:9" | "3:4" | "4:3";
  artStyle: "realistic" | "3d" | "anime" | "yadam" | "claymation";
  quantityOverride: boolean;
  quantityValue: number;
  storyFormat?: StoryFormat;
  lengthPreset?: LengthPreset;
}

export interface ThumbnailDirectorData {
  chosenSceneId: number;
  sceneTitle: string;
  selectionReason: string;
  visualPrompt: string;
  textCandidates: string[];
  recommendedText: string;
  recommendationReason: string;
  compositionStyle?: string;
  colorMood?: string;
  imageUrl?: string;
  isGenerating?: boolean;
  error?: string;
}

export interface YadamSafetyReport {
  overallScore: number;
  overallRisk: "SAFE" | "ATTENTION" | "CRITICAL";
  reusedRisk: "LOW" | "MEDIUM" | "HIGH";
  reusedScore: number;
  reusedFlags: string[];
  sensualRisk: "LOW" | "MEDIUM" | "HIGH";
  sensualScore: number;
  sensualFlags: string[];
  violentRisk: "LOW" | "MEDIUM" | "HIGH";
  violentScore: number;
  violentFlags: string[];
  metadataRisk: "LOW" | "MEDIUM" | "HIGH";
  metadataScore: number;
  metadataFlags: string[];
  recommendations: string[];
  
  // 양산형/재사용 패턴 회피 진단 항목 추가
  antiPatternAnalysis?: {
    patternScore: number;           // 0 ~ 100 (높을수록 양산형 탈피, 독창적)
    formatVarietyGrade: string;     // 서사 다양성 등급 (A, B, C)
    pacingVariationGrade: string;   // 호흡 가변율 등급 (A, B, C)
    ltxUtilizationRatio: number;    // LTX 비디오 추천 및 활용율 (%)
    riskFactors: string[];          // 양산형 알고리즘 제재 위험 요소
    actionableAdvice: string[];     // 수익 정지 방지를 위한 구체적 개선 조치
  };
}



