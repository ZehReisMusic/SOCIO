/** MEU SÓCIO V003.23 — comando geral na tela Início.
 * Sem envio a provedores de IA. Voz nativa quando disponível; texto é o fallback. */
import {resolveAssistantCommand,stripAssistantWakeword} from './assistant-core.js';
import {createAssistantSpeech} from './assistant-speech.js';
import {createAssistantNeural,modelConsentMessage} from './assistant-neural.js';
import {isTaskSlotAvailable,reservationMinutes} from './assistant-task-planning.js';
import {dateKey} from './logic.js';
import {applyVocabulary,proposeVoiceCorrection} from './assistant-vocabulary.js';

export function createAssistantController(h){
 let activeRecognition=null, lastResponse=null, lastQuery='',lastTaskId='', pending=null;
 let lastVoiceShown='',pendingLearning=null;
 const INPUT_IDLE_MS=15000;
 let inputClearTimer=null,inputRevision=0;
 let audioStatus='Toque em “Ouvir resposta” para reproduzir o áudio, caso necessário.';
 let neuralStatus=neuralEngineStatusDefault();
 let neuralTechnical='';
 let neuralPreviewUrl='';
 let speechBusy=false,playbackSerial=0,localQueryMs=null,voiceTiming='',nativeFallbackPlaying=false;
 const clock=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
 function setSpeechBusy(active){
  speechBusy=Boolean(active);
  const button=typeof document!=='undefined'?document.getElementById('assistant-stop-audio'):null;
  if(button){button.hidden=!speechBusy;button.disabled=!speechBusy;}
 }
 const safe=h.escape;
 const icon=h.icon;
 function neuralEngineStatusDefault(){return 'Faber pronta para responder.';}
 const voiceEngine=createAssistantSpeech(message=>{
  audioStatus=message;
  const el=typeof document!=='undefined'?document.getElementById('assistant-audio-status'):null;
  if(el)el.textContent=message;
 },playing=>{
  if(!neuralEngine.enabled()||nativeFallbackPlaying)setSpeechBusy(playing);
 });
 const neuralEngine=createAssistantNeural({
  onTiming:({readyMs,fromCache,characters})=>{
   voiceTiming='Consulta local: '+(localQueryMs===null?'—':localQueryMs+' ms')+
    ' · Voz pronta: '+readyMs+' ms · '+(fromCache?'áudio reutilizado':'áudio gerado')+
    ' ('+characters+' caracteres).';
   const el=typeof document!=='undefined'?document.getElementById('assistant-voice-timing'):null;
   if(el)el.textContent=voiceTiming;
  },
  status:message=>{
   const failed=/^FABER-(?:LIB|MODEL|SYNTH|AUDIO|ERR)/.test(message);
   neuralTechnical=failed?message:'';
   neuralStatus=failed?'A Faber apresentou um problema. Veja os detalhes em Diagnóstico de áudio.':message;
   audioStatus=neuralStatus;
   const el=typeof document!=='undefined'?document.getElementById('assistant-neural-status'):null;
   if(el)el.textContent=neuralStatus;
   const reply=typeof document!=='undefined'?document.getElementById('assistant-audio-status'):null;
   if(reply)reply.textContent=neuralStatus;
   const detail=typeof document!=='undefined'?document.getElementById('assistant-voice-diagnostic'):null;
   if(detail){detail.textContent=neuralTechnical;detail.hidden=!failed;}
   if(failed){
    const panel=typeof document!=='undefined'?document.getElementById('assistant-voice-tech'):null;
    if(panel)panel.open=true;
   }
  },
  playAudio:async blob=>{
   try{
    // A saída WebAudio é prioritária; não ocupar espaço com player se funcionou.
    await voiceEngine.playBlob(blob);
   }catch(error){
    if(error?.name==='AbortError')throw error;
    // Só exibir o player HTML nativo quando a saída automática falhar.
    if(typeof document!=='undefined'&&typeof URL.createObjectURL==='function'){
     const panel=document.getElementById('assistant-voice-tech');
     if(panel)panel.open=true;
     const player=document.getElementById('assistant-neural-preview');
     if(player){
      if(neuralPreviewUrl)URL.revokeObjectURL(neuralPreviewUrl);
      neuralPreviewUrl=URL.createObjectURL(blob);
      player.src=neuralPreviewUrl;
      player.hidden=false;
     }
    }
    throw error;
   }
  }
 });

 function getSpeech(){
  return typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition);
 }
 function isHome(){return h.page()==='inicio';}
 function isMacBrowser(){
  const agent=typeof navigator==='undefined'?'':String(navigator.userAgent||'');
  return /Macintosh|Mac OS X/i.test(agent)&&!/iPhone|iPad|iPod/i.test(agent);
 }
 // A configuração Faber e o modelo são locais de cada navegador; nenhum download sem aceite.
 function cancelInputClear(){
  inputRevision++;
  if(inputClearTimer!==null){clearTimeout(inputClearTimer);inputClearTimer=null;}
 }
 function queueInputClear(){
  cancelInputClear();
  if(typeof document==='undefined')return;
  const revision=inputRevision;
  inputClearTimer=setTimeout(()=>{
   inputClearTimer=null;
   if(revision!==inputRevision||!isHome()||activeRecognition||pendingLearning)return;
   const field=document.getElementById('assistant-command-text');
   // Não descartar texto corrigido, digitado e ainda não enviado.
   if(field&&(document.activeElement===field||field.value!==lastQuery))return;
   lastQuery='';lastVoiceShown='';
   if(field)field.value='';
  },INPUT_IDLE_MS);
  inputClearTimer?.unref?.();
 }
 function onCommandInput(event){
  if(event.target?.id!=='assistant-command-text')return false;
  cancelInputClear();return true;
 }
 function onCommandBlur(event){
  if(event.target?.id!=='assistant-command-text')return false;
  if(lastQuery&&!pendingLearning&&event.target.value===lastQuery)queueInputClear();
  return true;
 }
 function stopAudio(){
  ++playbackSerial;
  neuralEngine.cancel();voiceEngine.stop({quiet:true});nativeFallbackPlaying=false;
  const player=typeof document!=='undefined'?document.getElementById('assistant-neural-preview'):null;
  if(player){try{player.pause();player.currentTime=0;}catch{}}
  setSpeechBusy(false);
 }
 function speak(message){
  stopAudio();
  const serial=++playbackSerial;
  setSpeechBusy(true);
  if(neuralEngine.enabled()){
   // O controle de parada aparece já durante a síntese e continua na reprodução.
   void neuralEngine.generate(message).then(out=>{
    if(serial!==playbackSerial)return;
    if(!out.ok&&out.reason!=='cancelled'){
     nativeFallbackPlaying=true;
     if(!voiceEngine.speak(message))setSpeechBusy(false);
    }else setSpeechBusy(false);
   }).catch(error=>{
    if(serial!==playbackSerial)return;
    console.warn('SÓCIO: falha ao gerar a voz.',error);
    nativeFallbackPlaying=true;
    if(!voiceEngine.speak(message))setSpeechBusy(false);
   });
   return true;
  }
  nativeFallbackPlaying=true;
  const ok=voiceEngine.speak(message);
  if(!ok)setSpeechBusy(false);
  return ok;
 }
 function voiceOptions(){
  const info=voiceEngine.voiceInfo();
  return '<option value=""'+(!info.selected?' selected':'')+'>Automática (pt-BR)</option>'+
   info.voices.map(v=>'<option value="'+safe(v.voiceURI)+'"'+(info.selected===v.voiceURI?' selected':'')+'>'+
    safe(v.name+' · '+v.lang)+(v.localService?' · aparelho':'')+'</option>').join('');
 }
 function syncVoicePicker(){
  if(typeof document==='undefined')return;
  const select=document.getElementById('assistant-voice-select');
  if(select)select.innerHTML=voiceOptions();
  const current=document.getElementById('assistant-voice-name');
  if(current)current.textContent=neuralEngine.enabled()?'Faber (masculina, experimental)':voiceEngine.voiceInfo().name;
 }
 if(typeof window!=='undefined'){
  try{window.speechSynthesis?.addEventListener?.('voiceschanged',syncVoicePicker);}catch{}
 }
 // Pré-carregar a sessão neural só após o consentimento anterior, em segundo plano.
 // Isso evita inicializar o ONNX na hora em que a primeira resposta é necessária.
 if(typeof window!=='undefined'&&typeof document!=='undefined'&&neuralEngine.enabled()){
  const prewarm=()=>{
   if(isHome()&&neuralEngine.enabled())void neuralEngine.warmup();
  };
  try{
   if(typeof window.requestIdleCallback==='function')
    window.requestIdleCallback(prewarm,{timeout:3500});
   else setTimeout(prewarm,1800);
  }catch{}
 }
 function clearSessionTimers(session){
  if(!session)return;
  for(const key of ['silenceTimer','endFallback','noSpeechTimer']){
   if(session[key]){clearTimeout(session[key]);session[key]=null;}
  }
 }
 function planSilenceStop(session,delay){
  if(activeRecognition!==session||session.stopping)return;
  if(session.silenceTimer)clearTimeout(session.silenceTimer);
  session.silenceTimer=setTimeout(()=>{
   session.silenceTimer=null;
   if(activeRecognition===session&&session.transcript)stopListening();
  },delay);
 }
 function updateListening(message){
  const label=document.getElementById('assistant-listening-status');
  if(label)label.textContent=message;
 }
 function setAnswer(message,{related='',detail='',lastTaskId:taskId='',slots=[],taskId:scheduledTaskId=''}={}){
  lastResponse={message:String(message||''),related,detail,slots,scheduledTaskId};
  if(taskId)lastTaskId=taskId;
  h.refresh();
  speak(lastResponse.message);
 }
 function execute(raw,{fromVoice=false}={}){
  cancelInputClear();
  const query=applyVocabulary(stripAssistantWakeword(raw).trim().slice(0,350),h.data()?.vocabulary);
  if(fromVoice){lastVoiceShown=query;pendingLearning=null;}
  if(!query){h.toast('Digite ou fale sua pergunta para o SÓCIO.');return;}
  lastQuery=query;
  pending=null;
  const started=clock();
  const result=resolveAssistantCommand(query,h.data(),new Date(),{lastTaskId});
  localQueryMs=Math.max(0,Math.round(clock()-started));
  queueInputClear();
  if(result.kind==='confirm-complete'){
   pending={type:'complete-task',taskId:result.taskId};
   lastResponse={message:result.message,related:'tarefas',detail:''};
   lastTaskId=result.taskId;
   h.refresh();
   speak(result.message);
   return;
  }
  if(result.kind==='prepare-task'){
   lastResponse={message:result.message,related:'tarefas',detail:''};
   h.refresh();speak(result.message);
   h.prepareTask(result.transcript);
   return;
  }
  if(result.kind==='prepare-appointment'){
   lastResponse={message:result.message,related:'agenda',detail:''};
   h.refresh();speak(result.message);
   h.prepareAppointment(result.prefill);
   return;
  }
  if(result.kind==='navigate'||result.kind==='open-soundline'){
   h.toast(result.message);
   h.navigate(result.page||'soundline');
   return;
  }
  setAnswer(result.message,result);
 }
 function cancelListening({stopPlayback=false}={}){
  const old=activeRecognition;activeRecognition=null;
  if(old){old.cancelled=true;clearSessionTimers(old);try{old.recognition.abort();}catch{}}
  if(stopPlayback)stopAudio();
 }
 function finishListening(session){
  if(activeRecognition!==session)return;
  clearSessionTimers(session);
  activeRecognition=null;
  if(!isHome()||session.cancelled)return;
  if(session.transcript){
   execute(session.transcript,{fromVoice:true});
   return;
  }
  const message=session.error||'Não recebi uma transcrição. Você pode usar o campo de texto ou o microfone do teclado.';
  updateListening(message);
  h.toast(message);
  const button=document.getElementById('assistant-mic-button');
  if(button){button.dataset.action='assistant-start-voice';button.innerHTML=icon('mic',17)+' Falar';}
 }
 function startListening(){
  if(activeRecognition){stopListening();return;}
  cancelInputClear();
  stopAudio();
  voiceEngine.primeAudio();
  if(neuralEngine.enabled())void neuralEngine.warmup();
  const Speech=getSpeech();
  if(!Speech){h.toast('Este navegador não oferece reconhecimento de voz para o SÓCIO. Digite a pergunta ou use o microfone do teclado.');return;}
  let recognition;
  try{recognition=new Speech();}catch{h.toast('Não foi possível preparar o microfone. Use o teclado.');return;}
  const session={recognition,transcript:'',cancelled:false,error:'',stopping:false,
    silenceTimer:null,endFallback:null,noSpeechTimer:null};
  activeRecognition=session;
  recognition.lang='pt-BR';
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.onresult=event=>{
   if(activeRecognition!==session)return;
   const segments=Array.from(event.results||[]).map(r=>r[0]?.transcript||'');
   session.transcript=segments.join(' ').trim();
   const input=document.getElementById('assistant-command-text');
   if(input)input.value=applyVocabulary(session.transcript,h.data()?.vocabulary);
   updateListening(session.transcript?'Ouvindo: '+session.transcript:'Ouvindo...');
   if(session.transcript){
    if(session.noSpeechTimer){clearTimeout(session.noSpeechTimer);session.noSpeechTimer=null;}
    const final=Array.from(event.results||[]).some(r=>r.isFinal===true);
    planSilenceStop(session,final?450:1500);
   }
  };
  recognition.onspeechend=()=>{
   if(activeRecognition===session&&session.transcript)planSilenceStop(session,450);
  };
  recognition.onerror=event=>{
   if(activeRecognition!==session)return;
   session.error=event?.error==='not-allowed'||event?.error==='service-not-allowed'?
    'Microfone não autorizado. Você ainda pode digitar o comando.':
    'A transcrição não ficou disponível. Confira a conexão e tente novamente.';
   // Não executar fala parcial em caso de erro de acesso.
   if(event?.error==='not-allowed'||event?.error==='service-not-allowed'||event?.error==='no-speech')session.transcript='';
  };
  recognition.onend=()=>finishListening(session);
  try{
   recognition.start();
   const button=document.getElementById('assistant-mic-button');
   if(button){button.dataset.action='assistant-stop-voice';button.innerHTML=icon('stop',16)+' Parar e revisar';}
   updateListening('Ouvindo... a escuta termina automaticamente após sua fala.'); 
   session.noSpeechTimer=setTimeout(()=>{
    if(activeRecognition===session&&!session.transcript)stopListening();
   },20000);
  }catch(error){
   activeRecognition=null;
   h.toast('Não foi possível ativar o reconhecimento. Use o campo de texto.');
  }
 }
 function stopListening(){
  const session=activeRecognition;if(!session||session.stopping)return;
  session.stopping=true;
  if(session.silenceTimer){clearTimeout(session.silenceTimer);session.silenceTimer=null;}
  if(session.noSpeechTimer){clearTimeout(session.noSpeechTimer);session.noSpeechTimer=null;}
  updateListening('Escuta encerrada. Preparando sua resposta...');
  try{
   session.recognition.stop();
   // Algumas versões do WebKit não enviam onend após stop(): desbloqueio seguro.
   if(activeRecognition!==session)return;
   session.endFallback=setTimeout(()=>{
    session.endFallback=null;
    if(activeRecognition===session){
     try{session.recognition.abort();}catch{}
     finishListening(session);
    }
   },1800);
  }catch{finishListening(session);}
 }
 function render(){
  const listening=Boolean(activeRecognition);
  const voiceInfo=voiceEngine.voiceInfo();
  const mac=isMacBrowser();
  const shortcuts=[
   ['Qual minha prioridade hoje?','Prioridade'],
   ['Quais tarefas estão atrasadas?','Atrasadas'],
   ['Quais orçamentos estão pendentes?','SOUNDLINE']
  ];
  const markup='<section class="assistant-card" aria-label="SÓCIO Assistente">'+
   '<div class="assistant-head"><div class="assistant-emblem" aria-hidden="true">'+icon('mic',24)+'</div>'+
   '<div class="assistant-head-copy"><div class="assistant-eyebrow">SÓCIO ASSISTENTE</div>'+
   '<h2>Fale com o SÓCIO</h2><p>Suas tarefas, sua agenda e seus negócios em uma só voz.</p></div></div>'+ 
   (mac?'<div class="assistant-mac-voice">'+(neuralEngine.enabled()?'<p><strong>Faber ativa neste Mac.</strong> Voz masculina selecionada para as respostas.</p>':
    '<p><strong>Voz neste Mac:</strong> padrão do navegador. A Faber do iPhone não é transferida automaticamente.</p><button type="button" class="btn-outline" data-action="assistant-neural-enable">Ativar Faber neste Mac</button>')+'</div>':'')+
   '<form id="assistant-command-form" class="assistant-command-form">'+
   '<label class="assistant-label" for="assistant-command-text">Pergunte ou peça uma ação</label>'+
   '<div class="assistant-input-row"><input id="assistant-command-text" name="query" type="text" '+
   'maxlength="350" autocomplete="off" enterkeyhint="send" placeholder="Ex.: Qual minha prioridade hoje?" value="'+safe(lastQuery)+'" />'+
   '<button id="assistant-mic-button" type="button" class="btn-outline assistant-mic" data-action="'+(listening?'assistant-stop-voice':'assistant-start-voice')+'">'+
    icon(listening?'stop':'mic',17)+(listening?' Parar agora':' Falar')+'</button>'+
   '<button type="submit" class="btn-primary assistant-send">Consultar</button></div></form>'+
   '<div class="assistant-suggestions" aria-label="Sugestões rápidas">'+shortcuts.map(([q,label])=>
    '<button type="button" class="assistant-suggestion" data-action="assistant-example" data-query="'+safe(q)+'">'+safe(label)+'</button>').join('')+'</div>'+
   '<p class="assistant-status" id="assistant-listening-status" role="status" aria-live="polite">'+
    (listening?'Ouvindo... a escuta termina quando você parar de falar.':'Toque em Falar ou digite. Os comandos são processados pelas regras do aplicativo.')+'</p>'+ 
    (pendingLearning?'<div class="assistant-learn-panel" role="status"><strong>Aprender esta correção?</strong><p>Quando eu ouvir <b>“'+safe(pendingLearning.heard)+'”</b>, interpretar como <b>“'+safe(pendingLearning.correct)+'”</b> nas próximas vezes?</p><div class="assistant-learn-actions"><button type="button" class="btn-primary" data-action="assistant-learn-confirm">Sim, aprender</button><button type="button" class="btn-outline" data-action="assistant-learn-ignore">Agora não</button></div></div>':'')+
   '<details class="assistant-voice-settings"><summary>Voz do SÓCIO · <span id="assistant-voice-name">'+
     safe(neuralEngine.enabled()?'Faber · masculina':voiceInfo.name)+'</span></summary>'+
   '<div class="assistant-voice-compact">'+
   (neuralEngine.enabled()?
    '<div class="assistant-voice-active"><span><strong>Faber</strong><small>Voz masculina brasileira</small></span>'+
      '<span class="assistant-voice-selected">Selecionada</span></div>'+
    '<div class="assistant-voice-actions">'+
      '<button type="button" class="btn-outline" data-action="assistant-neural-test">'+icon('volume-2',15)+' Ouvir exemplo</button>'+
      '<button type="button" class="btn-outline" data-action="assistant-neural-disable">Trocar voz</button></div>'+
    '<p class="assistant-voice-info">O modelo já está no aparelho. A primeira resposta pode demorar enquanto a voz é preparada.</p>':
    '<label for="assistant-voice-select">Voz do dispositivo</label>'+ 
    '<select id="assistant-voice-select" aria-label="Voz brasileira do dispositivo">'+ voiceOptions()+'</select>'+
    '<div class="assistant-voice-actions">'+
      '<button type="button" class="btn-outline" data-action="assistant-test-voice">'+icon('volume-2',15)+' Ouvir exemplo</button>'+
      '<button type="button" class="btn-outline" data-action="assistant-neural-enable">Usar voz masculina Faber</button></div>'+
    '<p class="assistant-voice-info">A Faber funciona sem API paga. Se ainda não tiver o modelo, o primeiro uso pedirá autorização para o download.</p>')+
   '<p class="assistant-neural-status" id="assistant-neural-status" role="status" aria-live="polite">'+safe(neuralStatus)+'</p>'+
   '<details class="assistant-voice-advanced" id="assistant-voice-tech"><summary>Diagnóstico de áudio</summary>'+
    '<p>Utilize estes testes apenas se a reprodução apresentar algum problema.</p>'+
    '<p class="assistant-voice-timing" id="assistant-voice-timing">'+safe(voiceTiming||'Os tempos de consulta e síntese aparecerão após uma resposta.')+'</p>'+ 
    '<p class="assistant-voice-diagnostic" id="assistant-voice-diagnostic"'+(neuralTechnical?'':' hidden')+'>'+safe(neuralTechnical)+'</p>'+
    '<button type="button" class="btn-outline" data-action="assistant-audio-check">Testar saída de áudio</button>'+
    '<audio id="assistant-neural-preview" controls preload="none" hidden aria-label="Reproduzir WAV gerado"></audio>'+
    '<p class="assistant-neural-help">Se aparecer FABER-SYNTH, a geração falhou. Se aparecer FABER-AUDIO, teste o arquivo WAV que será disponibilizado aqui.</p>'+
   '</details></div></details>'+ 
   (lastResponse?'<div class="assistant-response" aria-live="polite"><div class="assistant-response-head"><strong>'+icon('spark',15)+' SÓCIO RESPONDE</strong>'+
     '<span class="assistant-response-actions"><button type="button" class="btn-primary assistant-replay" data-action="assistant-repeat" aria-label="Ouvir resposta">'+icon('volume-2',14)+' Ouvir resposta</button>'+ 
     '<button id="assistant-stop-audio" type="button" class="btn-outline assistant-stop-audio" data-action="assistant-stop-audio" aria-label="Parar reprodução de áudio"'+(speechBusy?'':' hidden')+'>'+icon('stop',14)+' Parar áudio</button></span></div>'+
    '<p class="assistant-audio-status" id="assistant-audio-status" aria-live="polite">'+safe(audioStatus)+'</p>'+
    '<p>'+safe(lastResponse.message)+'</p>'+
    (lastResponse.detail?'<p class="assistant-response-extra">'+safe(lastResponse.detail)+'</p>':'')+
    (lastResponse.slots?.length?'<div class="assistant-task-slots" aria-label="Horários sugeridos">'+lastResponse.slots.map((slot,i)=>'<button type="button" class="btn-outline" data-action="assistant-use-task-slot" data-index="'+i+'">Revisar '+safe(slot.date)+' · '+safe(slot.time)+'</button>').join('')+'</div>':'')+
    (pending?'<div class="assistant-confirm"><button class="btn-primary" type="button" data-action="assistant-confirm-task">Confirmar conclusão</button>'+
      '<button class="btn-outline" type="button" data-action="assistant-cancel-task">Cancelar</button></div>':'')+
    (lastResponse.related&&!pending?'<button type="button" class="assistant-related-link" data-action="assistant-open-related" data-target="'+safe(lastResponse.related)+'">Abrir '+safe(lastResponse.related==='soundline'?'SOUNDLINE':lastResponse.related==='tarefas'?'Tarefas':'Agenda')+'</button>':'')+
    '</div>':'')+
   '</section>';
  return markup;
 }
 function action(target){
  const command=target?.dataset?.action||'';
  if(command==='assistant-learn-confirm'){
   const choice=pendingLearning;pendingLearning=null;
   if(choice&&h.learnVocabulary?.(choice.heard,choice.correct))h.toast('Correção aprendida. Ela será aplicada aos próximos ditados.');
   h.refresh();queueInputClear();return true;
  }
  if(command==='assistant-learn-ignore'){pendingLearning=null;h.refresh();queueInputClear();return true;}
  if(command==='assistant-stop-audio'){
   stopAudio();
   audioStatus='Áudio interrompido. A resposta escrita permanece disponível.';
   const label=typeof document!=='undefined'?document.getElementById('assistant-audio-status'):null;
   if(label)label.textContent=audioStatus;
   return true;
  }
  if(command==='assistant-use-task-slot'){
   const slot=lastResponse?.slots?.[Number(target.dataset.index)];
   const task=(h.data()?.tasks||[]).find(t=>t.id===lastResponse?.scheduledTaskId&&t.status!=='done');
   const now=new Date();
   if(!task||!slot||!isTaskSlotAvailable(slot,h.data()?.appointments||[],now)||
     (task.due&&task.due>=dateKey(now)&&slot.date>task.due)||
     slot.durationMinutes!==reservationMinutes(task)){
    setAnswer('O horário sugerido mudou ou não está mais disponível. Pergunte novamente para consultar a Agenda atual.',{related:'agenda'});
    return true;
   }
   h.prepareAppointment({title:('Executar: '+task.title).slice(0,250),date:slot.date,time:slot.time,
    durationMinutes:slot.durationMinutes,taskId:task.id,taskIds:[task.id],notes:'Tempo reservado para executar a tarefa: '+task.title});
   return true;
  }
  if(command==='assistant-start-voice'){startListening();return true;}
  if(command==='assistant-stop-voice'){stopListening();return true;}
  if(command==='assistant-example'){lastVoiceShown='';pendingLearning=null;voiceEngine.primeAudio();execute(target.dataset.query||'');return true;}
  if(command==='assistant-repeat'){voiceEngine.primeAudio();if(lastResponse&&!speak(lastResponse.message))h.toast('Leitura de voz indisponível. A resposta está escrita na tela.');return true;}
  if(command==='assistant-test-voice'){
   voiceEngine.primeAudio();
   if(!voiceEngine.speak('Olá! Eu sou o SÓCIO. Estou aqui para ajudar você a organizar suas tarefas e seus negócios.'))
    h.toast('O aparelho não oferece síntese de voz neste navegador.');
   return true;
  }
  if(command==='assistant-neural-enable'){
   if(typeof window!=='undefined'&&!window.confirm(modelConsentMessage()))return true;
   voiceEngine.primeAudio();
   void neuralEngine.prepare().then(ok=>{
    if(ok)h.toast('Faber ativada. Já pode usar o SÓCIO.');
    else h.toast('Faber indisponível neste aparelho. A voz padrão continua ativa.');
    h.refresh();
   });
   return true;
  }
  if(command==='assistant-neural-test'){
   voiceEngine.primeAudio();
   const player=typeof document!=='undefined'?document.getElementById('assistant-neural-preview'):null;
   if(player){player.hidden=true;player.removeAttribute('src');player.load?.();}
   if(neuralPreviewUrl){URL.revokeObjectURL(neuralPreviewUrl);neuralPreviewUrl='';}
   void neuralEngine.test().then(out=>{
    if(!out.ok&&out.reason!=='cancelled'){
     const phase=out.phase||out.diagnostic?.phase||'não identificada';
     h.toast('Teste Faber: falha na etapa '+phase+'. Veja o diagnóstico no cartão.');
    }
   });
   return true;
  }
  if(command==='assistant-audio-check'){
   if(!voiceEngine.testOutput())h.toast('Não foi possível gerar tom de teste no iPhone.');
   else h.toast('Tom de teste enviado; confirme se ouviu.');
   return true;
  }
  if(command==='assistant-neural-disable'){
   stopAudio();neuralEngine.disable();
   if(neuralPreviewUrl){URL.revokeObjectURL(neuralPreviewUrl);neuralPreviewUrl='';}
   h.refresh();return true;
  }
  if(command==='assistant-cancel-task'){
   pending=null;lastResponse={message:'Tudo certo. A tarefa não foi alterada.',related:'',detail:''};
   h.refresh();return true;
  }
  if(command==='assistant-confirm-task'){
   const id=pending?.type==='complete-task'?pending.taskId:'';
   const task=(h.data()?.tasks||[]).find(t=>t.id===id&&t.status!=='done');
   pending=null;
   if(!task){setAnswer('A tarefa já foi concluída ou não está disponível. Nenhuma alteração foi feita.');return true;}
   h.completeTask(id);
   lastResponse={message:'Tarefa "'+task.title+'" marcada como concluída. Avanço registrado.',related:'tarefas',detail:''};
   h.refresh();
   speak(lastResponse.message);
   return true;
  }
  if(command==='assistant-open-related'){
   const page=target.dataset.target;
   if(['tarefas','agenda','soundline'].includes(page))h.navigate(page);
   return true;
  }
  return false;
 }
 function submit(event){
  if(event.target?.id!=='assistant-command-form')return false;
  cancelInputClear();
  event.preventDefault();
  voiceEngine.primeAudio();
  const input=event.target.querySelector('[name="query"]');
  if(activeRecognition)cancelListening();
  const utterance=input?.value||'';
  const proposed=lastVoiceShown?proposeVoiceCorrection(lastVoiceShown,stripAssistantWakeword(utterance)):null;
  lastVoiceShown='';pendingLearning=null;
  execute(utterance);
  if(proposed){
   const known=applyVocabulary(proposed.heard,h.data()?.vocabulary);
   if(known.toLocaleLowerCase('pt-BR')===proposed.heard.toLocaleLowerCase('pt-BR')){
    pendingLearning=proposed;cancelInputClear();h.refresh();
   }
  }
  return true;
 }
 function change(event){
  if(event.target?.id!=='assistant-voice-select')return false;
  voiceEngine.selectVoice(event.target.value||'');
  if(neuralEngine.enabled())neuralEngine.disable();
  syncVoicePicker();
  return true;
 }
 function rememberTask(id){if(id)lastTaskId=id;}
 return {render,action,submit,change,cancelListening,stopAudio,rememberTask,onCommandInput,onCommandBlur};
}
