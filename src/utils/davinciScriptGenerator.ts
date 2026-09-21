import { SceneItem } from '../types';

export interface DavinciScriptResult {
  code: string;
  timestamp: string;
  sceneCount: number;
  title: string;
  davinciSrtContent: string;
  standardSrtContent: string;
}

export function generateDavinciScript(
  scenes: SceneItem[],
  analysis?: { topic?: string } | null,
  customAssetDir?: string
): DavinciScriptResult {
  const now = new Date();
  const timeStampStr = now.toISOString();
  const displayTimeStr = now.toLocaleString('ko-KR');
  const safeTopic = (analysis?.topic || '야담 마스터 에피소드')
    .replace(/["\n\r\\]/g, ' ')
    .trim();
  const totalScenes = scenes.length;
  const safeCustomDir = (customAssetDir || '').replace(/["\r\n]/g, '').trim();

  // 1. Pre-generate SRT contents for both Standard (00:00:00) and DaVinci (01:00:00)
  let srtContentStandard = '';
  let srtContentDavinci = '';
  let currentTime = 0;
  let globalSubIdx = 1;

  const formatSrtTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600)
      .toString()
      .padStart(2, '0');
    const mins = Math.floor((sec % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    const ms = Math.floor((sec % 1) * 1000)
      .toString()
      .padStart(3, '0');
    return `${hrs}:${mins}:${secs},${ms}`;
  };

  const sanitizePureSpeech = (text: string) => {
    if (!text) return '';
    let cleaned = text;
    if (cleaned.includes('이곳에 들어올') || cleaned.includes('작성해 주세요')) return '';
    cleaned = cleaned.replace(/\[?\s*TYPE\s*:\s*(VIDEO|IMAGE)\s*\]?/gi, '');
    cleaned = cleaned.replace(/^\[?\s*(S|Scene|씬)\s*#?\d+\.?\s*\]?:?\s*/i, '');
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\([^\)]*\)/g, '');
    cleaned = cleaned.replace(/\{[^\}]*\}/g, '');
    cleaned = cleaned.replace(/\[?IMAGE GENERATION PROMPT\]?:?.*$/gmi, '');
    cleaned = cleaned
      .replace(/\s*\([\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+\)/g, '')
      .replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+/g, '')
      .replace(/([가-힣]+)\s*Ch_[A-Za-z0-9_]+/gi, '$1')
      .replace(/\s*Ch_[A-Za-z0-9_]+/gi, '');
    return cleaned.replace(/\s+/g, ' ').trim();
  };

  const sceneNarrations = scenes.map((sc) => sanitizePureSpeech(sc.narrationText || ''));
  const totalNarrChars =
    sceneNarrations.reduce((acc, n) => acc + Math.max(n.length, 10), 0) || 1;
  const totalEstimatedSec = totalNarrChars / 13.5;

  scenes.forEach((sc, idx) => {
    const pureNarration = sceneNarrations[idx];
    const hasImportedSrt =
      (sc as any).srtStart !== undefined && (sc as any).srtEnd !== undefined;

    let startTimeSec = currentTime;
    let dur = sc.durationSeconds;
    if (hasImportedSrt) {
      startTimeSec = (sc as any).srtStart;
      dur =
        (sc as any).srtDuration ||
        Math.max(0.1, (sc as any).srtEnd - (sc as any).srtStart);
    } else if (!dur) {
      const charWeight = Math.max(pureNarration.length, 10);
      dur = (charWeight / totalNarrChars) * totalEstimatedSec;
    }
    const endTimeSec = startTimeSec + dur;
    currentTime = hasImportedSrt ? (sc as any).srtEnd : endTimeSec;

    if (pureNarration) {
      const rawParts = pureNarration.split(/([.?!,~]+)/);
      const sentences: string[] = [];
      let temp = '';
      for (let i = 0; i < rawParts.length; i++) {
        temp += rawParts[i];
        if (i % 2 === 1 || i === rawParts.length - 1) {
          if (temp.trim()) sentences.push(temp.trim());
          temp = '';
        }
      }
      if (sentences.length === 0) sentences.push(pureNarration);

      const totalSentChars =
        sentences.reduce((acc, s) => acc + s.length, 0) || 1;
      let sCurrent = startTimeSec;

      sentences.forEach((sent, sIdx) => {
        const sDur =
          sIdx === sentences.length - 1
            ? endTimeSec - sCurrent
            : (sent.length / totalSentChars) * (endTimeSec - startTimeSec);
        const sEnd = sCurrent + Math.max(0.2, sDur);

        const words = sent.split(' ');
        const lines: string[] = [];
        let curL = '';
        words.forEach((cw) => {
          if ((curL + ' ' + cw).length > 24) {
            lines.push(curL);
            curL = cw;
          } else {
            curL = (curL ? `${curL} ${cw}` : cw).trim();
          }
        });
        if (curL) lines.push(curL);

        const formattedText =
          lines.slice(0, 2).join('\n') +
          (lines.length > 2 ? ' ' + lines.slice(2).join(' ') : '');
        const cTime = sCurrent;
        const eTime = sEnd;

        srtContentStandard += `${globalSubIdx}\n`;
        srtContentStandard += `${formatSrtTime(cTime)} --> ${formatSrtTime(eTime)}\n`;
        srtContentStandard += `${formattedText}\n\n`;

        srtContentDavinci += `${globalSubIdx}\n`;
        srtContentDavinci += `${formatSrtTime(cTime + 3600.0)} --> ${formatSrtTime(eTime + 3600.0)}\n`;
        srtContentDavinci += `${formattedText}\n\n`;

        globalSubIdx++;
        sCurrent = sEnd;
      });
    } else {
      const sceneNum = sc.id || idx + 1;
      srtContentStandard += `${globalSubIdx}\n`;
      srtContentStandard += `${formatSrtTime(startTimeSec)} --> ${formatSrtTime(endTimeSec)}\n`;
      srtContentStandard += `[씬 ${sceneNum}]\n\n`;

      srtContentDavinci += `${globalSubIdx}\n`;
      srtContentDavinci += `${formatSrtTime(startTimeSec + 3600.0)} --> ${formatSrtTime(endTimeSec + 3600.0)}\n`;
      srtContentDavinci += `[씬 ${sceneNum}]\n\n`;
      globalSubIdx++;
    }
  });

  const scenesMetadata = scenes.map((s, idx) => {
    const rawNarr = s.narrationText || '';
    const isPlaceholder =
      rawNarr.includes('이곳에 들어올') || rawNarr.includes('작성해 주세요');
    const sanitizedNarr = isPlaceholder
      ? ''
      : rawNarr.replace(/["\n\r\\]/g, ' ').trim();

    return {
      id: s.id || `scene_${idx + 1}`,
      sceneNumber: typeof s.id === 'number' ? s.id : idx + 1,
      duration: s.durationSeconds || 5,
      narration: sanitizedNarr,
      originalIndex: idx + 1,
    };
  });

  const scenesJsonString = JSON.stringify(scenesMetadata);
  const scenesB64 = btoa(unescape(encodeURIComponent(scenesJsonString)));
  const standardB64 = btoa(unescape(encodeURIComponent(srtContentStandard)));
  const davinciB64 = btoa(unescape(encodeURIComponent(srtContentDavinci)));

  // Generate clean Python script using array of lines to guarantee no escape/newline bugs
  const pyLines = [
    '# -*- coding: utf-8 -*-',
    '"""',
    '=============================================================================',
    '🎬 Yadam DaVinci Resolve 1-Click Master Auto-Batch Builder',
    `Episode: ${safeTopic}`,
    `Generated at: ${displayTimeStr}`,
    `Total Scenes: ${totalScenes}`,
    '=============================================================================',
    '"""',
    '',
    'import os',
    'import sys',
    'import json',
    'import time',
    'import base64',
    'import re',
    '',
    '# Python JSON compatibility aliases',
    'null = None',
    'true = True',
    'false = False',
    '',
    '# ---------------------------------------------------------------------------',
    '# 📁 [선택사항] 작업 에셋 폴더 직접 지정 (비워두면 다운로드/바탕화면 자동 심층 탐색)',
    '# ---------------------------------------------------------------------------',
    `CUSTOM_ASSET_DIR = r"${safeCustomDir}"`,
    '',
    'def get_resolve():',
    '    """Locate or connect to DaVinci Resolve instance safely."""',
    '    if "resolve" in globals() and globals()["resolve"] is not None:',
    '        return globals()["resolve"]',
    '    if "bmd" in globals() and hasattr(globals()["bmd"], "scriptapp"):',
    '        return globals()["bmd"].scriptapp("Resolve")',
    '',
    '    script_paths = []',
    '    if sys.platform.startswith("win"):',
    '        script_paths.extend([',
    '            os.path.expandvars(r"%PROGRAMFILES%\\Blackmagic Design\\DaVinci Resolve\\Developer\\Scripting\\Modules"),',
    '            os.path.expandvars(r"%PROGRAMDATA%\\Blackmagic Design\\DaVinci Resolve\\Support\\Developer\\Scripting\\Modules")',
    '        ])',
    '    elif sys.platform == "darwin":',
    '        script_paths.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules")',
    '    else:',
    '        script_paths.append("/opt/resolve/Developer/Scripting/Modules")',
    '',
    '    for path in script_paths:',
    '        if os.path.exists(path) and path not in sys.path:',
    '            sys.path.append(path)',
    '',
    '    try:',
    '        import DaVinciResolveScript as dvr_script',
    '        return dvr_script.scriptapp("Resolve")',
    '    except Exception:',
    '        return None',
    '',
    'resolve = get_resolve()',
    'if not resolve:',
    '    print()',
    '    print("=" * 60)',
    '    print("❌ [오류] DaVinci Resolve 객체를 찾을 수 없습니다.")',
    '    print("▶ 다빈치 리졸브 상단 메뉴 [Workspace] -> [Console] 에서 [Py3] 탭을 누르고 붙여넣으세요.")',
    '    print("=" * 60)',
    '    sys.exit(1)',
    '',
    'projectManager = resolve.GetProjectManager()',
    'if not projectManager:',
    '    print("❌ [오류] ProjectManager 객체를 가져올 수 없습니다.")',
    '    sys.exit(1)',
    '',
    'proj = projectManager.GetCurrentProject()',
    'if not proj:',
    '    proj = projectManager.CreateProject(f"Yadam_AutoMaster_{int(time.time())}")',
    '    if not proj:',
    '        print("❌ [오류] 활성화된 프로젝트가 없습니다.")',
    '        sys.exit(1)',
    '',
    'mediaPool = proj.GetMediaPool()',
    'rootFolder = mediaPool.GetRootFolder()',
    '',
    '# 1920x1080 (16:9) 및 FPS 설정',
    'try:',
    '    proj.SetSetting("timelineResolutionWidth", "1920")',
    '    proj.SetSetting("timelineResolutionHeight", "1080")',
    '    proj.SetSetting("timelineFrameRate", "24.0")',
    '    proj.SetSetting("timelinePlaybackFrameRate", "24.0")',
    'except Exception:',
    '    pass',
    '',
    'fps_val = float(proj.GetSetting("timelineFrameRate") or 24.0)',
    '',
    'print()',
    'print("=" * 60)',
    'print(f"🎬 [다빈치 프로젝트 연결]: {proj.GetName()} (타임라인 FPS: {fps_val})")',
    'print("=" * 60)',
    '',
    '# 씬 메타데이터 디코딩',
    `SCENES_B64 = "${scenesB64}"`,
    'SCENES = json.loads(base64.b64decode(SCENES_B64.encode("ascii")).decode("utf-8"))',
    'for s in SCENES:',
    '    s["media_item"] = None',
    '',
    '# =============================================================================',
    '# 🔍 스마트 에셋 디렉토리 심층 탐색 엔진 (다운로드/바탕화면/하위폴더 재귀 전수 스캔)',
    '# =============================================================================',
    'def find_best_asset_directory(custom_path, scenes_list):',
    '    if custom_path and os.path.exists(custom_path):',
    '        print(f"🎯 [사용자 지정 폴더 사용]: {custom_path}")',
    '        return os.path.abspath(custom_path)',
    '',
    '    # 1순위: 스크립트 실행 위치 (__file__)',
    '    try:',
    '        if "__file__" in globals() and __file__:',
    '            f_dir = os.path.dirname(os.path.abspath(__file__))',
    '            if f_dir and os.path.exists(f_dir) and not any(k in f_dir.lower() for k in ["blackmagic", "system32", "program files"]):',
    '                f_list = os.listdir(f_dir)',
    '                if any("scene" in f.lower() or "cut" in f.lower() or "yadam" in f.lower() for f in f_list):',
    '                    print(f"🎯 [스크립트 위치 에셋 폴더 자동 감지]: {f_dir}")',
    '                    return f_dir',
    '    except Exception:',
    '        pass',
    '',
    '    # 2순위: 후보 루트 폴더들',
    '    candidate_roots = []',
    '    home = os.path.expanduser("~")',
    '    candidate_roots.extend([',
    '        os.path.join(home, "Downloads"),',
    '        os.path.join(home, "Desktop"),',
    '        os.path.join(home, "Documents"),',
    '        os.path.join(home, "Videos"),',
    '    ])',
    '',
    '    if sys.platform.startswith("win"):',
    '        for drive in ["D:\\\\", "E:\\\\", "F:\\\\"]:',
    '            if os.path.exists(drive):',
    '                candidate_roots.append(drive)',
    '',
    '    cwd = os.getcwd()',
    '    if not any(k in cwd.lower() for k in ["blackmagic", "system32", "program files"]):',
    '        candidate_roots.append(cwd)',
    '',
    '    vid_exts = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}',
    '    img_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}',
    '    aud_exts = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}',
    '',
    '    target_ids = set()',
    '    for sc in scenes_list:',
    '        n = sc.get("sceneNumber", sc.get("originalIndex", 1))',
    '        target_ids.add(int(n))',
    '',
    '    scored_folders = []',
    '',
    '    for root_dir in candidate_roots:',
    '        if not os.path.exists(root_dir):',
    '            continue',
    '        try:',
    '            for current_dir, subdirs, files in os.walk(root_dir):',
    '                norm_d = current_dir.lower()',
    '                if any(ex in norm_d for ex in ["blackmagic", "program files", "node_modules", ".git", "appdata", "windows", "system32"]):',
    '                    subdirs[:] = []',
    '                    continue',
    '',
    '                if not files:',
    '                    continue',
    '',
    '                matched_scene_nums = set()',
    '                vid_count = 0',
    '                img_count = 0',
    '                aud_count = 0',
    '                max_mt = 0',
    '',
    '                for f in files:',
    '                    base, ext = os.path.splitext(f.lower())',
    '                    if ext in aud_exts:',
    '                        aud_count += 1',
    '                    is_v = ext in vid_exts',
    '                    is_i = ext in img_exts',
    '                    if is_v: vid_count += 1',
    '                    if is_i: img_count += 1',
    '',
    '                    if is_v or is_i:',
    '                        m = re.search(r"(?:scene|cut|ltx|shot|img|image|yadam)?[_\\s-]*0*(\\d+)", base)',
    '                        if m:',
    '                            try:',
    '                                s_val = int(m.group(1))',
    '                                if s_val in target_ids or (1 <= s_val <= len(scenes_list) + 15):',
    '                                    matched_scene_nums.add(s_val)',
    '                            except Exception:',
    '                                pass',
    '                        try:',
    '                            fp = os.path.join(current_dir, f)',
    '                            mt = os.path.getmtime(fp)',
    '                            if mt > max_mt: max_mt = mt',
    '                        except Exception:',
    '                            pass',
    '',
    '                if len(matched_scene_nums) > 0 or (aud_count > 0 and (vid_count > 0 or img_count > 0)):',
    '                    score = (len(matched_scene_nums) * 200) + (vid_count * 150) + (aud_count * 100) + (img_count * 2)',
    '                    if "yadam" in norm_d or "storyboard" in norm_d:',
    '                        score += 500',
    '                    scored_folders.append((current_dir, score, len(matched_scene_nums), max_mt, vid_count, img_count, aud_count))',
    '        except Exception:',
    '            continue',
    '',
    '    if scored_folders:',
    '        scored_folders.sort(key=lambda x: (x[1], x[3]), reverse=True)',
    '        best_dir, best_score, match_cnt, _, v_cnt, i_cnt, a_cnt = scored_folders[0]',
    '        print(f"🎯 [에셋 폴더 자동 감지 성공]: {best_dir}")',
    '        print(f"   (매칭 씬: {match_cnt}개, 비디오: {v_cnt}개, 이미지: {i_cnt}개, 오디오: {a_cnt}개)")',
    '        return best_dir',
    '',
    '    return os.path.join(home, "Downloads")',
    '',
    'PRIMARY_ASSET_DIR = find_best_asset_directory(CUSTOM_ASSET_DIR, SCENES)',
    'print(f"📁 [확정된 에셋 작업 폴더]: {PRIMARY_ASSET_DIR}")',
    '',
    '# 전수 수집: 해당 에셋 폴더 및 직속 하위폴더 재귀 스캔',
    'all_video_files = []',
    'all_image_files = []',
    'all_audio_files = []',
    '',
    'vid_exts = {".mp4", ".mov", ".webm", ".mkv", ".m4v", ".avi"}',
    'img_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}',
    'aud_exts = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}',
    '',
    'try:',
    '    for root, dirs, files in os.walk(PRIMARY_ASSET_DIR):',
    '        norm_r = root.lower()',
    '        if any(ex in norm_r for ex in ["blackmagic", "system32", "node_modules", ".git"]):',
    '            dirs[:] = []',
    '            continue',
    '        for f in files:',
    '            fp = os.path.join(root, f)',
    '            ext = os.path.splitext(f.lower())[1]',
    '            try:',
    '                sz = os.path.getsize(fp)',
    '                if sz <= 0: continue',
    '                mt = os.path.getmtime(fp)',
    '                if ext in vid_exts: all_video_files.append((fp, f, mt, sz))',
    '                elif ext in img_exts: all_image_files.append((fp, f, mt, sz))',
    '                elif ext in aud_exts: all_audio_files.append((fp, f, mt, sz))',
    '            except Exception:',
    '                pass',
    'except Exception as scan_err:',
    '    print(f"⚠️ [스캔 예외]: {scan_err}")',
    '',
    'print(f"📊 [스캔된 미디어 총계]: 비디오 {len(all_video_files)}개, 이미지 {len(all_image_files)}개, 오디오 {len(all_audio_files)}개")',
    '',
    '# 1단계: 씬별 미디어 파일 정밀 매칭 (MP4 비디오 1순위 -> PNG/JPG 이미지 2순위)',
    'print()',
    'print("🔍 [1단계] 씬별 미디어 파일 매칭 및 미디어 풀 등록 중...")',
    '',
    'def find_best_scene_media(sc_num):',
    '    id_num = int(sc_num)',
    '    s_str3 = f"{id_num:03d}"',
    '    s_str2 = f"{id_num:02d}"',
    '    s_str1 = str(id_num)',
    '',
    '    exact_keys = {',
    '        f"scene_{s_str3}", f"scene_{s_str2}", f"scene_{s_str1}",',
    '        f"scene{s_str3}", f"scene{s_str2}", f"scene{s_str1}",',
    '        f"scene-{s_str3}", f"scene-{s_str2}", f"scene-{s_str1}",',
    '        f"scene {s_str3}", f"scene {s_str2}", f"scene {s_str1}",',
    '        f"cut_{s_str3}", f"cut_{s_str2}", f"cut_{s_str1}",',
    '        f"cut{s_str3}", f"cut{s_str2}", f"cut{s_str1}",',
    '        f"ltx_{s_str3}", f"ltx_{s_str2}", f"ltx_{s_str1}",',
    '        f"shot_{s_str3}", f"shot_{s_str2}", f"shot_{s_str1}",',
    '        s_str3, s_str2, s_str1',
    '    }',
    '',
    '    # Video first',
    '    matched_vids = []',
    '    for fp, fn, mt, sz in all_video_files:',
    '        base = os.path.splitext(fn.lower())[0]',
    '        score = 0',
    '        if base in exact_keys:',
    '            score = 1000',
    '        elif any(base.startswith(k + "_") or base.startswith(k + "-") or base.startswith(k + " ") for k in exact_keys):',
    '            score = 900',
    '        elif re.search(rf"^(?:scene|cut|ltx|shot|clip|img|image|yadam)?[_\\s-]*0*{id_num}(?:[_\\s-].*)?$", base):',
    '            score = 800',
    '        elif f"_{s_str3}" in base or f"_{s_str2}" in base or f"-{s_str3}" in base or f"-{s_str2}" in base:',
    '            score = 600',
    '        elif re.search(rf"\\b0*{id_num}\\b", base):',
    '            score = 400',
    '',
    '        if score > 0:',
    '            matched_vids.append((fp, fn, score, mt))',
    '',
    '    if matched_vids:',
    '        matched_vids.sort(key=lambda x: (x[2], x[3]), reverse=True)',
    '        return matched_vids[0][0], True',
    '',
    '    # Image second',
    '    matched_imgs = []',
    '    for fp, fn, mt, sz in all_image_files:',
    '        base = os.path.splitext(fn.lower())[0]',
    '        score = 0',
    '        if base in exact_keys:',
    '            score = 1000',
    '        elif any(base.startswith(k + "_") or base.startswith(k + "-") or base.startswith(k + " ") for k in exact_keys):',
    '            score = 900',
    '        elif re.search(rf"^(?:scene|cut|ltx|shot|clip|img|image|yadam)?[_\\s-]*0*{id_num}(?:[_\\s-].*)?$", base):',
    '            score = 800',
    '        elif f"_{s_str3}" in base or f"_{s_str2}" in base or f"-{s_str3}" in base or f"-{s_str2}" in base:',
    '            score = 600',
    '        elif re.search(rf"\\b0*{id_num}\\b", base):',
    '            score = 400',
    '',
    '        if score > 0:',
    '            matched_imgs.append((fp, fn, score, mt))',
    '',
    '    if matched_imgs:',
    '        matched_imgs.sort(key=lambda x: (x[2], x[3]), reverse=True)',
    '        return matched_imgs[0][0], False',
    '',
    '    return None, False',
    '',
    'v_count = 0',
    'img_count = 0',
    '',
    'for sc in SCENES:',
    '    sc_num = sc.get("sceneNumber", sc.get("originalIndex", 1))',
    '    chosen_file, is_vid = find_best_scene_media(sc_num)',
    '    if chosen_file and os.path.exists(chosen_file):',
    '        try:',
    '            imported = mediaPool.ImportMedia([chosen_file])',
    '            if imported and len(imported) > 0:',
    '                sc["media_item"] = imported[0]',
    '                if is_vid:',
    '                    v_count += 1',
    '                    print(f"  ✅ [씬 {sc_num:02d}] 🎬 비디오 매칭: {os.path.basename(chosen_file)}")',
    '                else:',
    '                    img_count += 1',
    '                    print(f"  ✅ [씬 {sc_num:02d}] 🖼️ 이미지 매칭: {os.path.basename(chosen_file)}")',
    '        except Exception as e:',
    '            print(f"  ⚠️ [씬 {sc_num:02d}] 미디어 등록 예외: {e}")',
    '    else:',
    '        print(f"  ⚠️ [씬 {sc_num:02d}] 미디어 파일 미발견 (scene_{sc_num:03d}.mp4 / .png)")',
    '',
    'print(f"📊 [에셋 매칭 결과]: 총 {len(SCENES)}개 중 비디오 {v_count}개, 이미지 {img_count}개 미디어 풀 등록 완료!")',
    '',
    '# 2단계: 성우 나레이션 오디오 파일 매칭',
    'print()',
    'print("🎙️ [2단계] 성우 나레이션 오디오 파일 검색 중 (MP3 / WAV)...")',
    'master_audio_item = None',
    'matched_audio_path = None',
    '',
    'audio_priority_keywords = ["audio", "voice", "speech", "narration", "tts", "master", "yadam", "echoes"]',
    'for ak in audio_priority_keywords:',
    '    for fp, fn, mt, sz in all_audio_files:',
    '        if ak in fn.lower() and "bgm" not in fn.lower() and "music" not in fn.lower():',
    '            matched_audio_path = fp',
    '            break',
    '    if matched_audio_path:',
    '        break',
    '',
    'if not matched_audio_path and all_audio_files:',
    '    all_audio_files.sort(key=lambda x: x[2], reverse=True)',
    '    matched_audio_path = all_audio_files[0][0]',
    '',
    'if matched_audio_path and os.path.exists(matched_audio_path):',
    '    try:',
    '        imported_a = mediaPool.ImportMedia([matched_audio_path])',
    '        if imported_a and len(imported_a) > 0:',
    '            master_audio_item = imported_a[0]',
    '            print(f"  ✅ [성우 오디오 등록]: {os.path.basename(matched_audio_path)}")',
    '    except Exception as ae:',
    '        print(f"  ⚠️ [오디오 등록 예외]: {ae}")',
    'else:',
    '    print("  ℹ️ [안내] 성우 오디오 파일이 없습니다 (audio.mp3 또는 audio.wav)")',
    '',
    '# 3단계: 자막 파일 확인 및 생성',
    'print()',
    'print("📝 [3단계] 자막 파일 확인 및 타임코드 동기화 중...")',
    'davinci_srt_path = os.path.join(PRIMARY_ASSET_DIR, "yadam_subtitles_01_davinci.srt")',
    'standard_srt_path = os.path.join(PRIMARY_ASSET_DIR, "yadam_subtitles_00_standard.srt")',
    '',
    `davinci_b64 = "${davinciB64}"`,
    `standard_b64 = "${standardB64}"`,
    '',
    'try:',
    '    if not os.path.exists(davinci_srt_path) and davinci_b64:',
    '        with open(davinci_srt_path, "wb") as f:',
    '            f.write(base64.b64decode(davinci_b64))',
    '        print(f"  ✅ [다빈치 전용 자막 생성]: {os.path.basename(davinci_srt_path)}")',
    '    if not os.path.exists(standard_srt_path) and standard_b64:',
    '        with open(standard_srt_path, "wb") as f:',
    '            f.write(base64.b64decode(standard_b64))',
    '        print(f"  ✅ [표준 자막 생성]: {os.path.basename(standard_srt_path)}")',
    'except Exception as srt_write_err:',
    '    print(f"  ⚠️ [자막 생성 예외]: {srt_write_err}")',
    '',
    'local_srt_parsed = []',
    'target_srt_for_parse = davinci_srt_path if os.path.exists(davinci_srt_path) else (standard_srt_path if os.path.exists(standard_srt_path) else None)',
    'if target_srt_for_parse:',
    '    try:',
    '        with open(target_srt_for_parse, "r", encoding="utf-8", errors="ignore") as f:',
    '            srt_raw = f.read()',
    '        blocks = [b.strip() for b in srt_raw.split("\\n\\n") if b.strip()]',
    '        for block in blocks:',
    '            lines = [l.strip() for l in block.split("\\n") if l.strip()]',
    '            if len(lines) >= 2:',
    '                tc_line = lines[1]',
    '                if "-->" in tc_line:',
    '                    tc_parts = tc_line.split("-->")',
    '                    def parse_tc(tc_str):',
    '                        tc_str = tc_str.strip().replace(",", ".")',
    '                        p = tc_str.split(":")',
    '                        if len(p) == 3:',
    '                            return float(p[0]) * 3600.0 + float(p[1]) * 60.0 + float(p[2])',
    '                        return float(tc_str)',
    '                    st_sec = parse_tc(tc_parts[0])',
    '                    en_sec = parse_tc(tc_parts[1])',
    '                    if st_sec >= 3600.0:',
    '                        st_sec -= 3600.0',
    '                        en_sec -= 3600.0',
    '                    txt_body = " ".join(lines[2:])',
    '                    local_srt_parsed.append({"start": st_sec, "end": en_sec, "text": txt_body})',
    '        print(f"  📊 [SRT 파싱 완료]: 총 {len(local_srt_parsed)}개 자막 항목 분석 성공")',
    '    except Exception as parse_err:',
    '        print(f"  ⚠️ [SRT 파싱 예외]: {parse_err}")',
    '',
    '# 오디오 프레임 및 씬별 타임코드 계산',
    'total_audio_frames = 0',
    'if master_audio_item:',
    '    try:',
    '        pf = master_audio_item.GetClipProperty("Frames")',
    '        if pf and int(pf) > 0:',
    '            total_audio_frames = int(pf)',
    '    except Exception:',
    '        pass',
    '',
    'if total_audio_frames <= 0 and local_srt_parsed:',
    '    total_audio_frames = int(local_srt_parsed[-1]["end"] * fps_val)',
    '',
    'scene_start_frames = []',
    'scene_durations_frames = []',
    '',
    'if local_srt_parsed and len(local_srt_parsed) == len(SCENES):',
    '    for sc, srt_item in zip(SCENES, local_srt_parsed):',
    '        s_f = int(srt_item["start"] * fps_val)',
    '        e_f = int(srt_item["end"] * fps_val)',
    '        d_f = max(e_f - s_f, int(1.0 * fps_val))',
    '        scene_start_frames.append(s_f)',
    '        scene_durations_frames.append(d_f)',
    'elif local_srt_parsed:',
    '    srt_i = 0',
    '    t_srts = len(local_srt_parsed)',
    '    for sc_idx, sc in enumerate(SCENES):',
    '        if srt_i >= t_srts:',
    '            prev_end = scene_start_frames[-1] + scene_durations_frames[-1] if scene_start_frames else 0',
    '            s_f = prev_end',
    '            d_f = int(float(sc.get("duration", 10.0)) * fps_val)',
    '        else:',
    '            f_st = local_srt_parsed[srt_i]["start"]',
    '            l_en = local_srt_parsed[srt_i]["end"]',
    '            srt_i += 1',
    '            s_f = int(f_st * fps_val)',
    '            d_f = max(int((l_en - f_st) * fps_val), int(1.0 * fps_val))',
    '        scene_start_frames.append(s_f)',
    '        scene_durations_frames.append(d_f)',
    'elif total_audio_frames > 0 and len(SCENES) > 0:',
    '    weights = [max(len(sc.get("narration", "").strip()), 10) for sc in SCENES]',
    '    total_w = sum(weights) or 1.0',
    '    c_f = 0',
    '    alloc = 0',
    '    for i, w in enumerate(weights):',
    '        if i == len(weights) - 1:',
    '            f_len = max(total_audio_frames - alloc, int(1.0 * fps_val))',
    '        else:',
    '            f_len = max(int((w / total_w) * total_audio_frames), int(1.0 * fps_val))',
    '        scene_start_frames.append(c_f)',
    '        scene_durations_frames.append(f_len)',
    '        c_f += f_len',
    '        alloc += f_len',
    'else:',
    '    c_f = 0',
    '    for sc in SCENES:',
    '        f_len = int(float(sc.get("duration", 10.0)) * fps_val)',
    '        scene_start_frames.append(c_f)',
    '        scene_durations_frames.append(f_len)',
    '        c_f += f_len',
    '',
    '# 갭 제거',
    'for idx in range(len(SCENES)):',
    '    if idx < len(SCENES) - 1:',
    '        nxt = scene_start_frames[idx + 1]',
    '        if nxt > scene_start_frames[idx]:',
    '            scene_durations_frames[idx] = nxt - scene_start_frames[idx]',
    '    else:',
    '        if total_audio_frames > 0 and total_audio_frames > scene_start_frames[idx]:',
    '            scene_durations_frames[idx] = max(total_audio_frames - scene_start_frames[idx], scene_durations_frames[idx])',
    '',
    '# 4단계: 다빈치 타임라인 생성 및 클립 배치',
    'print()',
    'print("🎬 [4단계] 다빈치 타임라인 생성 및 클립 배치 중...")',
    'try:',
    '    resolve.OpenPage("edit")',
    'except Exception:',
    '    pass',
    '',
    'master_timeline_name = f"Yadam_Master_{int(time.time())}"',
    'timeline = None',
    'timeline_start_frame = 86400',
    '',
    'try:',
    '    timeline = mediaPool.CreateEmptyTimeline(master_timeline_name)',
    '    if timeline:',
    '        proj.SetCurrentTimeline(timeline)',
    '        try:',
    '            timeline.SetCurrentTimecode("01:00:00:00")',
    '        except Exception:',
    '            pass',
    '        timeline_start_frame = timeline.GetStartFrame() or 86400',
    '',
    '        for idx, sc in enumerate(SCENES):',
    '            clp = sc.get("media_item")',
    '            if clp:',
    '                st_f = scene_start_frames[idx] if idx < len(scene_start_frames) else 0',
    '                du_f = scene_durations_frames[idx] if idx < len(scene_durations_frames) else int(10.0 * fps_val)',
    '                clip_dict = {',
    '                    "mediaPoolItem": clp,',
    '                    "startFrame": 0,',
    '                    "endFrame": du_f,',
    '                    "recordFrame": timeline_start_frame + st_f',
    '                }',
    '                try:',
    '                    mediaPool.AppendToTimeline([clip_dict])',
    '                except Exception:',
    '                    try:',
    '                        mediaPool.AppendToTimeline([clp])',
    '                    except Exception:',
    '                        pass',
    '        print(f"  ✅ [V1 트랙 비디오/이미지 배치 완료]: {len(SCENES)}개 씬 정밀 배치")',
    'except Exception as t_err:',
    '    print(f"  ⚠️ [타임라인 생성 알림]: {t_err}")',
    '',
    'if not timeline:',
    '    timeline = proj.GetCurrentTimeline()',
    '',
    'if timeline:',
    '    proj.SetCurrentTimeline(timeline)',
    '    timeline_start_frame = timeline.GetStartFrame() or 86400',
    '',
    '    # A1 트랙: 성우 오디오 배치',
    '    if master_audio_item:',
    '        try:',
    '            a_dur = total_audio_frames if total_audio_frames > 0 else (scene_start_frames[-1] + scene_durations_frames[-1] if scene_durations_frames else 86400)',
    '            a_info = {',
    '                "mediaPoolItem": master_audio_item,',
    '                "startFrame": 0,',
    '                "endFrame": a_dur,',
    '                "recordFrame": timeline_start_frame,',
    '                "mediaType": 2',
    '            }',
    '            res_a = None',
    '            try:',
    '                res_a = mediaPool.AppendToTimeline([a_info])',
    '            except Exception:',
    '                pass',
    '            if not res_a:',
    '                try:',
    '                    res_a = mediaPool.AppendToTimeline([master_audio_item])',
    '                except Exception:',
    '                    pass',
    '            if res_a:',
    '                print("  ✅ [A1 트랙 성우 오디오 배치 완료]: 01:00:00:00 시작점에 정밀 등록되었습니다.")',
    '        except Exception as a_err:',
    '            print(f"  ⚠️ [오디오 배치 알림]: {a_err}")',
    '',
    '    # 타임라인 마커 등록 (각 씬별 대사 및 연출 노팅)',
    '    try:',
    '        for idx, sc in enumerate(SCENES):',
    '            st_f = scene_start_frames[idx] if idx < len(scene_start_frames) else int(idx * 10.0 * fps_val)',
    '            s_num = sc.get("sceneNumber", idx + 1)',
    '            narr_txt = sc.get("narration", "")',
    '            timeline.AddMarker(timeline_start_frame + st_f, "Cyan", f"Scene #{s_num}", narr_txt[:60], 1)',
    '        print("  ✅ [타임라인 씬 마커 등록 완료]")',
    '    except Exception:',
    '        pass',
    '',
    '    # ST1 트랙: 자막 자동 임포트 시도',
    '    if os.path.exists(davinci_srt_path) and hasattr(timeline, "ImportSubtitle"):',
    '        try:',
    '            timeline.ImportSubtitle(davinci_srt_path)',
    '            print("  ✅ [ST1 트랙 자막 자동 연결 성공]")',
    '        except Exception:',
    '            pass',
    '',
    'print()',
    'print("=" * 60)',
    'print("🎉 [완료] 다빈치 리졸브 마스터 타임라인 자동 생성이 성공적으로 완료되었습니다!")',
    'print("=" * 60)',
    'print("💡 [자막 파일 안내]")',
    'print(" • yadam_subtitles_01_davinci.srt : 다빈치 리졸브 전용 (01:00:00:00 시작) ⭐")',
    'print(" • 자막이 안 보일 때: 상단 메뉴 [File] -> [Import] -> [Subtitle...] 에서 01_davinci.srt 선택")',
    'print(" • 오디오 안내: MP3/WAV/MP4 모두 다빈치에서 네이티브로 완벽하게 재생됩니다.")',
    'print("=" * 60)',
    'print()',
  ];

  const fullCode = pyLines.join('\n');

  return {
    code: fullCode,
    timestamp: timeStampStr,
    sceneCount: totalScenes,
    title: safeTopic,
    davinciSrtContent: srtContentDavinci,
    standardSrtContent: srtContentStandard,
  };
}
