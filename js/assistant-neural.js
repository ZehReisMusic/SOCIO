/** SÓCIO — Voz masculina local experimental.
 * Piper gera WAV no aparelho após download consentido do modelo pt-BR (~65 MB).
 * Código de terceiros é carregado somente após ativação explícita.
 * Em caso de falha, o mecanismo nativo segue disponível. */
export const PIPER_VOICE_ID='pt_BR-faber-medium';
export const PIPER_CDN='https://esm.sh/@mintplex-labs/piper-tts-web@1.0.3?bundle';
const KEY='socio.assistant.neural.v1';
const SAMPLE='Olá! Eu sou o SÓCIO. Vamos organizar suas prioridades e seus negócios.';
export function modelConsentMessage(){
 return 'Testar voz masculina Faber (experimental)? O primeiro uso baixa cerca de 65 MB do modelo e componentes adicionais. '+
 'A geração das frases ocorre no aparelho; exige internet no primeiro download, pode ser lenta e pode não funcionar nesta versão do iPhone. '+
 'Se falhar, você continuará com a voz padrão. O uso comercial da voz deve ser verificado antes de adotá-la definitivamente.';
}
export function createAssistantNeural({status=()=>{},playAudio=async()=>{},loadLibrary=null}={}){
 let lib=null,loading=null,enable=false,prepared=false,busy=false,requested=0;
 try{enable=localStorage.getItem(KEY)==='enabled';}catch{}
 const tell=text=>{try{status(text);}catch{}};
 const loader=loadLibrary||(()=>import(PIPER_CDN));
 const enabled=()=>enable;
 async function load(){
  if(lib)return lib;
  if(!loading){
   loading=Promise.resolve().then(loader).then(mod=>{
    if(!mod||typeof mod.predict!=='function'||typeof mod.download!=='function')throw Error('Biblioteca Piper indisponível.');
    lib=mod;return mod;
   }).catch(err=>{loading=null;throw err;});
  }
  return loading;
 }
 async function prepare(){
  if(busy)return false;
  busy=true;
  tell('Carregando mecanismo de voz masculina…');
  try{
   const engine=await load();
   if(typeof engine.stored==='function'){
    const existing=await engine.stored();
    if(Array.isArray(existing)&&existing.includes(PIPER_VOICE_ID)){
     prepared=true;enable=true;
     try{localStorage.setItem(KEY,'enabled');}catch{}
     tell('Voz masculina Faber pronta. Faça um teste para ouvir.');
     return true;
    }
   }
   tell('Baixando a voz masculina. Aguarde e mantenha o app aberto…');
   await engine.download(PIPER_VOICE_ID,progress=>{
    const value=Number(progress?.total)>0?Math.floor(Number(progress.loaded)/Number(progress.total)*100):null;
    if(value!==null&&Number.isFinite(value))tell('Baixando voz Faber: '+Math.min(100,Math.max(0,value))+'%. Mantenha o app aberto.');
   });
   prepared=true;enable=true;
   try{localStorage.setItem(KEY,'enabled');}catch{}
   tell('Voz masculina preparada. Toque em Testar Faber para confirmar a reprodução.');
   return true;
  }catch(error){
   prepared=false;enable=false;
   try{localStorage.removeItem(KEY);}catch{}
   console.warn('SÓCIO Piper:',error);
   tell('A voz masculina não pôde ser carregada neste iPhone. A voz padrão continua funcionando.');
   return false;
  }finally{busy=false;}
 }
 async function generate(text){
  if(!enable)return {ok:false,reason:'disabled'};
  const id=++requested;
  try{
   tell('Preparando resposta com voz masculina…');
   const engine=await load();
   if(!prepared){ // Em uma nova sessão o modelo pode estar salvo no armazenamento local.
    const stored=await engine.stored?.();
    if(!Array.isArray(stored)||!stored.includes(PIPER_VOICE_ID)){
     enable=false;prepared=false;
     try{localStorage.removeItem(KEY);}catch{}
     tell('O modelo da voz Faber não está mais armazenado. Voltando à voz do iPhone.');
     return {ok:false,reason:'not-cached'};
    }
    prepared=true;
   }
   const wav=await engine.predict({text:String(text||'').trim().slice(0,600),voiceId:PIPER_VOICE_ID});
   if(id!==requested)return {ok:false,reason:'cancelled'};
   if(!(wav instanceof Blob)||!wav.size)throw Error('Áudio não gerado.');
   tell('Reproduzindo a voz masculina Faber.');
   await playAudio(wav);
   if(id!==requested)return {ok:false,reason:'cancelled'};
   tell('Resposta em voz masculina concluída.');
   return {ok:true};
  }catch(error){
   console.warn('SÓCIO Piper geração:',error);
   tell('Falha na voz masculina. Você pode ouvir com a voz padrão do iPhone.');
   return {ok:false,reason:'error'};
  }
 }
 async function test(){
  if(!enable)return {ok:false,reason:'disabled'};
  return generate(SAMPLE);
 }
 function disable(){
  ++requested;enable=false;prepared=false;
  try{localStorage.removeItem(KEY);}catch{}
  tell('Voz do iPhone reativada. O modelo baixado pode permanecer no armazenamento deste navegador.');
 }
 function cancel(){++requested;}
 return {enabled,prepare,generate,test,disable,cancel,modelConsentMessage};
}
