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

export interface SceneItem {
  id: number;
  stage: "early" | "middle" | "late" | "final";
  locationName: string;
  characterNames: string[];
  narrationText: string;
  visualDescription: string;
  refinedImagePrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
  error?: string;
  retries?: number;
}

export interface StoryboardAnalysisResponse {
  characters: CharacterItem[];
  locations: LocationItem[];
  scenes: SceneItem[];
}

export interface GenerationConfig {
  model: "gemini-2.5-flash-image" | "gemini-3.1-flash-image";
  aspectRatio: "1:1" | "9:16" | "16:9" | "3:4" | "4:3";
  artStyle: "realistic" | "3d" | "anime" | "yadam";
  quantityOverride: boolean;
  quantityValue: number;
}

export interface ThumbnailDirectorData {
  chosenSceneId: number;
  sceneTitle: string;
  selectionReason: string;
  visualPrompt: string;
  textCandidates: string[];
  recommendedText: string;
  recommendationReason: string;
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
}


