(() => {
  "use strict";
  const $=selector=>document.querySelector(selector);
  const API_ORIGIN="https://bob-live-api-nexttec.onrender.com";
  const SITE_ORIGIN="https://bob-live-web-nexttec.onrender.com";
  const studio=new URLSearchParams(location.search).get("studio")==="1";
  const state=$("#state"),video=$("#video"),game=$("#game");
  const info=$("#serverStatus"),statusAI=$("#brainStatus"),statusTikTok=$("#tiktokStatus");
  let secret="",poll=null,liveUrl="";
  const finished=[];
  window.bobLivePopFinished=()=>finished.shift()||"";
  window.bobLiveSpeak=job=>{
    const id=String(job?.job_id||"").slice(0,100);
    const phrase=String(job?.text||"").slice(0,400);
    if(!id)return;
    if(!window.BobVoice){finished.push(id);return;}
    window.BobVoice.speak(phrase,()=>finished.push(id));
  };
  const message=text=>{if(info)info.textContent=String(text)};
  function startGame(){
    video.classList.add("running");
    game.src="./game/index.html?version=3";
    if($("#reload"))$("#reload").disabled=false;
    if($("#full"))$("#full").disabled=false;
    if(state)state.textContent="Carregando personagem 3D…";
  }
  game?.addEventListener("load",()=>{
    if(state)state.textContent="Palco iniciado · áudio da fonte precisa estar ativado";
  });
  game?.addEventListener("error",()=>{
    if(state)state.textContent="Falha ao abrir Godot. Veja o build no GitHub Actions.";
  });
  $("#start")?.addEventListener("click",startGame);
  $("#reload")?.addEventListener("click",()=>{game.src="./game/index.html?reload="+Date.now()});
  $("#full")?.addEventListener("click",()=>{if(document.fullscreenElement)document.exitFullscreen();else video.requestFullscreen?.()});
  if(studio){
    // A URL contem somente um token de WebSocket de escopo limitado.
    // O segredo administrativo NUNCA aparece na URL da fonte Web.
    document.body.classList.add("studio-mode");
    const token=new URLSearchParams(location.hash.slice(1)).get("key")||"";
    if(!/^[A-Za-z0-9_-]{43}$/.test(token)){
      const error=$("#studioError");
      if(error){error.hidden=false;error.textContent="Link do LIVE Studio inválido. Abra o painel principal, conecte o Render e copie o novo link da fonte Web.";}
    }else{
      const ws=API_ORIGIN.replace(/^https:/,"wss:")+"/ws/studio?token="+encodeURIComponent(token);
      sessionStorage.setItem("bob_live_ws",ws);
      window.BobVoice?.setMode("system");
      startGame();
      // O Browser Source pode exigir habilitar audio nas configuracoes da fonte.
      // Nao tentamos contornar as regras de autoplay do navegador.
    }
    window.addEventListener("pagehide",()=>sessionStorage.removeItem("bob_live_ws"));
    return;
  }
  const voiceMode=$("#voiceMode"),audio=$("#audio");
  voiceMode?.addEventListener("change",()=>window.BobVoice?.setMode(voiceMode.value));
  audio?.addEventListener("click",async()=>{
    audio.disabled=true;
    try{
      if(!window.BobVoice)throw new Error("O sintetizador ainda nao carregou.");
      const activated=await window.BobVoice.activate();
      if(voiceMode)voiceMode.value=window.BobVoice.getState().mode;
      const result=window.BobVoice.getState();
      const element=$("#voiceStatus");
      if(element)element.textContent=activated?.error?
        "Este navegador não disponibiliza voz; confira as configurações do sistema.":
        result.status+" — se não ouvir, verifique a saída de áudio do navegador.";
    }catch(e){if($("#voiceStatus"))$("#voiceStatus").textContent="Áudio indisponível: "+e.message}
    finally{audio.disabled=false}
  });
  async function api(path,options={}){
    if(!secret)throw new Error("Conecte o Render primeiro.");
    const res=await fetch(API_ORIGIN+path,{
      ...options,
      headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json",...(options.headers||{})},
      signal:AbortSignal.timeout(15000),
      cache:"no-store"
    });
    let data;
    try{data=await res.json()}catch{data=null}
    if(!res.ok){
      const detail=typeof data?.error==="string"?data.error:
        res.status===404?"rota indisponível; faça uma atualização completa do navegador":
        res.status===401?"senha incorreta":res.status===403?"origem não autorizada":"servidor indisponível";
      throw new Error(detail+" (HTTP "+res.status+")");
    }
    return data;
  }
  async function update(){
    try{
      const data=await api("/api/status");
      const brain=await api("/api/brain/status").catch(()=>null);
      const online=Boolean(data.tiktok?.listening);
      statusTikTok.textContent="TikTok: "+(online?"ao vivo":"aguardando @nexttec_1");
      statusAI.textContent=brain?.ollama?"IA: Ollama no Actions":
        brain?.vercelOffload?"IA: Vercel + fallback Render":
        "IA: rede neural no Render";
      message("Servidor conectado · "+(data.godot?"Godot conectado":"palco aguardando abertura"));
      $("#simulate").disabled=false;$("#gift").disabled=false;
    }catch(e){message("Conexão interrompida: "+e.message);$("#simulate").disabled=true;$("#gift").disabled=true}
  }
  async function connect(key,{announce=true}={}){
    secret=String(key||"").trim();
    if(secret.length<20||secret.length>256)throw new Error("A chave precisa ter entre 20 e 256 caracteres.");
    await api("/api/status");
    // Link assinado só para renderizar, sem permissao de administrar a API.
    const link=await api("/api/studio/link",{method:"POST",body:""});
    if(!link?.url?.startsWith(SITE_ORIGIN+"/?studio=1#key="))throw new Error("Servidor retornou um link invalido");
    liveUrl=link.url;
    $("#studioLink").value=liveUrl;
    $("#copyLink").disabled=false;
    sessionStorage.setItem("bob_live_admin",secret);
    // O painel e uma previa; a URL de fonte Web se autentica sozinha no LIVE Studio.
    const ws=API_ORIGIN.replace(/^https:/,"wss:")+"/ws/godot?token="+encodeURIComponent(secret);
    sessionStorage.setItem("bob_live_ws",ws);
    if(!video.classList.contains("running"))startGame();
    await update();
    if(poll)clearInterval(poll);
    poll=setInterval(update,9000);
    if(announce)message("Conectado! Copie o link da fonte Web e cole no TikTok LIVE Studio.");
  }
  $("#sessionForm")?.addEventListener("submit",async ev=>{
    ev.preventDefault();
    const button=$("#connect");
    button.disabled=true;
    message("Conectando ao Render…");
    try{await connect($("#sessionKey").value)}
    catch(e){message("Erro ao conectar: "+e.message)}
    finally{button.disabled=false}
  });
  $("#copyLink")?.addEventListener("click",async()=>{
    if(!liveUrl)return;
    try{await navigator.clipboard.writeText(liveUrl);message("Link copiado. Cole na fonte Web do LIVE Studio (1080 × 1920).")}
    catch{
      $("#studioLink").select();
      try{document.execCommand("copy");message("Link selecionado. Copie e cole na fonte Web do LIVE Studio.")}
      catch{message("Selecione e copie o endereço do campo acima.")}
    }
  });
  $("#askBrain")?.addEventListener("click",async()=>{
    const question=String($("#brainQuestion").value||"").trim();
    const output=$("#brainAnswer");
    if(question.length<2){output.textContent="Digite uma pergunta.";return}
    const button=$("#askBrain");
    button.disabled=true;output.textContent="Processando pergunta…";
    try{
      const data=await api("/api/brain/ask",{method:"POST",body:JSON.stringify({question})});
      if(!data?.answer?.text){
        output.textContent="Ainda não tenho uma resposta cadastrada. Ollama ou OpenRouter podem responder perguntas abertas.";
        return;
      }
      output.textContent=data.answer.text+"  ·  "+(data.source==="vercel-neural"?"Vercel":"Render");
      window.BobVoice?.speak(data.answer.text);
    }catch(e){output.textContent="Não foi possível responder: "+e.message}
    finally{button.disabled=false}
  });
  $("#brainQuestion")?.addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();$("#askBrain").click()}
  });
  $("#simulate")?.addEventListener("click",async()=>{
    try{await api("/api/simulate/chat",{method:"POST",body:JSON.stringify({user:"TesteWeb",comment:"Oi Bob, conta uma piada!"})});
      message("Comentário enviado: confira o personagem e a voz.")}
    catch(e){message("Teste de comentário: "+e.message)}
  });
  $("#gift")?.addEventListener("click",async()=>{
    try{await api("/api/simulate/gift",{method:"POST",body:JSON.stringify({user:"TesteWeb",gift:"Rose"})});
      message("Rosa enviada. Confira a animação no palco.")}
    catch(e){message("Teste de presente: "+e.message)}
  });
  // Recuperar apenas no mesmo navegador/aba durante a sessao do estudio.
  const previous=sessionStorage.getItem("bob_live_admin");
  if(previous&&previous.length>=20){
    $("#sessionKey").value=previous;
    connect(previous,{announce:false}).catch(()=>{sessionStorage.removeItem("bob_live_admin");message("Faça novamente a conexão com o Render.")});
  }
  window.addEventListener("pagehide",()=>{
    if(poll)clearInterval(poll);
    sessionStorage.removeItem("bob_live_ws");
  });
})();
