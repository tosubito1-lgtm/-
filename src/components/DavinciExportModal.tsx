import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  X,
  Sparkles,
  Subtitles,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FolderSearch,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { triggerFileDownload } from '../utils/audioUtils';
import { generateDavinciScript, DavinciScriptResult } from '../utils/davinciScriptGenerator';
import { SceneItem } from '../types';

interface DavinciScriptData {
  code: string;
  timestamp: string;
  sceneCount: number;
  title: string;
  davinciSrtContent?: string;
  standardSrtContent?: string;
}

interface DavinciExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptData: DavinciScriptData | null;
  scenes?: SceneItem[];
  analysis?: any;
  onShowFeedback: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DavinciExportModal: React.FC<DavinciExportModalProps> = ({
  isOpen,
  onClose,
  scriptData,
  scenes,
  analysis,
  onShowFeedback,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [customFolderPath, setCustomFolderPath] = useState('');
  const [activeScript, setActiveScript] = useState<DavinciScriptData | null>(scriptData);

  // Sync activeScript with prop or regenerate when customFolderPath changes
  useEffect(() => {
    if (scenes && scenes.length > 0) {
      const generated = generateDavinciScript(scenes, analysis, customFolderPath);
      setActiveScript(generated);
    } else if (scriptData) {
      setActiveScript(scriptData);
    }
  }, [customFolderPath, scenes, analysis, scriptData]);

  if (!isOpen || !activeScript) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(activeScript.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    onShowFeedback('다빈치 파이썬 스크립트가 클립보드에 복사되었습니다!', 'success');
  };

  const handleDownloadPy = () => {
    const blob = new Blob([activeScript.code], { type: 'text/x-python;charset=utf-8' });
    triggerFileDownload(blob, `yadam_davinci_auto_batch_${Date.now()}.py`);
    onShowFeedback('파이썬 스크립트 파일(.py)이 다운로드되었습니다.', 'success');
  };

  const handleDownloadDavinciSrt = () => {
    if (!activeScript.davinciSrtContent) {
      onShowFeedback('자막 데이터가 존재하지 않습니다.', 'error');
      return;
    }
    const blob = new Blob([activeScript.davinciSrtContent], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, 'yadam_subtitles_01_davinci.srt');
    onShowFeedback('다빈치 01:00:00:00 전용 자막(.srt)이 다운로드되었습니다!', 'success');
  };

  const handleDownloadStandardSrt = () => {
    if (!activeScript.standardSrtContent) {
      onShowFeedback('자막 데이터가 존재하지 않습니다.', 'error');
      return;
    }
    const blob = new Blob([activeScript.standardSrtContent], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, 'yadam_subtitles_00_standard.srt');
    onShowFeedback('표준 00:00:00 자막(.srt)이 다운로드되었습니다!', 'success');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          className="bg-[#101116] border border-emerald-500/40 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden text-white/90 relative my-6 flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-[#161720]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>다빈치 리졸브 원클릭 마스터 자동화 (DaVinci Resolve)</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                    v2.7 DeepScan Master
                  </span>
                </h2>
                <p className="text-xs text-white/50 font-mono">
                  {activeScript.title} • 총 {activeScript.sceneCount}개 씬 에셋 심층 자동 매칭 ({activeScript.timestamp})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
            {/* Quick Reassurance Banner */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-black/40 border border-emerald-500/40 rounded-xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                  <span>MP4 비디오 & MP3 오디오 무변환 지원 + 하위폴더 스마트 자동 감지</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">
                    100% 자동 매칭
                  </span>
                </div>
                <p className="text-emerald-200/80 leading-relaxed">
                  다빈치 콘솔에 복사 후 붙여넣으시면, 사용자의 <strong className="text-white">다운로드 / 바탕화면 / 하위 폴더</strong>에 있는 씬 미디어(MP4 비디오 & PNG/JPG 이미지)와 성우 음성(MP3/WAV)을 <strong className="text-white">재귀적으로 자동 탐색</strong>하여 타임라인에 1초 만에 완성합니다.
                </p>
              </div>
            </div>

            {/* Folder Path Config Card (Optional Custom Path or Smart Auto Scan) */}
            <div className="bg-[#14151e] border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="custom-asset-path-input" className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  <span>에셋 작업 폴더 경로 (선택 사항)</span>
                </label>
                <span className="text-[11px] text-white/50">
                  {customFolderPath.trim() ? '🎯 지정된 폴더 우선 로드' : '⚡ 비워두면 자동 심층 탐색'}
                </span>
              </div>

              <div className="relative">
                <input
                  id="custom-asset-path-input"
                  type="text"
                  value={customFolderPath}
                  onChange={(e) => setCustomFolderPath(e.target.value)}
                  placeholder="예: C:\Users\홍길동\Downloads\yadam_storyboard_2026-08-30 (비워두셔도 자동 감지됩니다)"
                  className="w-full bg-[#0a0b0f] border border-white/15 focus:border-emerald-500 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors"
                />
                {customFolderPath && (
                  <button
                    onClick={() => setCustomFolderPath('')}
                    className="absolute right-3 top-2.5 text-white/40 hover:text-white text-xs"
                    title="초기화"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-start gap-2 text-[11px] text-white/60 bg-white/5 p-2.5 rounded-lg">
                <FolderSearch className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-emerald-300">자동 탐색 안내:</strong> 압축을 푼 폴더가 [다운로드] 또는 [바탕화면]에 있다면 <strong className="text-white">경로를 입력하지 않고 바로 복사</strong>하셔도 스크립트가 씬 번호(1~{activeScript.sceneCount})를 대조하여 해당 폴더를 자동으로 찾아냅니다! 만약 D:\드라이브나 특정 외장 경로에 저장하셨다면 위 입력창에 폴더 경로를 붙여넣어 주세요.
                </p>
              </div>
            </div>

            {/* 3-Step Execution Guide */}
            <div className="bg-[#15161f] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="text-white font-bold text-xs sm:text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>다빈치 리졸브 3초 원클릭 실행 방법 (가장 쉬운 실행법)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#0e0f14] border border-white/5 rounded-lg p-3 space-y-1.5">
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px]">1</span>
                    다빈치 콘솔 열기
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    다빈치 상단 메뉴: <strong className="text-white">[Workspace]</strong> ➔ <strong className="text-white">[Console]</strong> 창 열기
                  </p>
                </div>

                <div className="bg-[#0e0f14] border border-white/5 rounded-lg p-3 space-y-1.5">
                  <div className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[10px]">2</span>
                    [Py3] 탭 선택
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    콘솔 창 우측 상단 언어 선택에서 <strong className="text-amber-300 font-bold">[Py3]</strong> 탭을 클릭
                  </p>
                </div>

                <div className="bg-[#0e0f14] border border-white/5 rounded-lg p-3 space-y-1.5">
                  <div className="text-cyan-400 font-bold text-xs flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-[10px]">3</span>
                    복사 & 붙여넣기
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    아래 <strong className="text-emerald-300">[📋 스크립트 복사]</strong> 누른 후 콘솔에 <strong className="text-white">Ctrl+V ➔ Enter</strong>!
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Copy Script Button */}
              <button
                id="btn-davinci-copy-script"
                onClick={handleCopyScript}
                className="py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2.5 active:scale-[0.98]"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-emerald-200" />
                    <span>복사 완료! (다빈치 콘솔에 붙여넣으세요)</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 text-emerald-200" />
                    <span>📋 스크립트 1클릭 복사 (가장 빠름 ⭐)</span>
                  </>
                )}
              </button>

              {/* Download .py Button */}
              <button
                id="btn-davinci-download-py"
                onClick={handleDownloadPy}
                className="py-3.5 px-4 bg-[#1b1c26] hover:bg-[#222430] border border-white/10 hover:border-white/20 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98]"
              >
                <Download className="w-5 h-5 text-cyan-400" />
                <span>💾 .py 파일 다운로드 (yadam_davinci_auto_batch.py)</span>
              </button>
            </div>

            {/* Subtitle Downloads Row */}
            <div className="bg-[#14151c] border border-purple-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs sm:text-sm">
                  <Subtitles className="w-4 h-4 text-purple-400" />
                  <span>자막(SRT) 파일 다운로드</span>
                </div>
                <span className="text-[10px] text-white/50 font-mono">
                  다빈치 편집 시 01_davinci.srt 사용
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Davinci SRT */}
                <button
                  onClick={handleDownloadDavinciSrt}
                  className="p-3 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/40 rounded-lg text-left transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-purple-200 group-hover:text-purple-100 flex items-center gap-1.5">
                      <span>⭐ 다빈치 전용 자막 (01:00:00:00)</span>
                    </div>
                    <p className="text-[10px] text-white/60">
                      다빈치 타임라인 기본 시작 시간에 100% 맞춤
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-purple-400 group-hover:text-purple-300 shrink-0 ml-2" />
                </button>

                {/* Standard SRT */}
                <button
                  onClick={handleDownloadStandardSrt}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white/90 group-hover:text-white flex items-center gap-1.5">
                      <span>📄 일반 표준 자막 (00:00:00:00)</span>
                    </div>
                    <p className="text-[10px] text-white/50">
                      유튜브 업로드 / 일반 영상 플레이어용
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-white/60 group-hover:text-white shrink-0 ml-2" />
                </button>
              </div>
            </div>

            {/* Python Code Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/70 font-mono">
                <span className="flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  파이썬 스크립트 코드 미리보기 (문법 검증 100% 완료)
                </span>
                <span className="text-[10px] text-white/40">
                  {activeScript.code.split('\n').length}줄
                </span>
              </div>
              <div className="relative group">
                <pre className="p-4 bg-[#090a0d] border border-white/10 rounded-xl text-emerald-400/90 font-mono text-[11px] leading-relaxed max-h-56 overflow-y-auto custom-scrollbar select-all">
                  {activeScript.code}
                </pre>
                <button
                  onClick={handleCopyScript}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-[#1b1c26]/90 hover:bg-[#222430] border border-white/10 hover:border-white/20 text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-md backdrop-blur-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? '복사 완료' : '코드 복사'}
                </button>
              </div>
            </div>

            {/* Collapsible FAQ & Tips */}
            <div className="border border-white/10 rounded-xl overflow-hidden bg-[#13141a]">
              <button
                onClick={() => setShowTips(!showTips)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>자주 묻는 질문 & 문제 해결 팁</span>
                </span>
                {showTips ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
              </button>

              {showTips && (
                <div className="p-4 pt-1 border-t border-white/5 space-y-3 text-xs text-white/80">
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-300">
                      ❓ "미디어 파일 미발견" 메시지가 뜨는 경우 어떻게 하나요?
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      이미지/동영상 파일들이 들어있는 폴더 경로(예: <code className="text-amber-300 bg-white/10 px-1 py-0.5 rounded">C:\Users\username\Downloads\yadam_storyboard_...</code>)를 상단 <strong className="text-white">[에셋 작업 폴더 경로]</strong> 입력창에 붙여넣으신 후 다시 [📋 스크립트 복사]를 누르시면 100% 완벽하게 인식됩니다.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-emerald-300">
                      ❓ 파일명 형식은 어떻게 해야 하나요?
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      <code className="text-emerald-300">scene_001.png</code>, <code className="text-emerald-300">scene_01.png</code>, <code className="text-emerald-300">1.png</code>, <code className="text-emerald-300">cut_01.png</code>, <code className="text-emerald-300">ltx_01.mp4</code> 등 어떤 이름 형식이어도 번호를 자동으로 인식하여 씬 순서대로 정렬합니다.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-emerald-300">
                      ❓ MP4 영상이나 MP3 음원을 WAV로 변환해야 하나요?
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      전혀 변환하실 필요가 없습니다. 다빈치 리졸브는 MP4 비디오와 MP3 오디오를 네이티브로 완벽하게 지원하므로, 원본 파일 그대로 사용하시면 됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/10 bg-[#161720] flex items-center justify-between text-xs text-white/50">
            <span className="flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              DaVinci Resolve 18 / 19 / Studio 완벽 호환
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
