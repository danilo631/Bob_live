(() => {
  "use strict";

  // Voz brasileira local do navegador: Render recebe apenas texto, sem rodar TTS/IA na RAM.
  const doneJobs = [];
  let currentUtterance = null;
  window.bobLivePopFinished = () => doneJobs.shift() || "";
  window.bobLiveSpeak = (job) => {
    const id = String(job?.job_id || "").slice(0, 100);
    const text = String(job?.text || "").slice(0, 400);
    if (!id || !text || !window.speechSynthesis) {
      doneJobs.push(id);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.08;
    utterance.pitch = 1.25;
    utterance.volume = 1;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase().replace("_", "-") === "pt-br") || null;
    utterance.onend = () => { currentUtterance = null; doneJobs.push(id); };
    utterance.onerror = () => { currentUtterance = null; doneJobs.push(id); };
    try {
      speechSynthesis.cancel();
      currentUtterance = utterance;
      speechSynthesis.speak(utterance);
    } catch {
      currentUtterance = null;
      doneJobs.push(id);
    }
  };
  const $ = sel => document.querySelector(sel);
  const game = $("#game");
  const video = $("#video");
  const state = $("#state");
  const full = $("#full");
  const reload = $("#reload");
  const info = $("#serverStatus");
  const simulate = $("#simulate");
  const gift = $("#gift");
  let base = "";
  let secret = "";
  let poll = null;
  const setInfo = text => { info.textContent = text; };
  const startGame = () => {
    video.classList.add("running");
    game.src = "game/index.html";
    full.disabled = false;
    reload.disabled = false;
    state.textContent = "Carregando Godot…";
  };
  $("#start").addEventListener("click", startGame);
  const audio = $("#audio");
  if (audio) audio.addEventListener("click", () => {
    if (!("speechSynthesis" in window)) { setInfo("Este navegador não suporta voz Web Speech."); return; }
    const u = new SpeechSynthesisUtterance("Voz do Bob ativada!");
    u.lang = "pt-BR";
    u.rate = 1.05;
    u.pitch = 1.25;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setInfo("Voz brasileira do navegador habilitada. Deixe a aba aberta para os comentários.");
  });
  game.addEventListener("load", () => {
    state.textContent = "Jogo aberto · clique nele para ativar áudio";
  });
  game.addEventListener("error", () => {
    state.textContent = "Não foi possível carregar o export Web";
  });
  full.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else video.requestFullscreen?.();
  });
  reload.addEventListener("click", () => {
    state.textContent = "Reiniciando Godot…";
    game.src = "game/index.html?v=" + Date.now();
  });

  async function api(path, opts = {}) {
    const signal = AbortSignal.timeout(12000);
    const res = await fetch(base + path, {
      ...opts, signal,
      headers: { "Authorization": "Bearer " + secret, "Content-Type": "application/json", ...(opts.headers || {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }
  async function refreshStatus() {
    if (!base) return;
    try {
      const s = await api("/api/status");
      const brain = await api("/api/brain/status").catch(() => null);
      const online = !!s.tiktok?.listening;
      const model = brain?.ollama ? "Ollama Qwen 0.5B (Actions)" :
        brain?.stats ? "rede neural local (" + brain.stats.trainingExamples + " perguntas)" :
        (s.ia?.model || "desconhecido");
      setInfo("IA: " + model + (brain?.vercelOffload ? " + Vercel" : "") +
        " · TikTok: " + (online ? "conectado" : "aguardando live") +
        " · Jogo: " + (s.godot ? "conectado" : "sem janela"));
      simulate.disabled = false;
      gift.disabled = false;
    } catch (e) {
      setInfo("Sessão indisponível (" + e.message + "). Confirme o Action, o túnel e a senha.");
      simulate.disabled = true;
      gift.disabled = true;
    }
  }
  // Em VPS, o servidor e o site compartilham a mesma origem.
  if (location.protocol === "https:" && location.hostname !== "danilo631.github.io") {
    $("#tunnel").value = location.origin + "/";
  }
  if (location.hostname === "bob-live-web-nexttec.onrender.com" ||
      location.hostname === "bob-live-nexttec.vercel.app") {
    $("#tunnel").value = "https://bob-live-api-nexttec.onrender.com/";
  }
  $("#sessionForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    try {
      const u = new URL($("#tunnel").value.trim());
      const isQuickTunnel = /^[a-z0-9-]+\.trycloudflare\.com$/i.test(u.hostname);
      const isOwnServer = u.origin === window.location.origin;
      const isRenderBackend = u.origin === "https://bob-live-api-nexttec.onrender.com";
      if (u.protocol !== "https:" || (!isQuickTunnel && !isOwnServer && !isRenderBackend) ||
          u.port || u.pathname !== "/" || u.search || u.hash) {
        throw new Error("Use o servidor Render oficial, o endereço desta página ou o túnel HTTPS do Action.");
      }
      const key = $("#sessionKey").value;
      if (key.length < 20 || key.length > 256) throw new Error("A senha deve ter de 20 a 256 caracteres.");
      base = u.origin;
      secret = key;
      setInfo("Verificando conexão...");
      await api("/api/status");
      const ws = u.origin.replace(/^https:\/\//, "wss://") + "/ws/godot?token=" + encodeURIComponent(key);
      // A iframe Godot e a pagina estao no mesmo dominio/origem; o segredo fica apenas nesta aba.
      sessionStorage.setItem("bob_live_ws", ws);
      if (poll) clearInterval(poll);
      poll = setInterval(refreshStatus, 5000);
      await refreshStatus();
      if (video.classList.contains("running")) {
        game.src = "game/index.html?v=" + Date.now();
      } else {
        startGame();
      }
    } catch (e) {
      setInfo("Falha: " + e.message);
      simulate.disabled = true;
      gift.disabled = true;
      sessionStorage.removeItem("bob_live_ws");
    }
  });
  simulate.addEventListener("click", async () => {
    try {
      await api("/api/simulate/chat", { method: "POST", body: JSON.stringify({ user: "TesteWeb", comment: "Oi Bob! Conta uma piada curtinha?" }) });
      setInfo("Comentário de teste enviado. Aguarde a IA e a voz responderem.");
    } catch (e) { setInfo("Teste falhou: " + e.message); }
  });
  gift.addEventListener("click", async () => {
    try {
      await api("/api/simulate/gift", { method: "POST", body: JSON.stringify({ user: "TesteWeb", gift: "Rose" }) });
      setInfo("Rosa de teste enviada. Aguarde a reação.");
    } catch (e) { setInfo("Teste falhou: " + e.message); }
  });
  window.addEventListener("pagehide", () => {
    sessionStorage.removeItem("bob_live_ws");
    if (poll) clearInterval(poll);
  });
})();
