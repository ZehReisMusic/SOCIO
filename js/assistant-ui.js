/** MEU SÓCIO V003.23 — comando geral na tela Início.
 * Sem envio a provedores de IA. Voz nativa quando disponível; texto é o fallback. */
import {resolveAssistantCommand,stripAssistantWakeword} from './assistant-core.js';
import {createAssistantSpeech} from './assistant-speech.js';
import {createAssistantNeural,modelConsentMessage} from './assistant-neural.js';

export function createAssistantController(h){
 let activeRecognition=null, lastResponse=null, lastQuery='',lastTaskId='', pending=null;
 let audioStatus='Toque em “Ouvir resposta” para reproduzir o áudio, caso necessário.';
 let neuralStatus='A voz masculina é opcional, experimental e exige baixar o modelo.';
 let neuralPreviewUrl='';
 const safe=h.escape;
 const icon=h.icon;
 const voiceEngine=createAssistantSpeech(message=>{
  audioStatus=message;
  const el=typeof document!=='undefined'?document.getElementById('assistant-audio-status'):null;
  if(el)el.textContent=message;
 });
 const neuralEngine=createAssistantNeural({
  status:message=>{
   neuralStatus=message;
   audioStatus=message;
   const el=typeof document!=='undefined'?document.getElementById('assistant-neural-status'):null;
   if(el)el.textContent=message;
   const reply=typeof document!=='undefined'?document.getElementById('assistant-audio-status'):null;
   if(reply)reply.textContent=message;
  },
  playAudio:blob=>{
   if(typeof document!=='undefined'&&typeof URL.createObjectURL==='function'){
    const player=document.getElementById('assistant-neural-preview');
    if(player){
     if(neuralPreviewUrl)URL.revokeObjectURL(neuralPreviewUrl);
     neuralPreviewUrl=URL.createObjectURL(blob);
     player.src=neuralPreviewUrl;
     player.hidden=false;
    }
   }
   return voiceEngine.playBlob(blob);
  }
 });

 function getSpeech(){
  return typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition);
 }
 function isHome(){return h.page()==='inicio';}
 function stopAudio(){neuralEngine.cancel();voiceEngine.stop({quiet:true});}
 function speak(message){
  if(neuralEngine.enabled()){
   // Mantém o fallback no caso de o iOS impedir carregar ou executar o modelo.
   void neuralEngine.generate(message).then(out=>{
    if(!out.ok&&out.reason!=='cancelled')voiceEngine.speak(message);
   });
   return true;
  }
  return voiceEngine.speak(message);
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
 function setAnswer(message,{related='',detail='',lastTaskId:taskId=''}={}){
  lastResponse={message:String(message||''),related,detail};
  if(taskId)lastTaskId=taskId;
  h.refresh();
  speak(lastResponse.message);
 }
 function execute(raw){
  const query=stripAssistantWakeword(raw).trim().slice(0,350);
  if(!query){h.toast('Digite ou fale sua pergunta para o SÓCIO.');return;}
  lastQuery=query;
  pending=null;
  const result=resolveAssistantCommand(query,h.data(),new Date(),{lastTaskId});
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
   execute(session.transcript);
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
  stopAudio();
  voiceEngine.primeAudio();
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
   if(input)input.value=session.transcript;
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
  const shortcuts=[
   ['Qual minha prioridade hoje?','Prioridade'],
   ['Quais tarefas estão atrasadas?','Atrasadas'],
   ['Quais orçamentos estão pendentes?','SOUNDLINE']
  ];
  const markup='<section class="assistant-card" aria-label="SÓCIO Assistente">'+
   '<div class="assistant-head"><div class="assistant-emblem" aria-hidden="true">'+icon('mic',24)+'</div>'+
   '<div class="assistant-head-copy"><div class="assistant-eyebrow">SÓCIO ASSISTENTE</div>'+
   '<h2>Fale com o SÓCIO</h2><p>Suas tarefas, sua agenda e seus negócios em uma só voz.</p></div></div>'+
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
   '<details class="assistant-voice-settings"><summary>Voz do SÓCIO · <span id="assistant-voice-name">'+safe(voiceInfo.name)+'</span></summary>'+
   '<div class="assistant-voice-config"><label for="assistant-voice-select">Voz brasileira disponível no aparelho</label>'+
   '<select id="assistant-voice-select" aria-label="Selecionar voz">'+voiceOptions()+'</select>'+
   '<button type="button" class="btn-outline" data-action="assistant-test-voice">Testar voz</button></div>'+
   '<p>A voz do sistema é gratuita. A naturalidade depende das vozes instaladas no iPhone.</p>'+
   '<div class="assistant-neural-config"><strong>Voz masculina Faber · teste experimental</strong>'+
   '<p>Modelo neural brasileiro, gratuito, com geração no próprio aparelho. Primeiro download de aproximadamente 65 MB, além dos componentes de execução. Pode demorar ou falhar no iPhone. Antes de adotar em uso comercial, precisamos conferir a licença do modelo.</p>'+
   '<div class="assistant-neural-actions">'+
   (!neuralEngine.enabled()?'<button type="button" class="btn-outline" data-action="assistant-neural-enable">Baixar e experimentar Faber</button>':
    '<button type="button" class="btn-outline" data-action="assistant-neural-test">Testar voz masculina</button>'+
    '<button type="button" class="btn-outline" data-action="assistant-neural-disable">Voltar à voz do iPhone</button>')+'</div>'+
   '<div class="assistant-neural-actions">'+
    '<button type="button" class="btn-outline" data-action="assistant-audio-check">Testar saída de áudio</button></div>'+
   '<p class="assistant-neural-status" id="assistant-neural-status" role="status" aria-live="polite">'+safe(neuralStatus)+'</p>'+
   '<audio id="assistant-neural-preview" controls preload="none" hidden aria-label="Reproduzir áudio Faber gerado"></audio>'+
   '<p class="assistant-neural-help">Se aparecer o reprodutor acima, a Faber gerou o áudio; use o botão Play para testar o som. Se aparecer FABER-SYNTH, a geração falhou antes da reprodução.</p>'+
   '</div></details>'+
   (lastResponse?'<div class="assistant-response" aria-live="polite"><div class="assistant-response-head"><strong>'+icon('spark',15)+' SÓCIO RESPONDE</strong>'+
     '<button type="button" class="btn-primary assistant-replay" data-action="assistant-repeat" aria-label="Ouvir resposta">'+icon('volume-2',14)+' Ouvir resposta</button></div>'+
    '<p class="assistant-audio-status" id="assistant-audio-status" aria-live="polite">'+safe(audioStatus)+'</p>'+
    '<p>'+safe(lastResponse.message)+'</p>'+
    (lastResponse.detail?'<p class="assistant-response-extra">'+safe(lastResponse.detail)+'</p>':'')+
    (pending?'<div class="assistant-confirm"><button class="btn-primary" type="button" data-action="assistant-confirm-task">Confirmar conclusão</button>'+
      '<button class="btn-outline" type="button" data-action="assistant-cancel-task">Cancelar</button></div>':'')+
    (lastResponse.related&&!pending?'<button type="button" class="assistant-related-link" data-action="assistant-open-related" data-target="'+safe(lastResponse.related)+'">Abrir '+safe(lastResponse.related==='soundline'?'SOUNDLINE':lastResponse.related==='tarefas'?'Tarefas':'Agenda')+'</button>':'')+
    '</div>':'')+
   '</section>';
  return markup;
 }
 function action(target){
  const command=target?.dataset?.action||'';
  if(command==='assistant-start-voice'){startListening();return true;}
  if(command==='assistant-stop-voice'){stopListening();return true;}
  if(command==='assistant-example'){voiceEngine.primeAudio();execute(target.dataset.query||'');return true;}
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
    syncVoicePicker();
    if(ok){h.toast('Voz Faber preparada. Toque em Testar voz masculina.');}
    else h.toast('Voz masculina não disponível no aparelho. A voz padrão permanece ativa.');
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
  event.preventDefault();
  voiceEngine.primeAudio();
  const input=event.target.querySelector('[name="query"]');
  if(activeRecognition)cancelListening();
  execute(input?.value||'');
  return true;
 }
 function change(event){
  if(event.target?.id!=='assistant-voice-select')return false;
  voiceEngine.selectVoice(event.target.value||'');
  if(neuralEngine.enabled())neuralEngine.disable();
  syncVoicePicker();
  return true;
 }
 return {render,action,submit,change,cancelListening,stopAudio};
}
