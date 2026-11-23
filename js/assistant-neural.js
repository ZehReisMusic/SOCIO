/** SÓCIO — Voz masculina local experimental.
 * Piper gera WAV no aparelho após download consentido do modelo pt-BR (~65 MB).
 * Código de terceiros é carregado somente após ativação explícita.
 * Em caso de falha, o mecanismo nativo segue disponível. */
export const PIPER_VOICE_ID='pt_BR-faber-medium';
// Versão de onnxruntime-web deve coincidir com os binários WASM de 1.18.0
// usados no próprio Piper Mintplex; evitar resolver ^1.18.0 para um 1.x posterior.
export const PIPER_ORT_VERSION='1.18.0';
export const PIPER_CDN='https://esm.sh/@mintplex-labs/piper-tts-web@1.0.3?bundle&deps=onnxruntime-web@1.18.0';
const KEY='socio.assistant.neural.v1';
const SAMPLE='Olá! Eu sou o SÓCIO. Vamos organizar suas prioridades e seus negócios.';
export function modelConsentMessage(){
 return 'Testar voz masculina Faber (experimental)? O primeiro uso baixa cerca de 65 MB do modelo e componentes adicionais. '+
 'A geração das frases ocorre no aparelho; exige internet no primeiro download, pode ser lenta e pode não funcionar nesta versão do iPhone. '+
 'Se falhar, você continuará com a voz padrão. O uso comercial da voz deve ser verificado antes de adotá-la definitivamente.';
}
export function createAssistantNeural({status=()=>{},playAudio=async()=>{},onTiming=()=>{},loadLibrary=null}={}){
 let lib=null,loading=null,enable=false,prepared=false,busy=false,requested=0;
 let lastProblem=null,lastWav=null;
 let warmupPromise=null,warmupReady=false;
 const wavCache=new Map();
 const CACHE_LIMIT=3;
 try{enable=localStorage.getItem(KEY)==='enabled';}catch{}
 const tell=text=>{try{status(text);}catch{}};
 const clock=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
 const loader=loadLibrary||(()=>import(PIPER_CDN));
 const enabled=()=>enable;
 const diagnostic=()=>lastProblem?{...lastProblem}:null;
 const generatedAudio=()=>lastWav;
 const warmedUp=()=>warmupReady;
 function cacheWav(text,wav){
  if(wavCache.has(text))wavCache.delete(text);
  wavCache.set(text,wav);
  // Armazenamento só em memória nesta sessão, limitado a três respostas.
  while(wavCache.size>CACHE_LIMIT)wavCache.delete(wavCache.keys().next().value);
 }
 async function warmup(){
  if(!enable)return false;
  if(warmupPromise)return warmupPromise;
  // Executa antecipadamente a mesma inicialização ONNX que predict faria
  // na primeira fala, reutilizando a sessão TtsSession da biblioteca.
  warmupPromise=(async()=>{
   try{
    const engine=await load();
    if(typeof engine.TtsSession?.create!=='function')return false;
    const stored=await engine.stored?.();
    if(!Array.isArray(stored)||!stored.includes(PIPER_VOICE_ID))return false;
    await engine.TtsSession.create({voiceId:PIPER_VOICE_ID});
    if(!enable)return false;
    warmupReady=true;prepared=true;
    return true;
   }catch(error){
    // Falha de pré-carregamento não desativa a voz nem impede a tentativa manual.
    console.warn('SÓCIO Faber pré-carregamento:',error);
    return false;
   }
  })();
  return warmupPromise;
 }
 const shortError=error=>String(error?.message||error?.name||error||'Erro desconhecido')
  .replace(/[\r\n\t]+/g,' ').slice(0,160);
 function reportFailure(phase,error){
  const code={biblioteca:'FABER-LIB',modelo:'FABER-MODEL',sintese:'FABER-SYNTH',audio:'FABER-AUDIO'}[phase]||'FABER-ERR';
  lastProblem={phase,code,detail:shortError(error)};
  const help=phase==='audio'?'O WAV foi gerado. Teste o reprodutor manual abaixo.':
   phase==='sintese'?'O modelo está cadastrado, mas o iPhone não conseguiu gerar a fala.':
   'Não foi possível carregar o motor ou os arquivos necessários.';
  tell(code+' — '+help+' A voz padrão do iPhone segue disponível. Detalhe: '+lastProblem.detail);
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
     tell('Voz masculina Faber pronta.');
     void warmup();
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
   tell('Voz masculina preparada.');
   void warmup();
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
  const began=clock();
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
   const phrase=String(text||'').trim().slice(0,600);
   let wav=wavCache.get(phrase);
   const fromCache=Boolean(wav);
   if(wav){
    tell('Reproduzindo áudio já preparado…');
   }else{
    tell(warmupReady?'Gerando fala com Faber…':'Preparando primeira resposta com Faber…');
    // Se o pré-carregamento ainda está rodando, aproveita o resultado sem
    // iniciar uma segunda sessão de inferência. Se falhar, predict tentará.
    if(warmupPromise)await warmupPromise;
    if(id!==requested)return {ok:false,reason:'cancelled'};
    wav=await engine.predict({text:phrase,voiceId:PIPER_VOICE_ID});
   }
   if(id!==requested)return {ok:false,reason:'cancelled'};
   if(!(wav instanceof Blob)||!wav.size)throw Error('O motor não produziu arquivo WAV.');
   lastWav=wav;
   if(!wavCache.has(phrase))cacheWav(phrase,wav);
   try{onTiming({readyMs:Math.round(clock()-began),fromCache,characters:phrase.length});}catch{}
   phase='audio';
   tell('Fala gerada. Tentando reproduzir no alto-falante…');
   await playAudio(wav);
   if(id!==requested)return {ok:false,reason:'cancelled'};
   tell('Resposta Faber concluída. Para ouvir novamente, toque em Ouvir resposta.');
   return {ok:true,phase:'audio',wav};
  }catch(error){
   if(id!==requested||error?.name==='AbortError')return {ok:false,reason:'cancelled'};
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
  warmupPromise=null;warmupReady=false;wavCache.clear();
  try{localStorage.removeItem(KEY);}catch{}
  tell('Voz do iPhone reativada. O modelo baixado pode permanecer no armazenamento deste navegador.');
 }
 function cancel(){++requested;}
 return {enabled,prepare,warmup,warmedUp,generate,test,disable,cancel,diagnostic,generatedAudio,modelConsentMessage};
}
