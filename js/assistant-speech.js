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
export function createAssistantSpeech(onStatus=()=>{}){
 let utterance=null,pendingTimer=null,selected='';
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
 function stop({quiet=false}={}){
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
  const message=String(value||'').trim().slice(0,1000);
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
    if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
    notify('Reproduzindo a resposta. Se não ouvir, confira o volume e o modo silencioso do iPhone.');
   };
   item.onend=()=>{
    if(utterance!==item)return;utterance=null;
    if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
    notify('Resposta finalizada. Toque em “Ouvir resposta” para repetir.');
   };
   item.onerror=()=>{
    if(utterance!==item)return;utterance=null;
    if(pendingTimer!==null){clearTimeout(pendingTimer);pendingTimer=null;}
    notify('O iPhone não conseguiu reproduzir automaticamente. Toque em “Ouvir resposta”.');
   };
   synth.speak(item);
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
  return {voices,selected:voice?.voiceURI||'',available:!!engine(),name:voice?.name||'Voz padrão do iPhone'};
 }
 return {speak,stop,selectVoice,voiceInfo,getVoices};
}
