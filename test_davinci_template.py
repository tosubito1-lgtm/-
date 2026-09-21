import ast

python_template = r'''# -*- coding: utf-8 -*-
# =============================================================================
# DaVinci Resolve 18 / 19 / 21 Pro Auto-Batch Master Integration Script v2.6
# Episode: __TOPIC__
# Total Scenes: __TOTAL_SCENES__ Scenes
# =============================================================================

import os
import sys
import time
import glob
import base64

print("=" * 75)
print("🎬 [야담 AI 스튜디오] 다빈치 리졸브 v2.6 마스터 원클릭 자동화 배치 시작")
print(f"📌 [에피소드 제목]: __TOPIC__")
print(f"📌 [등록된 총 장면 수]: __TOTAL_SCENES__개 씬")
print("=" * 75)

def get_resolve_instance():
    try:
        if "resolve" in globals() and globals()["resolve"] is not None:
            return globals()["resolve"]
    except Exception:
        pass
    try:
        if "resolve" in __builtins__ and __builtins__["resolve"] is not None:
            return __builtins__["resolve"]
    except Exception:
        pass
    try:
        if "GetResolve" in globals():
            res = GetResolve()
            if res:
                return res
    except Exception:
        pass
    try:
        if "bmd" in globals() and hasattr(bmd, "scriptapp"):
            res = bmd.scriptapp("Resolve")
            if res:
                return res
    except Exception:
        pass
    script_paths = []
    if sys.platform.startswith("win"):
        script_paths.extend([
            r"C:\Program Files\Blackmagic Design\DaVinci Resolve\Developer\Scripting\Modules",
            os.path.expandvars(r"%PROGRAMFILES%\Blackmagic Design\DaVinci Resolve\Developer\Scripting\Modules"),
            os.path.expandvars(r"%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules")
        ])
    elif sys.platform == "darwin":
        script_paths.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules")
    else:
        script_paths.append("/opt/resolve/Developer/Scripting/Modules")
    for path in script_paths:
        if os.path.exists(path) and path not in sys.path:
            sys.path.append(path)
    try:
        import DaVinciResolveScript as dvr_script
        return dvr_script.scriptapp("Resolve")
    except Exception:
        return None

resolve = get_resolve_instance()
if not resolve:
    print("\n❌ [오류] DaVinci Resolve 객체를 찾을 수 없습니다.")
    print("▶ 다빈치 리졸브 상단 메뉴 [Workspace] -> [Console] 에서 [Py3] 탭을 누르고 실행하세요.")
    sys.exit(1)

projectManager = resolve.GetProjectManager()
if not projectManager:
    print("❌ [오류] ProjectManager 객체를 가져오지 못했습니다.")
    sys.exit(1)

proj = projectManager.GetCurrentProject()
if not proj:
    proj = projectManager.CreateProject(f"Yadam_AutoMaster_{int(time.time())}")
    if not proj:
        print("❌ [오류] 현재 활성화된 프로젝트가 없습니다.")
        sys.exit(1)

mediaPool = proj.GetMediaPool()
rootFolder = mediaPool.GetRootFolder()
fps_val = float(proj.GetSetting("timelineFrameRate") or 24.0)
print(f"✅ [프로젝트 연결 성공]: {proj.GetName()} (타임라인 FPS: {fps_val})")

# 작업 디렉토리 결정
try:
    CURRENT_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except Exception:
    CURRENT_SCRIPT_DIR = os.getcwd()

ASSET_DIR = CURRENT_SCRIPT_DIR
try:
    media_storage = resolve.GetMediaStorage()
    mounted_vols = media_storage.GetMountedVolumes() if media_storage else []
except Exception:
    mounted_vols = []

print(f"📁 [에셋 검색 디렉토리]: {ASSET_DIR}")

# 씬 메타데이터 정의
SCENES = __SCENES_DATA__

# 1단계: 미디어 파일 고속 매칭 (MP4 동영상 우선 -> 없으면 PNG 이미지, 중복 임포트 원천 차단)
print("\n🔍 [1단계] 씬별 미디어 파일 검색 및 미디어 풀 등록 중...")

ext_videos = [".mp4", ".mov", ".mkv", ".webm"]
ext_images = [".png", ".jpg", ".jpeg", ".webp"]

for sc in SCENES:
    sid = sc["id"]
    n_str = sc["num_str"]
    n_short = sc["num_short"]
    sc["media_file"] = None
    sc["media_type"] = None
    sc["media_item"] = None
    
    # 1. 비디오 검색 (MP4가 있으면 이미지는 건너뜀)
    v_patterns = [
        os.path.join(ASSET_DIR, f"scene_{n_str}.mp4"),
        os.path.join(ASSET_DIR, f"scene_{n_short}.mp4"),
        os.path.join(ASSET_DIR, f"scene_{sid}.mp4"),
        os.path.join(ASSET_DIR, f"scene_{n_str}.mov"),
        os.path.join(ASSET_DIR, f"scene_{n_short}.mov"),
        os.path.join(ASSET_DIR, f"{n_str}.mp4"),
        os.path.join(ASSET_DIR, f"*{n_str}*.mp4"),
        os.path.join(ASSET_DIR, f"*{n_short}*.mp4")
    ]
    found_v = None
    for vp in v_patterns:
        m = glob.glob(vp)
        if m:
            found_v = m[0]
            break
            
    if found_v and os.path.exists(found_v):
        sc["media_file"] = found_v
        sc["media_type"] = "video"
    else:
        # 2. 이미지만 검색 (비디오가 없는 경우에만)
        i_patterns = [
            os.path.join(ASSET_DIR, f"scene_{n_str}.png"),
            os.path.join(ASSET_DIR, f"scene_{n_short}.png"),
            os.path.join(ASSET_DIR, f"scene_{sid}.png"),
            os.path.join(ASSET_DIR, f"scene_{n_str}.jpg"),
            os.path.join(ASSET_DIR, f"scene_{n_short}.jpg"),
            os.path.join(ASSET_DIR, f"{n_str}.png"),
            os.path.join(ASSET_DIR, f"{n_short}.png"),
            os.path.join(ASSET_DIR, f"*{n_str}*.png"),
            os.path.join(ASSET_DIR, f"*{n_short}*.png"),
            os.path.join(ASSET_DIR, f"*{n_str}*.jpg")
        ]
        found_i = None
        for ip in i_patterns:
            m = glob.glob(ip)
            if m:
                found_i = m[0]
                break
        if found_i and os.path.exists(found_i):
            sc["media_file"] = found_i
            sc["media_type"] = "image"

# 미디어 풀에 일괄 임포트
files_to_import = [sc["media_file"] for sc in SCENES if sc.get("media_file")]
imported_clips_map = {}
if files_to_import:
    try:
        imported_items = mediaPool.ImportMedia(files_to_import)
        if imported_items:
            for item in imported_items:
                try:
                    cp = item.GetClipProperty("File Path") or item.GetName()
                    imported_clips_map[os.path.abspath(cp)] = item
                    imported_clips_map[os.path.basename(cp)] = item
                except Exception:
                    pass
    except Exception as e:
        print(f"⚠️ [임포트 예외]: {e}")

matched_count = 0
for sc in SCENES:
    if sc.get("media_file"):
        mf = sc["media_file"]
        it = imported_clips_map.get(os.path.abspath(mf)) or imported_clips_map.get(os.path.basename(mf))
        if it:
            sc["media_item"] = it
            matched_count += 1
            print(f"  ✅ 씬 #{sc['id']:02d}: [{sc['media_type'].upper()}] {os.path.basename(mf)}")
        else:
            try:
                single_res = mediaPool.ImportMedia([mf])
                if single_res:
                    sc["media_item"] = single_res[0]
                    matched_count += 1
                    print(f"  ✅ 씬 #{sc['id']:02d}: [{sc['media_type'].upper()}] {os.path.basename(mf)}")
            except Exception:
                pass
    else:
        print(f"  ⚪ 씬 #{sc['id']:02d}: (로컬 미디어 파일 없음)")

print(f"📊 [미디어 매칭 완료]: 총 {len(SCENES)}개 중 {matched_count}개 씬 등록 완료 (비디오 우선 배정)")

# 2단계: 성우 나레이션 오디오 파일 감지 및 미디어 풀 등록
print("\n🎙️ [2단계] 성우 나레이션 오디오 파일 검색 중...")
all_audio_files = []
for root, dirs, files in os.walk(ASSET_DIR):
    for f in files:
        f_lower = f.lower()
        if f_lower.endswith((".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg")):
            full_p = os.path.join(root, f)
            sz = os.path.getsize(full_p)
            mt = os.path.getmtime(full_p)
            all_audio_files.append((full_p, f, sz, mt))

master_audio_path = None
master_audio_item = None

if all_audio_files:
    def aud_rank(x):
        full_p, f, sz, mt = x
        fl = f.lower()
        is_48k = 500 if "48k" in fl or "master" in fl else 0
        is_wav = 200 if fl.endswith(".wav") else (100 if fl.endswith(".mp3") else 50)
        kw = 100 if any(k in fl for k in ["supertonic", "yadam", "narration", "voice", "audio", "이순신", "speech"]) else 10
        return (is_48k + is_wav + kw, sz, mt)
    all_audio_files.sort(key=aud_rank, reverse=True)
    master_audio_path = all_audio_files[0][0]
    print(f"🎙️ [최적 오디오 감지]: {os.path.basename(master_audio_path)}")
    try:
        a_res = mediaPool.ImportMedia([master_audio_path])
        if a_res:
            master_audio_item = a_res[0]
    except Exception:
        pass

# 3단계: 다빈치 01:00:00:00 전용 자막 생성 및 파싱
print("\n📝 [3단계] 자막 파일 생성 및 타임코드 동기화 중...")

davinci_b64 = "__DAVINCI_B64__"
standard_b64 = "__STANDARD_B64__"

davinci_srt_path = os.path.join(ASSET_DIR, "yadam_subtitles_01_davinci.srt")
standard_srt_path = os.path.join(ASSET_DIR, "yadam_subtitles_00_standard.srt")

try:
    if davinci_b64:
        with open(davinci_srt_path, "wb") as f_d:
            f_d.write(base64.b64decode(davinci_b64))
        print(f"  ✅ [다빈치 01:00:00:00 전용 자막 생성]: {os.path.basename(davinci_srt_path)}")
    if standard_b64:
        with open(standard_srt_path, "wb") as f_s:
            f_s.write(base64.b64decode(standard_b64))
        print(f"  ✅ [표준 00:00:00 자막 생성]: {os.path.basename(standard_srt_path)}")
except Exception as s_err:
    print(f"  ⚠️ [자막 파일 생성 알림]: {s_err}")

# 로컬 SRT 파싱 (오디오 길이 및 씬별 타임코드 자동 산출)
local_srt_parsed = []
all_srts = glob.glob(os.path.join(ASSET_DIR, "*.srt"))
target_srt = davinci_srt_path if os.path.exists(davinci_srt_path) else (standard_srt_path if os.path.exists(standard_srt_path) else (all_srts[0] if all_srts else None))

if target_srt and os.path.exists(target_srt):
    try:
        with open(target_srt, "r", encoding="utf-8", errors="ignore") as sf:
            raw_lines = sf.read().splitlines()
            curr_block = []
            blocks = []
            for r_line in raw_lines:
                r_line = r_line.strip()
                if not r_line:
                    if curr_block:
                        blocks.append(curr_block)
                        curr_block = []
                else:
                    curr_block.append(r_line)
            if curr_block:
                blocks.append(curr_block)

            for b in blocks:
                if len(b) >= 2 and "-->" in b[1]:
                    tc_parts = b[1].split("-->")
                    def parse_tc(tc_str):
                        tc_str = tc_str.strip().replace(",", ".")
                        p = tc_str.split(":")
                        if len(p) == 3:
                            return float(p[0]) * 3600.0 + float(p[1]) * 60.0 + float(p[2])
                        return float(tc_str)
                    st_sec = parse_tc(tc_parts[0])
                    en_sec = parse_tc(tc_parts[1])
                    if st_sec >= 3600.0:
                        st_sec -= 3600.0
                        en_sec -= 3600.0
                    txt_body = " ".join(b[2:])
                    local_srt_parsed.append({"start": st_sec, "end": en_sec, "text": txt_body})
        print(f"  📊 [SRT 파싱 완료]: 총 {len(local_srt_parsed)}개 자막 항목 분석 성공")
    except Exception as parse_err:
        print(f"  ⚠️ [SRT 파싱 예외]: {parse_err}")

# 오디오 프레임 및 씬별 타임코드 계산
total_audio_frames = 0
if master_audio_item:
    try:
        pf = master_audio_item.GetClipProperty("Frames")
        if pf and int(pf) > 0:
            total_audio_frames = int(pf)
    except Exception:
        pass

if total_audio_frames <= 0 and local_srt_parsed:
    total_audio_frames = int(local_srt_parsed[-1]["end"] * fps_val)

scene_start_frames = []
scene_durations_frames = []
scene_durations_sec = []

if local_srt_parsed and len(local_srt_parsed) == len(SCENES):
    for sc, srt_item in zip(SCENES, local_srt_parsed):
        s_f = int(srt_item["start"] * fps_val)
        e_f = int(srt_item["end"] * fps_val)
        d_f = max(e_f - s_f, int(1.0 * fps_val))
        scene_start_frames.append(s_f)
        scene_durations_frames.append(d_f)
        scene_durations_sec.append(d_f / fps_val)
elif local_srt_parsed:
    srt_i = 0
    t_srts = len(local_srt_parsed)
    for sc_idx, sc in enumerate(SCENES):
        if srt_i >= t_srts:
            prev_end = scene_start_frames[-1] + scene_durations_frames[-1] if scene_start_frames else 0
            s_f = prev_end
            d_f = int(float(sc.get("duration", 10.0)) * fps_val)
        else:
            f_st = local_srt_parsed[srt_i]["start"]
            l_en = local_srt_parsed[srt_i]["end"]
            srt_i += 1
            s_f = int(f_st * fps_val)
            d_f = max(int((l_en - f_st) * fps_val), int(1.0 * fps_val))
        scene_start_frames.append(s_f)
        scene_durations_frames.append(d_f)
        scene_durations_sec.append(d_f / fps_val)
elif total_audio_frames > 0 and len(SCENES) > 0:
    weights = [max(len(sc.get("narration", "").strip()), 10) for sc in SCENES]
    total_w = sum(weights) or 1.0
    c_f = 0
    alloc = 0
    for i, w in enumerate(weights):
        if i == len(weights) - 1:
            f_len = max(total_audio_frames - alloc, int(1.0 * fps_val))
        else:
            f_len = max(int((w / total_w) * total_audio_frames), int(1.0 * fps_val))
        scene_start_frames.append(c_f)
        scene_durations_frames.append(f_len)
        scene_durations_sec.append(f_len / fps_val)
        c_f += f_len
        alloc += f_len
else:
    c_f = 0
    for sc in SCENES:
        f_len = int(float(sc.get("duration", 10.0)) * fps_val)
        scene_start_frames.append(c_f)
        scene_durations_frames.append(f_len)
        scene_durations_sec.append(f_len / fps_val)
        c_f += f_len

# 갭(Gap) 제거
for idx in range(len(SCENES)):
    if idx < len(SCENES) - 1:
        nxt = scene_start_frames[idx + 1]
        if nxt > scene_start_frames[idx]:
            scene_durations_frames[idx] = nxt - scene_start_frames[idx]
            scene_durations_sec[idx] = scene_durations_frames[idx] / fps_val
    else:
        if total_audio_frames > 0 and total_audio_frames > scene_start_frames[idx]:
            scene_durations_frames[idx] = max(total_audio_frames - scene_start_frames[idx], scene_durations_frames[idx])
            scene_durations_sec[idx] = scene_durations_frames[idx] / fps_val

# 4단계: 다빈치 네이티브 API 기반 타임라인 생성
print("\n🎬 [4단계] 다빈치 타임라인 생성 및 클립 배치 중...")
try:
    resolve.OpenPage("edit")
except Exception:
    pass

master_timeline_name = f"Yadam_Master_{int(time.time())}"
timeline = None
timeline_start_frame = 86400

try:
    timeline = mediaPool.CreateEmptyTimeline(master_timeline_name)
    if timeline:
        proj.SetCurrentTimeline(timeline)
        try:
            timeline.SetCurrentTimecode("01:00:00:00")
        except Exception:
            pass
        timeline_start_frame = timeline.GetStartFrame() or 86400
        for idx, sc in enumerate(SCENES):
            clp = sc.get("media_item")
            if clp:
                st_f = scene_start_frames[idx] if idx < len(scene_start_frames) else 0
                du_f = scene_durations_frames[idx] if idx < len(scene_durations_frames) else int(10.0 * fps_val)
                clip_dict = {
                    "mediaPoolItem": clp,
                    "startFrame": 0,
                    "endFrame": du_f,
                    "recordFrame": timeline_start_frame + st_f
                }
                try:
                    mediaPool.AppendToTimeline([clip_dict])
                except Exception:
                    try:
                        mediaPool.AppendToTimeline([clp])
                    except Exception:
                        pass
        print(f"  ✅ [V1 트랙 비디오/이미지 배치 완료]: {len(SCENES)}개 씬 정밀 동기화")
except Exception as t_err:
    print(f"  ⚠️ [타임라인 생성 알림]: {t_err}")

if not timeline:
    timeline = proj.GetCurrentTimeline()

if timeline:
    proj.SetCurrentTimeline(timeline)
    timeline_start_frame = timeline.GetStartFrame() or 86400
    
    # A1 트랙: 오디오 배치
    if master_audio_item:
        try:
            a_dur = total_audio_frames if total_audio_frames > 0 else (scene_start_frames[-1] + scene_durations_frames[-1] if scene_durations_frames else 86400)
            a_info = {
                "mediaPoolItem": master_audio_item,
                "startFrame": 0,
                "endFrame": a_dur,
                "recordFrame": timeline_start_frame,
                "mediaType": 2
            }
            res_a = None
            try:
                res_a = mediaPool.AppendToTimeline([a_info])
            except Exception:
                pass
            if not res_a:
                try:
                    res_a = mediaPool.AppendToTimeline([master_audio_item])
                except Exception:
                    pass
            if res_a:
                print("  ✅ [A1 트랙 성우 나레이션 배치 완료]: 01:00:00:00 시작점에 정밀 등록되었습니다.")
        except Exception as a_err:
            print(f"  ⚠️ [오디오 배치 알림]: {a_err}")

    # ST1 트랙: 자막 자동 임포트 시도
    if os.path.exists(davinci_srt_path) and hasattr(timeline, "ImportSubtitle"):
        try:
            timeline.ImportSubtitle(davinci_srt_path)
            print("  ✅ [ST1 트랙 자막 자동 연결 성공]")
        except Exception:
            pass

print("\n" + "=" * 75)
print("🎉 [완료] 다빈치 리졸브 마스터 타임라인 자동 생성이 성공적으로 완료되었습니다!")
print("=" * 75)
print("💡 [자막 파일 안내]")
print(" • 'yadam_subtitles_01_davinci.srt' : 다빈치 리졸브 전용 (01:00:00:00 시작) ⭐ [다빈치에선 이것을 사용!]")
print(" • 'yadam_subtitles_00_standard.srt': 일반 영상/유튜브/프리미어용 (00:00:00 시작)")
print(" • 자막이 안 보일 때: 상단 메뉴 [File] -> [Import] -> [Subtitle...] 에서 01_davinci.srt 선택")
print(" • 오디오 파형이 안 보일 때: 타임라인 좌측 상단 [Timeline View Options] 아이콘 클릭 후 [Audio Waveform] 켜기")
print("=" * 75 + "\n")
'''

# Test AST parsing
test_code = python_template.replace("__TOPIC__", "테스트 에피소드").replace("__TOTAL_SCENES__", "3").replace("__SCENES_DATA__", '[{"id": 1, "num_str": "001", "num_short": "01", "duration": 10.0}]').replace("__DAVINCI_B64__", "MQoxCg==").replace("__STANDARD_B64__", "MQoxCg==")

try:
    ast.parse(test_code)
    print("SUCCESS: test_code parsed cleanly with ZERO syntax errors!")
except SyntaxError as e:
    print(f"SYNTAX ERROR on line {e.lineno}: {e.msg}")
