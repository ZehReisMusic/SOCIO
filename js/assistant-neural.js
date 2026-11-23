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
 let lastProblem=null,lastWav=null;
 try{enable=localStorage.getItem(KEY)==='enabled';}catch{}
 const tell=text=>{try{status(text);}catch{}};
 const loader=loadLibrary||(()=>import(PIPER_CDN));
 const enabled=()=>enable;
 const diagnostic=()=>lastProblem?{...lastProblem}:null;
 const generatedAudio=()=>lastWav;
 const shortError=error=>String(error?.message||error?.name||error||'Erro desconhecido')
  .replace(/[\r\n\t]+/g,' ').slice(0,160);
 function reportFailure(phase,error){
  const code={biblioteca:'FABER-LIB',modelo:'FABER-MODEL',sintese:'FABER-SYNTH',audio:'FABER-AUDIO'}[phase]||'FABER-ERR';
  lastProblem={phase,code,detail:shortError(error)};
  const help=phase==='audio'?'O WAV foi gerado. Teste o reprodutor manual abaixo.':
   phase==='sintese'?'O modelo está cadastrado, mas o iPhone não conseguiu gerar a fala.':
   'Não foi possível carregar o motor ou os arquivos necessários.';
  tell(code+' — '+help+' Detalhe: '+lastProblem.detail);
  return lastProblem;
 }
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
  lastProblem=null;
  let phase='biblioteca';
  tell('Carregando mecanismo de voz masculina…');
  try{
   const engine=await load();
   phase='modelo';
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
   reportFailure(phase,error);
   return false;
  }finally{busy=false;}
 }
 async function generate(text){
  if(!enable)return {ok:false,reason:'disabled'};
  const id=++requested;
  lastProblem=null;
  lastWav=null;
  let phase='biblioteca';
  try{
   tell('Etapa 1/3: carregando motor de voz…');
   const engine=await load();
   phase='modelo';
   tell('Etapa 2/3: verificando modelo Faber…');
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
   phase='sintese';
   tell('Etapa 3/3: gerando fala no iPhone… aguarde.');
   const wav=await engine.predict({text:String(text||'').trim().slice(0,600),voiceId:PIPER_VOICE_ID});
   if(id!==requested)return {ok:false,reason:'cancelled'};
   if(!(wav instanceof Blob)||!wav.size)throw Error('O motor não produziu arquivo WAV.');
   lastWav=wav;
   phase='audio';
   tell('Fala gerada. Tentando reproduzir no alto-falante…');
   await playAudio(wav);
   if(id!==requested)return {ok:false,reason:'cancelled'};
   tell('Resposta Faber finalizada. Você pode repetir no reprodutor abaixo.');
   return {ok:true,phase:'audio',wav};
  }catch(error){
   console.warn('SÓCIO Piper geração:',error);
   const detail=reportFailure(phase,error);
   return {ok:false,reason:'error',phase,diagnostic:detail,wav:lastWav};
  }
 }
 async function test(){
  if(!enable)return {ok:false,reason:'disabled'};
  return generate(SAMPLE);
 }
 function disable(){
  ++requested;enable=false;prepared=false;lastWav=null;lastProblem=null;
  try{localStorage.removeItem(KEY);}catch{}
  tell('Voz do iPhone reativada. O modelo baixado pode permanecer no armazenamento deste navegador.');
 }
 function cancel(){++requested;}
 return {enabled,prepare,generate,test,disable,cancel,diagnostic,generatedAudio,modelConsentMessage};
}
