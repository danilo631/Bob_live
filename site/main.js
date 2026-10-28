(() => {
  "use strict";
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
      const online = !!s.tiktok?.listening;
      setInfo("IA: " + (s.ia?.model || "sem modelo") + " · TikTok: " + (online ? "conectado" : "aguardando live") + " · Jogo: " + (s.godot ? "conectado" : "sem janela"));
      simulate.disabled = false;
      gift.disabled = false;
    } catch (e) {
      setInfo("Sessão indisponível (" + e.message + "). Confirme o Action, o túnel e a senha.");
      simulate.disabled = true;
      gift.disabled = true;
    }
  }
  $("#sessionForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    try {
      const u = new URL($("#tunnel").value.trim());
      if (u.protocol !== "https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(u.hostname) || u.port || u.pathname !== "/" || u.search || u.hash) {
        throw new Error("Use a URL completa HTTPS fornecida pelo Action (domínio trycloudflare.com).");
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
