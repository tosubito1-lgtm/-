/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 4-Stage Production QA Loop Modal & Director Dashboard
 * Stage 1: 70-Scene Script & TTS Timing Specification QA
 * Stage 2: High-Volume Batch Image Generation Status
 * Stage 3: Vision AI Quality & Visual Consistency Inspection
 * Stage 4: Targeted Batch Re-generation of Flagged Scenes
 */

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Sliders,
  Film,
  Zap,
  Layers,
  ArrowRight,
  Filter,
  Check,
  X,
  Play,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SceneItem, CharacterItem, ScriptQAResult, VisionQAResult, VisionQACheckItem } from "../types";

interface QaDirectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: SceneItem[];
  characters: CharacterItem[];
  onUpdateScene: (sceneId: number, updated: Partial<SceneItem>) => void;
  onRegenerateScenes: (sceneIds: number[]) => void;
  onBatchGenerateImages: () => void;
  isGeneratingImages: boolean;
  getHeaders: () => Record<string, string>;
  showFeedback: (msg: string, type: "success" | "error" | "info") => void;
}

export const QaDirectorModal: React.FC<QaDirectorModalProps> = ({
  isOpen,
  onClose,
  scenes,
  characters,
  onUpdateScene,
  onRegenerateScenes,
  onBatchGenerateImages,
  isGeneratingImages,
  getHeaders,
  showFeedback,
}) => {
  const [activeStage, setActiveStage] = useState<1 | 2 | 3 | 4>(1);

  // Stage 1 States: Script QA
  const [isAuditingScript, setIsAuditingScript] = useState(false);
  const [scriptQaResult, setScriptQaResult] = useState<ScriptQAResult | null>(null);
  const [stage1Filter, setStage1Filter] = useState<"all" | "warnings_only">("all");

  // Stage 3 States: Vision QA
  const [isAuditingVision, setIsAuditingVision] = useState(false);
  const [visionQaResult, setVisionQaResult] = useState<VisionQAResult | null>(null);
  const [visionProgress, setVisionProgress] = useState(0);
  const [stage3Filter, setStage3Filter] = useState<"all" | "failed_only">("all");

  // Run Stage 1: Script QA
  const handleRunScriptQA = async () => {
    if (!scenes || scenes.length === 0) {
      showFeedback("검수할 스토리보드 장면이 없습니다.", "error");
      return;
    }

    setIsAuditingScript(true);
    showFeedback("70씬 대본 규격, TTS 호흡, 비디오 비율, 인물 태그 검수를 진행 중입니다...", "info");

    try {
      const response = await fetch("/api/qa-script-70", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ scenes, characters }),
      });

      if (!response.ok) {
        throw new Error(`대본 QA 검수 실패 (${response.status})`);
      }

      const data: ScriptQAResult = await response.json();
      setScriptQaResult(data);
      showFeedback(`1단계 대본 QA 완료: 규격 건강도 ${data.overallHealthScore}점!`, "success");
    } catch (err: any) {
      console.error(err);
      showFeedback(`대본 QA 오류: ${err.message}`, "error");
    } finally {
      setIsAuditingScript(false);
    }
  };

  // Run Stage 3: Vision QA (Chunked to prevent timeout)
  const handleRunVisionQA = async () => {
    const scenesWithImages = scenes.filter((s) => s.imageUrl && s.imageUrl.trim().length > 0);
    if (scenesWithImages.length === 0) {
      showFeedback("비전 AI 검수를 실행할 생성된 이미지가 없습니다. 2단계에서 이미지를 먼저 생성해 주세요.", "error");
      return;
    }

    setIsAuditingVision(true);
    setVisionProgress(0);
    showFeedback(`Gemini Vision AI를 통해 생성된 ${scenesWithImages.length}개 이미지의 품질과 일관성을 정밀 검수합니다...`, "info");

    const batchSize = 4;
    const allResults: Record<number, VisionQACheckItem> = {};
    let completed = 0;

    try {
      for (let i = 0; i < scenesWithImages.length; i += batchSize) {
        const chunk = scenesWithImages.slice(i, i + batchSize);
        const payload = chunk.map((s) => {
          const charNames = s.characterNames || [];
          const charDetails = charNames
            .map((cn) => {
              const found = characters.find((c) => c.name === cn);
              return found ? `${found.name}: ${found.appearanceEnglish || found.appearance}, ${found.clothingEnglish || found.clothing}` : cn;
            })
            .join("; ");

          return {
            sceneId: s.id,
            base64Image: s.imageUrl,
            prompt: s.refinedImagePrompt,
            characterInfo: charDetails,
          };
        });

        const res = await fetch("/api/qa-vision-images", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ itemsToAudit: payload }),
        });

        if (res.ok) {
          const data: VisionQAResult = await res.json();
          Object.assign(allResults, data.items);
        }

        completed += chunk.length;
        setVisionProgress(Math.round((completed / scenesWithImages.length) * 100));
      }

      const totalAudited = Object.keys(allResults).length;
      let passedCount = 0;
      let needsRegenCount = 0;
      let totalScore = 0;

      for (const item of Object.values(allResults)) {
        if (item.verdict === "NEEDS_REGENERATE") needsRegenCount++;
        else passedCount++;
        totalScore += item.overallScore || 75;
      }

      const finalResult: VisionQAResult = {
        auditedCount: totalAudited,
        passedCount,
        needsRegenCount,
        averageScore: totalAudited > 0 ? Math.round(totalScore / totalAudited) : 0,
        items: allResults,
      };

      setVisionQaResult(finalResult);
      showFeedback(`3단계 비전 QA 검수 완료: 평균 ${finalResult.averageScore}점 (통과 ${passedCount}건 / 재생성 권장 ${needsRegenCount}건)`, "success");

      if (needsRegenCount > 0) {
        setActiveStage(4); // Automatically guide to Stage 4 if there are defects
      }
    } catch (err: any) {
      console.error(err);
      showFeedback(`비전 검수 중 오류 발생: ${err.message}`, "error");
    } finally {
      setIsAuditingVision(false);
    }
  };

  // Stage 4: Trigger regeneration for failed scenes
  const getDefectiveSceneIds = (): number[] => {
    if (!visionQaResult) return [];
    return (Object.values(visionQaResult.items) as VisionQACheckItem[])
      .filter((it) => it.verdict === "NEEDS_REGENERATE" || it.overallScore < 75)
      .map((it) => it.sceneId);
  };

  const handleRegenerateFailedOnly = () => {
    const failedIds = getDefectiveSceneIds();
    if (failedIds.length === 0) {
      showFeedback("재생성이 필요한 결함 장면이 없습니다! 모든 이미지가 품질 기준을 통과했습니다.", "info");
      return;
    }

    // Apply fix prompt tips if available
    failedIds.forEach((id) => {
      const qaItem = visionQaResult?.items[id];
      const targetScene = scenes.find((s) => s.id === id);
      if (qaItem?.fixPromptTip && targetScene) {
        const updatedPrompt = `${targetScene.refinedImagePrompt}, ${qaItem.fixPromptTip}`;
        onUpdateScene(id, { refinedImagePrompt: updatedPrompt });
      }
    });

    onRegenerateScenes(failedIds);
    showFeedback(`결함이 발견된 ${failedIds.length}개 장면에 대한 스마트 재생성 대기열을 가동했습니다.`, "success");
    onClose();
  };

  if (!isOpen) return null;

  const totalScenesCount = scenes.length;
  const generatedScenesCount = scenes.filter((s) => s.imageUrl && s.imageUrl.trim().length > 0).length;
  const ungeneratedCount = totalScenesCount - generatedScenesCount;
  const failedSceneIds = getDefectiveSceneIds();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">4단계 자동 완성 QA 루프 디렉터</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  V2 고도화 엔진
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ① 70씬 규격 QA → ② 일괄 이미지 생성 → ③ 비전 AI 품질/일관성 검수 → ④ 결함 장면만 원클릭 재생성
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Stage Stepper Navigation */}
        <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950/40">
          {[
            {
              num: 1,
              title: "1단계: 70씬 대본 QA",
              subtitle: "글자수·호흡·비디오 비율",
              icon: Film,
              badge: scriptQaResult ? `${scriptQaResult.overallHealthScore}점` : null,
            },
            {
              num: 2,
              title: "2단계: 이미지 생성",
              subtitle: `${generatedScenesCount}/${totalScenesCount} 생성 완료`,
              icon: Zap,
              badge: ungeneratedCount > 0 ? `미생성 ${ungeneratedCount}` : "완료",
            },
            {
              num: 3,
              title: "3단계: 비전 AI 검수",
              subtitle: "얼굴 왜곡·텍스트·복식 일관성",
              icon: Eye,
              badge: visionQaResult ? `평균 ${visionQaResult.averageScore}점` : null,
            },
            {
              num: 4,
              title: "4단계: 선별 재생성",
              subtitle: "문제 장면만 원클릭 교정",
              icon: RotateCcw,
              badge: failedSceneIds.length > 0 ? `${failedSceneIds.length}건 교정` : "결함 없음",
            },
          ].map((st) => {
            const Icon = st.icon;
            const isActive = activeStage === st.num;
            return (
              <button
                key={st.num}
                onClick={() => setActiveStage(st.num as any)}
                className={`flex flex-col items-start px-4 py-3 border-r last:border-r-0 border-slate-800 transition-all text-left relative ${
                  isActive
                    ? "bg-amber-500/10 border-b-2 border-b-amber-500 text-white"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {st.num}
                    </span>
                    <span className="text-xs font-semibold">{st.title}</span>
                  </div>
                  {st.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                        st.badge.includes("건") || st.badge.includes("미생성")
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      {st.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 truncate w-full">{st.subtitle}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ================= STAGE 1: SCRIPT QA ================= */}
          {activeStage === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-amber-400" />
                    70씬 대본 및 Supertone TTS 호흡 규격 검수
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    각 장면의 글자수 (비디오 60~75자 7.5~9.5초 vs 이미지 115~140자 15초), 비디오 비율(10~15%), 시각 연출 누락 여부를 점검합니다.
                  </p>
                </div>
                <button
                  onClick={handleRunScriptQA}
                  disabled={isAuditingScript}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-amber-500/20"
                >
                  {isAuditingScript ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      대본 규격 검수 중...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      대본 규격 정밀 QA 실행
                    </>
                  )}
                </button>
              </div>

              {scriptQaResult && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">대본 규격 건강도</span>
                      <div className="text-2xl font-bold text-amber-400 mt-1">
                        {scriptQaResult.overallHealthScore}
                        <span className="text-xs text-slate-500 font-normal"> / 100점</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">총 예상 러닝타임</span>
                      <div className="text-2xl font-bold text-white mt-1">
                        {scriptQaResult.totalDurationMin}
                        <span className="text-xs text-slate-500 font-normal">분 ({scriptQaResult.totalDurationSec}초)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">비디오 씬 비율</span>
                      <div className="text-2xl font-bold text-cyan-400 mt-1">
                        {scriptQaResult.videoRatioPercent}%
                        <span className="text-xs text-slate-500 font-normal"> ({scriptQaResult.videoSceneCount}개 씬)</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">주의 / 결함 사항</span>
                      <div className="text-2xl font-bold text-rose-400 mt-1">
                        {scriptQaResult.errorCount + scriptQaResult.warningCount}
                        <span className="text-xs text-slate-500 font-normal">건</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300">
                    💡 <strong className="text-white">검수 요약:</strong> {scriptQaResult.summary}
                  </div>

                  {/* Filter & Scene List */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs font-semibold text-slate-300">장면별 검수 결과</div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setStage1Filter("all")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                          stage1Filter === "all" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        전체 ({scriptQaResult.items.length})
                      </button>
                      <button
                        onClick={() => setStage1Filter("warnings_only")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                          stage1Filter === "warnings_only" ? "bg-amber-500/20 text-amber-300 font-medium" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        주의/결함만 ({scriptQaResult.items.filter((i) => i.status !== "pass").length})
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {scriptQaResult.items
                      .filter((it) => (stage1Filter === "warnings_only" ? it.status !== "pass" : true))
                      .map((item) => {
                        const originalScene = scenes.find((s) => s.id === item.sceneId);
                        return (
                          <div
                            key={item.sceneId}
                            className={`p-3 rounded-xl border transition-all ${
                              item.status === "error"
                                ? "bg-rose-950/20 border-rose-800/50"
                                : item.status === "warning"
                                ? "bg-amber-950/20 border-amber-800/50"
                                : "bg-slate-950/40 border-slate-800/60"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-800 text-white">
                                  [S{item.sceneId}.]
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                                    item.mediaType === "video"
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                      : "bg-slate-800 text-slate-300"
                                  }`}
                                >
                                  {item.mediaType === "video" ? "VIDEO (10초)" : "IMAGE (15초)"}
                                </span>
                                <span className="text-xs text-slate-400">
                                  공백제외 {item.charCount}자 (약 {item.estimatedDurationSec}초)
                                </span>
                              </div>
                              <span
                                className={`text-xs font-semibold flex items-center gap-1 ${
                                  item.status === "error"
                                    ? "text-rose-400"
                                    : item.status === "warning"
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {item.status === "error" ? (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5" /> 결함 발견
                                  </>
                                ) : item.status === "warning" ? (
                                  <>
                                    <AlertTriangle className="w-3.5 h-3.5" /> 규격 주의
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> 통과
                                  </>
                                )}
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 line-clamp-1 italic">
                              "{originalScene?.narrationText}"
                            </p>

                            {item.issues.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                                {item.issues.map((iss, idx) => (
                                  <div key={idx} className="text-xs text-amber-300/90 flex items-start gap-1.5">
                                    <span className="text-amber-400">•</span>
                                    <span>{iss}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STAGE 2: IMAGE BATCH STATUS ================= */}
          {activeStage === 2 && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <h3 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    2단계: 전체 70씬 고속 배치 이미지 생성
                  </h3>
                  <p className="text-xs text-slate-400 max-w-lg">
                    설정된 화풍(클레이메이션/야담화/실사)과 캐릭터 일관성 앵커가 자동으로 주입되어 무결점 원클릭 배치 생성을 진행합니다.
                  </p>
                  <div className="flex items-center gap-4 text-xs pt-2">
                    <span className="text-slate-300">
                      총 장면: <strong className="text-white">{totalScenesCount}개</strong>
                    </span>
                    <span className="text-emerald-400">
                      생성 완료: <strong>{generatedScenesCount}개</strong>
                    </span>
                    <span className="text-amber-400">
                      미생성: <strong>{ungeneratedCount}개</strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      onBatchGenerateImages();
                      onClose();
                    }}
                    disabled={isGeneratingImages || ungeneratedCount === 0}
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                  >
                    {isGeneratingImages ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        이미지 생성 대기열 가동 중...
                      </>
                    ) : ungeneratedCount === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        모든 씬 이미지 생성 완료
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        미생성 {ungeneratedCount}개 씬 일괄 생성 시작
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveStage(3)}
                    disabled={generatedScenesCount === 0}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                  >
                    생성된 이미지 3단계 비전 QA 검수로 이동 <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STAGE 3: VISION AI QA ================= */}
          {activeStage === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    Gemini Vision AI 기반 이미지 품질 및 일관성 검수
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    생성된 이미지를 직접 스캔하여 ① 얼굴/손 기형 여부, ② 불필요한 한글/자막 침범 여부, ③ 복식/헤어 일관성을 엄격하게 판정합니다.
                  </p>
                </div>
                <button
                  onClick={handleRunVisionQA}
                  disabled={isAuditingVision || generatedScenesCount === 0}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-amber-500/20"
                >
                  {isAuditingVision ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      비전 AI 검수 중 ({visionProgress}%)...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      생성 이미지 전체 비전 QA 시작
                    </>
                  )}
                </button>
              </div>

              {visionQaResult && (
                <div className="space-y-4">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">비전 평균 품질 점수</span>
                      <div className="text-2xl font-bold text-amber-400 mt-1">
                        {visionQaResult.averageScore}
                        <span className="text-xs text-slate-500 font-normal"> / 100점</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">검수 완료 장면</span>
                      <div className="text-2xl font-bold text-white mt-1">
                        {visionQaResult.auditedCount}
                        <span className="text-xs text-slate-500 font-normal">개 씬</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">품질 통과 (PASS)</span>
                      <div className="text-2xl font-bold text-emerald-400 mt-1">
                        {visionQaResult.passedCount}
                        <span className="text-xs text-slate-500 font-normal">개 씬</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">재생성 권장 (결함)</span>
                      <div className="text-2xl font-bold text-rose-400 mt-1">
                        {visionQaResult.needsRegenCount}
                        <span className="text-xs text-slate-500 font-normal">개 씬</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter & Grid */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs font-semibold text-slate-300">비전 검수 상세 결과</div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setStage3Filter("all")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                          stage3Filter === "all" ? "bg-slate-800 text-white font-medium" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        전체 ({Object.keys(visionQaResult.items).length})
                      </button>
                      <button
                        onClick={() => setStage3Filter("failed_only")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                          stage3Filter === "failed_only" ? "bg-rose-500/20 text-rose-300 font-medium" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        결함/재생성 필요만 ({visionQaResult.needsRegenCount})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                    {(Object.values(visionQaResult.items) as VisionQACheckItem[])
                      .filter((it) => (stage3Filter === "failed_only" ? it.verdict === "NEEDS_REGENERATE" : true))
                      .map((item) => {
                        const targetScene = scenes.find((s) => s.id === item.sceneId);
                        const isDefect = item.verdict === "NEEDS_REGENERATE";
                        return (
                          <div
                            key={item.sceneId}
                            className={`p-3 rounded-xl border flex gap-3 ${
                              isDefect ? "bg-rose-950/20 border-rose-800/60" : "bg-slate-950/50 border-slate-800"
                            }`}
                          >
                            {targetScene?.imageUrl && (
                              <img
                                src={targetScene.imageUrl}
                                alt={`Scene ${item.sceneId}`}
                                className="w-20 h-20 object-cover rounded-lg border border-slate-700 shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white">[S{item.sceneId}.]</span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                    isDefect
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  }`}
                                >
                                  {item.verdict} ({item.overallScore}점)
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-0.5">
                                <span>이목구비: {item.facialQualityScore}점</span>
                                <span>복식일관: {item.clothingConsistencyScore}점</span>
                                <span>자막오염 없음: {item.noTextArtifactsScore}점</span>
                                <span>분위기: {item.atmosphereScore}점</span>
                              </div>

                              {item.detectedIssues && item.detectedIssues.length > 0 && (
                                <p className="text-[11px] text-rose-300/90 truncate">
                                  ⚠️ {item.detectedIssues.join(", ")}
                                </p>
                              )}
                              {item.fixPromptTip && (
                                <p className="text-[10px] text-amber-300/80 line-clamp-1 italic">
                                  💡 팁: {item.fixPromptTip}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STAGE 4: TARGETED REGENERATION ================= */}
          {activeStage === 4 && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <h3 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-400" />
                    4단계: 결함 발견 장면만 원클릭 선별 재생성
                  </h3>
                  <p className="text-xs text-slate-400 max-w-lg">
                    3단계 비전 AI 검수에서 얼굴 왜곡이나 텍스트 침범으로 지적받은 장면들만 즉시 필터링하여 프롬프트를 자동 보정한 후 일괄 재생성합니다.
                  </p>
                  <div className="pt-2 text-xs">
                    {failedSceneIds.length > 0 ? (
                      <span className="text-rose-400 font-semibold">
                        ⚠️ 재생성 필요 대상: {failedSceneIds.length}개 장면 (Scene {failedSceneIds.join(", ")})
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">
                        ✨ 결함이 발견된 장면이 없습니다! 모든 이미지가 정상입니다.
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  <button
                    onClick={handleRegenerateFailedOnly}
                    disabled={failedSceneIds.length === 0}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg shadow-amber-500/20"
                  >
                    <RotateCcw className="w-4 h-4" />
                    결함 {failedSceneIds.length}개 장면만 선별 재생성
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            총 {totalScenesCount}개 씬 중 {generatedScenesCount}개 이미지 보유 • V2 QA 파이프라인
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
};
