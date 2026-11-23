/** MEU SÓCIO V003.23 — comando geral na tela Início.
 * Sem envio a provedores de IA. Voz nativa quando disponível; texto é o fallback. */
import {resolveAssistantCommand,stripAssistantWakeword} from './assistant-core.js';

export function createAssistantController(h){
 let activeRecognition=null, lastResponse=null, lastQuery='',lastTaskId='', pending=null;
 let lastSpeechError='';
 const safe=h.escape;
 const icon=h.icon;

 function getSpeech(){
  return typeof window!=='undefined'&&(window.SpeechRecognition||window.webkitSpeechRecognition);
 }
 function isHome(){return h.page()==='inicio';}
 function stopAudio(){
  try{if(typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel();}catch{}
 }
 function speak(message){
  if(typeof window==='undefined'||!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=='function')return false;
  try{
   stopAudio();
   const msg=String(message||'').trim().slice(0,650);
   if(!msg)return false;
   const utterance=new window.SpeechSynthesisUtterance(msg);
   utterance.lang='pt-BR';
   utterance.rate=0.98;utterance.pitch=1;utterance.volume=1;
   const voices=window.speechSynthesis.getVoices?.()||[];
   const voice=voices.find(v=>v.lang?.toLowerCase()==='pt-br')||voices.find(v=>v.lang?.toLowerCase().startsWith('pt'));
   if(voice)utterance.voice=voice;
   window.speechSynthesis.speak(utterance);
   return true;
  }catch(error){console.warn('SÓCIO voz:',error);return false;}
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
  if(old){old.cancelled=true;try{old.recognition.abort();}catch{}}
  if(stopPlayback)stopAudio();
 }
 function finishListening(session){
  if(activeRecognition!==session)return;
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
  const Speech=getSpeech();
  if(!Speech){h.toast('Este navegador não oferece reconhecimento de voz para o SÓCIO. Digite a pergunta ou use o microfone do teclado.');return;}
  let recognition;
  try{recognition=new Speech();}catch{h.toast('Não foi possível preparar o microfone. Use o teclado.');return;}
  const session={recognition,transcript:'',cancelled:false,error:''};
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
  };
  recognition.onerror=event=>{
   if(activeRecognition!==session)return;
   session.error=event?.error==='not-allowed'||event?.error==='service-not-allowed'?
    'Microfone não autorizado. Você ainda pode digitar o comando.':
    'A transcrição não ficou disponível. Confira a conexão e tente novamente.';
   // Não executar fala parcial em caso de erro de acesso.
   if(event?.error==='not-allowed'||event?.error==='service-not-allowed')session.transcript='';
  };
  recognition.onend=()=>finishListening(session);
  try{
   recognition.start();
   const button=document.getElementById('assistant-mic-button');
   if(button){button.dataset.action='assistant-stop-voice';button.innerHTML=icon('stop',16)+' Parar e revisar';}
   updateListening('Ouvindo… toque em Parar e revisar ao terminar.');
  }catch(error){
   activeRecognition=null;
   h.toast('Não foi possível ativar o reconhecimento. Use o campo de texto.');
  }
 }
 function stopListening(){
  const session=activeRecognition;if(!session)return;
  updateListening('Preparando sua resposta...');
  try{session.recognition.stop();}catch{finishListening(session);}
 }
 function render(){
  const listening=Boolean(activeRecognition);
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
    icon(listening?'stop':'mic',17)+(listening?' Parar e revisar':' Falar')+'</button>'+
   '<button type="submit" class="btn-primary assistant-send">Consultar</button></div></form>'+
   '<div class="assistant-suggestions" aria-label="Sugestões rápidas">'+shortcuts.map(([q,label])=>
    '<button type="button" class="assistant-suggestion" data-action="assistant-example" data-query="'+safe(q)+'">'+safe(label)+'</button>').join('')+'</div>'+
   '<p class="assistant-status" id="assistant-listening-status" role="status" aria-live="polite">'+
    (listening?'Ouvindo… toque em Parar e revisar.':'Toque em Falar ou digite. Os comandos são processados pelas regras do aplicativo.')+'</p>'+
   (lastResponse?'<div class="assistant-response" aria-live="polite"><div class="assistant-response-head"><strong>'+icon('spark',15)+' SÓCIO RESPONDE</strong>'+
     '<button type="button" class="btn-quiet assistant-replay" data-action="assistant-repeat" aria-label="Ouvir resposta novamente">'+icon('mic',14)+' Ouvir novamente</button></div>'+
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
  if(command==='assistant-example'){execute(target.dataset.query||'');return true;}
  if(command==='assistant-repeat'){if(lastResponse&&!speak(lastResponse.message))h.toast('Leitura de voz indisponível. A resposta está escrita na tela.');return true;}
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
  const input=event.target.querySelector('[name="query"]');
  if(activeRecognition)cancelListening();
  execute(input?.value||'');
  return true;
 }
 return {render,action,submit,cancelListening,stopAudio};
}
