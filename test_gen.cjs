const fs = require('fs');

// Read App.tsx
const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const startIdx = appCode.indexOf('const handleExportDavinciPythonScript = () => {');
const endIdx = appCode.indexOf('setDavinciScriptData({', startIdx);

// Extract the function body from startIdx
const funcCode = appCode.substring(startIdx, appCode.indexOf('// Set modal data & auto-download script file', startIdx));

// Let's create a simulated environment with mock data to run it
const scenes = [
  { id: 1, narrationText: "이순신 장군이 바다를 바라보며 결의를 다진다.", durationSeconds: 10 },
  { id: 2, narrationText: "조선 수군은 왜적의 대함대를 마주하게 되었다.", durationSeconds: 12 },
  { id: 3, narrationText: "학익진을 펼쳐라! 깃발이 오르자 판옥선들이 진형을 갖추었다.", durationSeconds: 15 }
];
const sceneLtxMotions = { 1: "dolly_in", 2: "pan_right", 3: "zoom_in" };
const analysis = { topic: "이순신 장군의 한산도 대첩" };
let feedbackMsg = "";
const showFeedback = (msg) => { feedbackMsg = msg; };

// Let's extract the code lines between start and end
eval(`
function generateScript(scenes, sceneLtxMotions, analysis) {
  const now = new Date();
  const timeStampStr = now.toISOString();
  const displayTimeStr = now.toLocaleString("ko-KR");
  const safeTopic = (analysis?.topic || "야담 마스터 에피소드").replace(/["\\n\\r]/g, " ").trim();
  const totalScenes = scenes.length;

  let srtContentStandard = "";
  let srtContentDavinci = "";
  let currentTime = 0;
  let globalSubIdx = 1;

  const formatSrtTime = (sec) => {
    const hrs = Math.floor(sec / 3600).toString().padStart(2, "0");
    const mins = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const secs = Math.floor(sec % 60).toString().padStart(2, "0");
    const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, "0");
    return \`\${hrs}:\${mins}:\${secs},\${ms}\`;
  };

  const sanitizePureSpeech = (text) => {
    if (!text) return "";
    let cleaned = text;
    if (cleaned.includes("이곳에 들어올") || cleaned.includes("작성해 주세요")) return "";
    cleaned = cleaned.replace(/\\[?\\s*TYPE\\s*:\\s*(VIDEO|IMAGE)\\s*\\]?/gi, "");
    cleaned = cleaned.replace(/^\\[?\\s*(S|Scene|씬)\\s*#?\\d+\\.?\\s*\\]?:?\\s*/i, "");
    cleaned = cleaned.replace(/\\[[^\\]]*\\]/g, "");
    cleaned = cleaned.replace(/\\([^\\)]*\\)/g, "");
    cleaned = cleaned.replace(/\\{[^\\}]*\\}/g, "");
    cleaned = cleaned.replace(/\\[?IMAGE GENERATION PROMPT\\]?:?.*$/gmi, "");
    return cleaned.replace(/\\s+/g, " ").trim();
  };

  const sceneNarrations = scenes.map((sc) => sanitizePureSpeech(sc.narrationText || ""));
  const totalNarrChars = sceneNarrations.reduce((acc, n) => acc + Math.max(n.length, 10), 0) || 1;
  const totalEstimatedSec = totalNarrChars / 13.5;

  scenes.forEach((sc, idx) => {
    const pureNarration = sceneNarrations[idx];
    let startTimeSec = currentTime;
    let dur = sc.durationSeconds || 10;
    const endTimeSec = startTimeSec + dur;
    currentTime = endTimeSec;

    if (pureNarration) {
      srtContentStandard += \`\${globalSubIdx}\\n\`;
      srtContentStandard += \`\${formatSrtTime(startTimeSec)} --> \${formatSrtTime(endTimeSec)}\\n\`;
      srtContentStandard += \`\${pureNarration}\\n\\n\`;

      srtContentDavinci += \`\${globalSubIdx}\\n\`;
      srtContentDavinci += \`\${formatSrtTime(startTimeSec + 3600.0)} --> \${formatSrtTime(endTimeSec + 3600.0)}\\n\`;
      srtContentDavinci += \`\${pureNarration}\\n\\n\`;
      globalSubIdx++;
    }
  });

  ` + funcCode.substring(funcCode.indexOf('let pyScript =')) + `
  return { pyScript, srtContentStandard, srtContentDavinci };
}
global.generateScript = generateScript;
`);

const res = global.generateScript(scenes, sceneLtxMotions, analysis);
fs.writeFileSync('generated_davinci.py', res.pyScript, 'utf8');
console.log('Saved generated_davinci.py! Length:', res.pyScript.length);
