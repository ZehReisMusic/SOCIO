/** Síntese de voz local para o SÓCIO. Não envia texto a APIs externas.
 * Algumas PWAs iOS exigem toque para a primeira reprodução: reportar estado,
 * nunca afirmar que o áudio foi ouvido apenas porque speak() não lançou erro. */
const KEY='socio.assistant.voice.v1';
const norm=s=>String(s||'').toLowerCase();
const voiceScore=v=>{
 const name=norm(v.name),lang=norm(v.lang);
 let score=lang==='pt-br'?100:lang.startsWith('pt')?20:0;
 if(v.localService)score+=10;
 if(/enhanced|premium|natural|neural|aprimorada|melhorada/.test(name))score+=30;
 if(/compact|comprimid|low quality|baixa qualidade/.test(name))score-=40;
 if(/luciana|francisca|joana|raquel/.test(name))score+=4;
 return score;
};
export function rankPortugueseVoices(voices=[]){
 return (Array.isArray(voices)?voices:[])
  .filter(v=>norm(v?.lang).startsWith('pt'))
  .sort((a,b)=>voiceScore(b)-voiceScore(a)||String(a.name).localeCompare(String(b.name),'pt-BR'));
}
export function createAssistantSpeech(onStatus=()=>{},onActivity=()=>{}){
 let utterance=null,pendingTimer=null,selected='';
 let audioContext=null,sourceNode=null,playbackResolver=null,playbackToken=0;
 const activity=playing=>{try{onActivity(Boolean(playing));}catch{}};
 try{selected=localStorage.getItem(KEY)||'';}catch{}
 const notify=(message)=>{
  try{onStatus(message);}catch{}
 };
 const engine=()=>typeof window!=='undefined'?window.speechSynthesis:null;
 const getVoices=()=>{try{return rankPortugueseVoices(engine()?.getVoices?.()||[]);}catch{return [];}};
 const chosenVoice=()=>{
  const voices=getVoices();
  return voices.find(v=>v.voiceURI===selected)||voices[0]||null;
 };
 function getAudioContext(){
  const Ctor=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
  if(!Ctor)return null;
  // iOS pode mudar o estado para "interrupted" ao ativar o microfone.
  // Um contexto interrompido pode não voltar a emitir áudio quando retestado.
  if(!audioContext||audioContext.state==='closed'||audioContext.state==='interrupted'){
   const previous=audioContext;
   audioContext=new Ctor();
   if(previous&&previous!==audioContext){
    try{const closing=previous.close?.();if(closing?.catch)void closing.catch(()=>{});}catch{}
   }
  }
  return audioContext;
 }
 function primeAudio(){
  // Chamado diretamente no toque de Falar/Consultar/Testar: desbloqueia Web Audio
  // para arquivos WAV gerados depois. Não garante liberar speechSynthesis nativo.
  try{
   const ctx=getAudioContext();
   if(!ctx)return false;
   if(ctx.state!=='running'){
    try{const resuming=ctx.resume?.();if(resuming?.catch)void resuming.catch(()=>{});}catch{}
   }
   const silence=ctx.createBuffer(1,1,ctx.sampleRate||22050);
   const silent=ctx.createBufferSource();
   silent.buffer=silence;silent.connect(ctx.destination);silent.start(0);
   return true;
  }catch{return false;}
 }
 function testOutput(){
  // Tom curto gerado localmente no próprio toque. Testa Web Audio, não a voz Piper.
  try{
   primeAudio();
   if(!audioContext?.createOscillator||!audioContext?.createGain)throw Error('Web Audio sem oscilador.');
   const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
   oscillator.type='sine';oscillator.frequency.value=520;
   gain.gain.value=0.08;
   oscillator.connect(gain);gain.connect(audioContext.destination);
   oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};
   oscillator.start();oscillator.stop(audioContext.currentTime+0.30);
   notify('Tom de teste solicitado ('+String(audioContext?.state||'desconhecido')+'). Se não ouviu, verifique o volume ou tente novamente.');
   return true;
  }catch(error){
   notify('Não foi possível testar o áudio pelo Web Audio neste aparelho.');
   return false;
  }
 }
 async function playBlob(wav){
  const token=playbackToken;
  const cancelled=()=>{if(token!==playbackToken)throw Object.assign(new Error('Reprodução cancelada.'),{name:'AbortError'});};
  const ctx=getAudioContext();
  if(!ctx)throw Error('O iPhone não oferece Web Audio.');
  if(ctx.state!=='running')await ctx.resume?.();
  cancelled();
  if(ctx.state==='interrupted')throw Error('Web Audio interrompido; toque em Play no reprodutor WAV.');
  const data=await wav.arrayBuffer();
  const decoded=await ctx.decodeAudioData(data);
  cancelled();
  if(!decoded||!decoded.length)throw Error('Não foi possível decodificar áudio.');
  stopSource();
  return new Promise((resolve,reject)=>{
   try{
    const node=ctx.createBufferSource();
    sourceNode=node;playbackResolver=resolve;
    node.buffer=decoded;
    node.connect(ctx.destination);
    node.onended=()=>{if(sourceNode===node){sourceNode=null;playbackResolver=null;activity(false);}resolve();};
    node.start(0);
    activity(true);
   }catch(error){sourceNode=null;playbackResolver=null;reject(error);}
  });
 }
 function stopSource(){
  if(sourceNode){
   activity(false);
   const old=sourceNode;sourceNode=null;
   try{old.onended=null;old.stop(0);old.disconnect();}catch{}
  }
  if(playbackResolver){const done=playbackResolver;playbackResolver=null;done();}
 }
 function stop({quiet=false}={}){
  playbackToken++;
  stopSource();
  activity(false);
  if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
  if(utterance){utterance.onstart=null;utterance.onend=null;utterance.onerror=null;utterance=null;}
  try{engine()?.cancel?.();}catch{}
  if(!quiet)notify('Áudio interrompido.');
 }
 function speak(value){
  const synth=engine();
  const Ctor=typeof window!=='undefined'?window.SpeechSynthesisUtterance:null;
  if(!synth||typeof Ctor!=='function'){
   notify('Voz de leitura indisponível neste navegador. A resposta permanece escrita.');
   return false;
  }
  const message=String(value||'').trim().replace(/;\s*/g,'. ').slice(0,1000);
  if(!message)return false;
  stop({quiet:true});
  let started=false;
  try{
   const item=new Ctor(message);
   utterance=item;item.lang='pt-BR';item.rate=0.94;item.pitch=1.01;item.volume=1;
   const voice=chosenVoice();if(voice)item.voice=voice;
   item.onstart=()=>{
    if(utterance!==item)return;
    started=true;
    activity(true);
    if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
    notify('Reproduzindo a resposta. Se não ouvir, confira o volume e o modo silencioso do iPhone.');
   };
   item.onend=()=>{
    if(utterance!==item)return;utterance=null;
    activity(false);
    if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
    notify('Resposta finalizada. Toque em “Ouvir resposta” para repetir.');
   };
   item.onerror=()=>{
    if(utterance!==item)return;utterance=null;
    activity(false);
    if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
    notify('O iPhone não conseguiu reproduzir automaticamente. Toque em “Ouvir resposta”.');
   };
   synth.speak(item);
   activity(true);
   // WebKit pode bloquear saída automática sem emitir error/onstart.
   pendingTimer=setTimeout(()=>{
    pendingTimer=null;
    if(utterance===item&&!started)notify('Se não ouviu o áudio, toque em “Ouvir resposta” (reprodução iniciada por toque).');
   },1800);
   return true;
  }catch(error){
   utterance=null;
   console.warn('SÓCIO: reprodução de voz indisponível.',error);
   notify('Não foi possível iniciar a voz. Use “Ouvir resposta” para tentar novamente.');
   return false;
  }
 }
 function selectVoice(uri){
  const available=getVoices();
  selected=available.some(v=>v.voiceURI===uri)?uri:'';
  try{if(selected)localStorage.setItem(KEY,selected);else localStorage.removeItem(KEY);}catch{}
  notify(selected?'Voz escolhida. Toque em “Testar voz” para ouvir.':'Seleção automática da melhor voz em português disponível.');
 }
 function voiceInfo(){
  const voices=getVoices(),voice=chosenVoice();
  return {voices,selected:voices.some(v=>v.voiceURI===selected)?selected:'',available:!!engine(),name:voice?.name||'Voz padrão do iPhone'};
 }
 return {speak,stop,primeAudio,testOutput,playBlob,selectVoice,voiceInfo,getVoices};
}
