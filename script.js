// ===== Utilities =====
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function addMessage(role, text){
  const list = $("#chatList");
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  wrap.innerHTML = `
    <div class="avatar ${role === "bot" ? "bot" : ""}">${role === "bot" ? "A" : "U"}</div>
    <div class="bubble">${escapeHtml(text)}</div>
  `;
  list.appendChild(wrap);
  list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
}

function escapeHtml(str){
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[m]);
}

// ===== Speech Synthesis =====
const synth = window.speechSynthesis;
let voices = [];

function populateVoices(){
  voices = synth.getVoices();
  const select = $("#voiceSelect");
  select.innerHTML = "";
  voices.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})${v.default ? " — default" : ""}`;
    select.appendChild(opt);
  });
  // Prefer an English voice if available
  const idx = voices.findIndex(v => /^en(-|_)/i.test(v.lang)) || 0;
  select.selectedIndex = idx >= 0 ? idx : 0;
}

if (synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = populateVoices;
}
document.addEventListener("DOMContentLoaded", populateVoices);

function speak(text){
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  const rate = parseFloat($("#rateRange").value);
  const pitch = parseFloat($("#pitchRange").value);
  const v = voices[$("#voiceSelect").selectedIndex];
  if (v) utter.voice = v;
  utter.rate = rate;
  utter.pitch = pitch;
  synth.cancel(); // stop previous speech
  synth.speak(utter);
}

// ===== Recognition (Web Speech API) =====
const hasWebkit = "webkitSpeechRecognition" in window;
let recog = null;
let listening = false;

function initRecognition(){
  if (!hasWebkit) return null;
  const r = new webkitSpeechRecognition();
  r.lang = "en-US";
  r.continuous = false;
  r.interimResults = true;

  r.onstart = () => setListening(true);
  r.onend   = () => setListening(false);
  r.onerror = (e) => {
    setListening(false);
    console.warn("Recognition error", e);
    if (e.error === "not-allowed") {
      updateStatus("Mic blocked — allow permissions");
    } else {
      updateStatus("Recognition error");
    }
  };

  r.onresult = (evt) => {
    let finalTranscript = "";
    for (let i=0; i<evt.results.length; i++){
      const res = evt.results[i];
      if (res.isFinal) finalTranscript += res[0].transcript;
    }
    if (finalTranscript.trim()){
      handleUserInput(finalTranscript.trim());
    }
  };
  return r;
}

function setListening(v){
  listening = v;
  document.body.classList.toggle("listening", v);
  $("#micBtn").setAttribute("aria-pressed", String(v));
  updateStatus(v ? "Listening…" : "Idle");
}

function updateStatus(text){
  $("#micStatus").textContent = text;
}

// ===== Intent Handling =====
function handleUserInput(text){
  addMessage("you", text);
  const lower = text.toLowerCase();

  if (/(what'?s|tell me) the time/.test(lower) || /\btime\b\??$/.test(lower)){
    const now = new Date();
    const reply = `It's ${now.toLocaleTimeString()}.`;
    respond(reply);
    return;
  }
  if (/date( today)?\b/.test(lower)){
    const now = new Date();
    const reply = `Today is ${now.toLocaleDateString(undefined, {weekday:'long', year:'numeric', month:'long', day:'numeric'})}.`;
    respond(reply);
    return;
  }
  if (/open (your )?github/.test(lower)){
    respond("Opening GitHub.");
    window.open("https://github.com/raiankit0125", "_blank", "noopener");
    return;
  }
  if (/clear chat/.test(lower)){
    $("#chatList").innerHTML = "";
    respond("Chat cleared.");
    return;
  }
  if (/your name/.test(lower)){
    respond("I'm your browser assistant.");
    return;
  }

  // default echo-style response
  const reply = smartReply(text);
  respond(reply);
}

function smartReply(text){
  // Simple smart-ish reply
  const templates = [
    `You said: “${text}”.`,
    `Got it — “${text}”.`,
    `Noted: “${text}”.`,
    `I heard: “${text}”.`,
  ];
  const t = templates[Math.floor(Math.random()*templates.length)];
  return `${t} Ask for the time, the date, or say “open github”.`;
}

function respond(text){
  addMessage("bot", text);
  speak(text);
}

// ===== Events =====
const micBtn = $("#micBtn");
const textForm = $("#textForm");
const textInput = $("#textInput");
const clearChatBtn = $("#clearChatBtn");
const copyLastBtn = $("#copyLastBtn");
const howToUse = $("#howToUse");
const howToUseBtn = $("#howToUseBtn");
const rateRange = $("#rateRange");
const pitchRange = $("#pitchRange");
const rateVal = $("#rateVal");
const pitchVal = $("#pitchVal");

micBtn.addEventListener("click", () => {
  if (!hasWebkit){
    updateStatus("Speech recognition not supported");
    addMessage("bot", "Speech recognition is not supported in this browser. Try Chrome/Edge.");
    return;
  }
  if (!recog) recog = initRecognition();
  if (!listening){
    try { recog.start(); }
    catch { /* already running */ }
  } else {
    recog.stop();
  }
});

textForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = textInput.value.trim();
  if (!val) return;
  handleUserInput(val);
  textInput.value = "";
  textInput.focus();
});

clearChatBtn.addEventListener("click", () => {
  $("#chatList").innerHTML = "";
});

copyLastBtn.addEventListener("click", async () => {
  const bubbles = $$(".msg.bot .bubble");
  if (!bubbles.length) return;
  const last = bubbles[bubbles.length - 1].textContent;
  try{
    await navigator.clipboard.writeText(last);
    updateStatus("Reply copied!");
    setTimeout(() => updateStatus(listening ? "Listening…" : "Idle"), 1200);
  } catch{
    updateStatus("Copy failed");
  }
});

howToUseBtn.addEventListener("click", (e) => {
  e.preventDefault();
  howToUse.showModal();
});

rateRange.addEventListener("input", () => rateVal.textContent = rateRange.value);
pitchRange.addEventListener("input", () => pitchVal.textContent = pitchRange.value);

// Initial message
addMessage("bot", "Hello! Click the mic and start speaking. Ask me for the time, date, or say: open GitHub.");
