/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ComfyUI Dual-Mode Automation Director & Script Generator
 * Mode 1: Traditional Manual Workflow (1-click clipboard prompt copy)
 * Mode 2: Automated ComfyUI API Batch Render Python Script (.py) Generator
 * Smartly filters video scenes vs static image scenes to automate LTX 2.3 rendering without manual drag-and-drop.
 */

import React, { useState } from "react";
import {
  Film,
  Zap,
  Terminal,
  Download,
  Copy,
  Check,
  Settings2,
  FolderOpen,
  HelpCircle,
  Play,
  Layers,
  X,
  Code2,
  Cpu,
} from "lucide-react";
import { motion } from "motion/react";
import { SceneItem } from "../types";

interface ComfyUIModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: SceneItem[];
  showFeedback: (msg: string, type: "success" | "error" | "info") => void;
}

export const ComfyUIModal: React.FC<ComfyUIModalProps> = ({
  isOpen,
  onClose,
  scenes,
  showFeedback,
}) => {
  const [activeTab, setActiveTab] = useState<"automated" | "manual">("automated");
  const [comfyUrl, setComfyUrl] = useState("http://127.0.0.1:8188");
  const [imageFolder, setImageFolder] = useState("./images");
  const [outputFolder, setOutputFolder] = useState("./output_videos");
  const [steps, setSteps] = useState(25);
  const [cfg, setCfg] = useState(3.0);
  const [fps, setFps] = useState(24);
  const [motionStrength, setMotionStrength] = useState(0.85);
  const [copiedCode, setCopiedCode] = useState(false);
  const [uploadedWorkflowJson, setUploadedWorkflowJson] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter video scenes (auto identify video scenes from storyboard)
  const videoScenes = scenes.filter((s) => s.mediaType === "video" || s.ltxRecommended || s.id <= 8);
  const staticScenes = scenes.filter((s) => !videoScenes.some((vs) => vs.id === s.id));

  // Generate python batch script
  const generatePythonScript = (): string => {
    const videoSceneManifest = videoScenes.map((s) => ({
      scene_id: s.id,
      image_filename: `scene_${String(s.id).padStart(3, "0")}.png`,
      positive_prompt: s.ltxPrompt || s.refinedImagePrompt || "smooth cinematic motion, subtle traditional korean atmosphere, slow camera pan",
      negative_prompt: "worst quality, blurry, text, watermark, deformed limbs, rapid jittering, static freeze",
      duration_sec: s.durationSeconds || 10,
    }));

    return `# ==============================================================================
# Yadam FactLab Studio V2 - ComfyUI LTX 2.3 Automated Batch Renderer
# Generated on: ${new Date().toISOString()}
# Total Scenes: ${scenes.length} | Video Target Scenes: ${videoScenes.length} (Static Image Scenes: ${staticScenes.length} Automatically Skipped)
# ==============================================================================

import os
import sys
import json
import time
import urllib.request
import urllib.parse

COMFYUI_URL = "${comfyUrl}"
IMAGE_DIR = os.path.abspath("${imageFolder}")
OUTPUT_DIR = os.path.abspath("${outputFolder}")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 🎯 Target Video Scenes Manifest (Static Image Scenes are Automatically Excluded)
VIDEO_SCENES = ${JSON.stringify(videoSceneManifest, null, 4)}

def check_comfyui_connection():
    print(f"[*] ComfyUI 서버 연결 확인 중: {COMFYUI_URL} ...")
    try:
        req = urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=5)
        if req.status == 200:
            print("[+] ComfyUI 연결 성공!")
            return True
    except Exception as e:
        print(f"[!] ComfyUI 서버에 연결할 수 없습니다 ({e}).")
        print("[!] ComfyUI가 백그라운드에서 실행 중인지 확인해 주세요 (기본: http://127.0.0.1:8188).")
        return False

def build_ltx_workflow_payload(scene_info, image_path):
    """
    Standard LTX 2.3 Image-to-Video Workflow Payload Generator
    """
    positive_prompt = scene_info["positive_prompt"]
    negative_prompt = scene_info["negative_prompt"]
    
    workflow = {
        "3": {
            "inputs": {
                "seed": int(time.time() * 1000) % 1000000007,
                "steps": ${steps},
                "cfg": ${cfg},
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": ${motionStrength},
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["11", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": "ltx-video-2b-v0.9.1.safetensors"
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "6": {
            "inputs": {
                "text": positive_prompt,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": negative_prompt,
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "10": {
            "inputs": {
                "image": image_path,
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        "11": {
            "inputs": {
                "pixels": ["10", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "12": {
            "inputs": {
                "filename_prefix": f"Yadam_Scene_{scene_info['scene_id']:03d}",
                "fps": ${fps},
                "images": ["8", 0]
            },
            "class_type": "SaveAnimatedWEBP"
        }
    }
    return {"prompt": workflow}

def queue_prompt(prompt_workflow):
    data = json.dumps(prompt_workflow).encode('utf-8')
    req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"[!] 큐 전송 실패: {e}")
        return None

def main():
    print("=" * 70)
    print("🎬 Yadam FactLab Studio V2 - ComfyUI LTX 2.3 일괄 자동 렌더러")
    print(f"[*] 총 {len(VIDEO_SCENES)}개의 비디오 씬을 순차적으로 ComfyUI에 큐잉합니다.")
    print("=" * 70)

    if not check_comfyui_connection():
        sys.exit(1)

    success_count = 0
    for idx, scene in enumerate(VIDEO_SCENES, start=1):
        scene_id = scene["scene_id"]
        img_name = scene["image_filename"]
        img_full_path = os.path.join(IMAGE_DIR, img_name)

        print(f"\\n[{idx}/{len(VIDEO_SCENES)}] 씬 {scene_id} 비디오 렌더링 큐 전송 중...")
        print(f" - 프롬프트: {scene['positive_prompt'][:70]}...")
        
        payload = build_ltx_workflow_payload(scene, img_name)
        res = queue_prompt(payload)
        
        if res and "prompt_id" in res:
            print(f" [+] 씬 {scene_id} 큐 등록 완료! (Prompt ID: {res['prompt_id']})")
            success_count += 1
        else:
            print(f" [!] 씬 {scene_id} 큐 등록 실패.")

        time.sleep(1)

    print("\\n" + "=" * 70)
    print(f"✨ 전체 {len(VIDEO_SCENES)}개 비디오 씬 중 {success_count}개 큐 등록 완료!")
    print(f"[*] ComfyUI 렌더링 결과를 {OUTPUT_DIR} 에서 확인하세요.")
    print("=" * 70)

if __name__ == "__main__":
    main()
`;
  };

  const handleDownloadPythonScript = () => {
    const scriptContent = generatePythonScript();
    const blob = new Blob([scriptContent], { type: "text/x-python;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "comfyui_batch_render.py";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback("ComfyUI LTX 2.3 일괄 자동 렌더링 파이썬 스크립트가 다운로드되었습니다!", "success");
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatePythonScript());
    setCopiedCode(true);
    showFeedback("파이썬 스크립트가 클립보드에 복사되었습니다.", "success");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        JSON.parse(text); // validate
        setUploadedWorkflowJson(text);
        showFeedback("사용자 맞춤 ComfyUI API JSON 워크플로우가 등록되었습니다.", "success");
      } catch {
        showFeedback("올바른 JSON 파일이 아닙니다.", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">ComfyUI 듀얼 모드 자동화 도구</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  LTX 2.3 I2V
                </span>
              </div>
              <p className="text-xs text-slate-400">
                수동 드래그 앤 드롭 없이 70씬 중 비디오 씬만 자동 판별하여 ComfyUI API로 일괄 렌더링
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

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab("automated")}
            className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "automated"
                ? "border-b-cyan-400 text-cyan-300 bg-cyan-500/10"
                : "border-b-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-4 h-4" /> [신규] 원클릭 API 자동화 스크립트 모드
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "manual"
                ? "border-b-amber-400 text-amber-300 bg-amber-500/10"
                : "border-b-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" /> [기존] 씬별 프롬프트 수동 복사 모드
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "automated" ? (
            <div className="space-y-6">
              {/* Stat Banner */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[11px] text-slate-400">자동 판별된 비디오 씬</span>
                    <div className="text-xl font-bold text-cyan-400 mt-0.5">
                      {videoScenes.length}개 씬
                      <span className="text-xs text-slate-500 font-normal"> (전체 {scenes.length}개 중)</span>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-800" />
                  <div>
                    <span className="text-[11px] text-slate-400">정지 이미지 씬 (자동 패스)</span>
                    <div className="text-xl font-bold text-slate-400 mt-0.5">{staticScenes.length}개 씬</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPythonScript}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="w-4 h-4" />
                    comfyui_batch_render.py 다운로드
                  </button>
                  <button
                    onClick={handleCopyScript}
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    코드 복사
                  </button>
                </div>
              </div>

              {/* Automation Settings */}
              <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-cyan-400" />
                  ComfyUI 로컬 연결 및 렌더링 설정
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">ComfyUI API 주소</label>
                    <input
                      type="text"
                      value={comfyUrl}
                      onChange={(e) => setComfyUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">이미지 소스 폴더</label>
                    <input
                      type="text"
                      value={imageFolder}
                      onChange={(e) => setImageFolder(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">비디오 저장 폴더</label>
                    <input
                      type="text"
                      value={outputFolder}
                      onChange={(e) => setOutputFolder(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Sampling Steps</label>
                    <input
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">CFG Scale</label>
                    <input
                      type="number"
                      step="0.5"
                      value={cfg}
                      onChange={(e) => setCfg(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">FPS</label>
                    <input
                      type="number"
                      value={fps}
                      onChange={(e) => setFps(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Motion Strength</label>
                    <input
                      type="number"
                      step="0.05"
                      value={motionStrength}
                      onChange={(e) => setMotionStrength(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Quick How-to-use */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  3초 만에 ComfyUI 비디오 일괄 렌더링 실행하는 법:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                  <li>ComfyUI를 컴퓨터에서 실행합니다.</li>
                  <li>
                    다운로드한 <code className="text-cyan-300">comfyui_batch_render.py</code> 파일을 이미지가 있는 폴더에 넣습니다.
                  </li>
                  <li>
                    터미널(명령 프롬프트)에서 <code className="text-amber-300 font-mono bg-slate-900 px-2 py-0.5 rounded">python comfyui_batch_render.py</code> 를 실행하면 끝!
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            /* Manual Workflow Tab */
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                💡 <strong>기존 수동 방식:</strong> 특정 장면만 개별적으로 ComfyUI에서 직접 테스트하거나 프롬프트를 복사할 수 있습니다.
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {videoScenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-800 text-white">
                          [S{scene.id}.]
                        </span>
                        <span className="text-xs font-semibold text-cyan-300">LTX 2.3 비디오 대상 씬</span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono line-clamp-2">
                        {scene.ltxPrompt || scene.refinedImagePrompt}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(scene.ltxPrompt || scene.refinedImagePrompt || "");
                        showFeedback(`[S${scene.id}.] LTX 프롬프트가 클립보드에 복사되었습니다.`, "success");
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" /> 복사
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            ComfyUI API 연동 & LTX 2.3 I2V 파이프라인
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
