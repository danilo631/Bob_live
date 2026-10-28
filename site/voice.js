/* Bob Live | voz cartoon pt-BR e opcao neural Kokoro-82M.
 * Uma unica pagina Render; o motor neural roda no navegador, nao no servidor.
 * Voz sintetica caricata original; nao reproduz timbre ou falas protegidas de dubladores.
 */
(() => {
  "use strict";
  const MODEL="onnx-community/Kokoro-82M-v1.0-ONNX";
  const modUrl="https://esm.sh/kokoro-js@1.2.1?bundle";
  const supported=["system","neural"];
  let mode="system", modelPromise=null, audioContext=null, activeSource=null, speech=null;
  let token=0;
  let state="Voz cartoon do navegador pronta";
  function message(msg) {
    state=String(msg);
    const label=document.getElementById("voiceStatus");
    if(label)label.textContent=state;
  }
  function cancel() {
    ++token;
    if(activeSource){try{activeSource.stop()}catch{};activeSource.disconnect();activeSource=null;}
    if("speechSynthesis" in window){window.speechSynthesis.cancel();}
    speech=null;
  }
  function setMode(value) {
    mode=supported.includes(value)?value:"system";
    message(mode==="neural"?"Kokoro neural: clique em ativar para baixar modelo":"Voz cartoon nativa selecionada");
    return mode;
  }
  async function initNeural() {
    if(!modelPromise){
      message("Carregando voz neural Kokoro em português... O modelo pode exigir mais de 90 MB.");
      modelPromise=(async()=>{
        const imported=await import(/* @vite-ignore */ modUrl);
        const TTS=imported.KokoroTTS;
        if(!TTS)throw new Error("Biblioteca Kokoro indisponível");
        const model=await TTS.from_pretrained(MODEL,{dtype:"q8",device:"wasm"});
        const voices=typeof model.list_voices==="function"?model.list_voices():{};
        if(voices&&typeof voices==="object"&&!Object.keys(voices).some(k=>k==="pm_alex")){
          throw new Error("Voz portuguesa pm_alex não disponível");
        }
        message("Kokoro neural pronto: voz pt-BR, estilo cartoon");
        return model;
      })().catch(err=>{modelPromise=null;throw err;});
    }
    return modelPromise;
  }
  async function activate() {
    if(mode==="neural"){
      try{ await initNeural(); return {neural:true}; }
      catch(err) {
        message("Kokoro não carregou ("+String(err.message).slice(0,90)+"). Voltando para voz do navegador.");
        mode="system";
      }
    }
    if(!("speechSynthesis" in window)) {
      message("Este navegador não oferece voz Web Speech");
      return {neural:false,error:true};
    }
    const demo=new SpeechSynthesisUtterance("Aê, turma! Bem-vindos à nossa aventura!");
    demo.lang="pt-BR";demo.pitch=1.48;demo.rate=1.16;demo.volume=1;
    const v=window.speechSynthesis.getVoices().find(v=>v.lang.replace("_","-").toLowerCase()==="pt-br");
    if(v)demo.voice=v;
    cancel();
    window.speechSynthesis.speak(demo);
    message("Voz cartoon pt-BR ativada: rápida e aguda");
    return {neural:false};
  }
  function speakSystem(text,complete) {
    if(!("speechSynthesis" in window)){complete();return;}
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang="pt-BR";
    utterance.rate=1.16;
    utterance.pitch=1.48;
    utterance.volume=1;
    const voices=window.speechSynthesis.getVoices();
    utterance.voice=voices.find(v=>v.lang.replace("_","-").toLowerCase()==="pt-br")||null;
    speech=utterance;
    utterance.onend=complete;utterance.onerror=complete;
    try {window.speechSynthesis.speak(utterance);}catch{complete();}
  }
  async function speakNeural(text,finish,myToken) {
    try {
      const model=await initNeural();
      if(token!==myToken)return;
      const result=await model.generate(text,{voice:"pm_alex",speed:1.18});
      if(token!==myToken)return;
      let samples=result.audio;
      let sampleRate=Number(result.sampling_rate||24000);
      if(!samples || !Number.isFinite(samples.length) || samples.length<20)
        throw new Error("Kokoro não retornou áudio PCM");
      if(!(samples instanceof Float32Array))samples=Float32Array.from(samples);
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context)throw new Error("Web Audio indisponível");
      audioContext=audioContext||new Context();
      await audioContext.resume();
      if(token!==myToken)return;
      const buffer=audioContext.createBuffer(1,samples.length,sampleRate);
      buffer.getChannelData(0).set(samples);
      const source=audioContext.createBufferSource();
      source.buffer=buffer;
      source.playbackRate.value=1.12; // pitch mais agudo (sem usar voz original)
      const limiter=audioContext.createDynamicsCompressor();
      limiter.threshold.value=-13;limiter.ratio.value=2.5;
      source.connect(limiter);limiter.connect(audioContext.destination);
      activeSource=source;
      source.onended=finish;
      source.start();
    } catch(err){
      if(token!==myToken)return;
      message("Kokoro indisponível nesta sessão; usando voz cartoon nativa.");
      speakSystem(text,finish);
    }
  }
  function speak(text,complete=()=>{}) {
    cancel();
    const myToken=token;
    let ended=false;
    const done=()=>{
      if(ended||myToken!==token)return;
      ended=true;activeSource=null;speech=null;
      try{complete()}catch{}
    };
    const phrase=String(text||"").replace(/\s+/g," ").trim().slice(0,400);
    if(!phrase){done();return;}
    if(mode==="neural")void speakNeural(phrase,done,myToken);
    else speakSystem(phrase,done);
  }
  window.BobVoice={setMode,activate,speak,cancel,getState:()=>({mode,status:state})};
})();
