import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantSpeech,rankPortugueseVoices} from '../js/assistant-speech.js';
import {createAssistantController} from '../js/assistant-ui.js';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(){
 const state={
  businesses:[{id:'b-soundline',name:'SOUNDLINE',focus:5,status:'ativo'}],
  tasks:[{id:'t1',title:'Publicar o primeiro anúncio',businessId:'b-soundline',status:'open',impact:5,urgency:5,effort:2,minutes:30,due:''}],
  appointments:[],soundline:{quotes:[]},events:[],skipped:{date:'',taskIds:[]}
 };
 let ref=null;
 const c=createAssistantController({
  data:()=>state,page:()=> 'inicio',refresh:()=>{},navigate:()=>{},toast:()=>{},
  escape:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  icon:()=>'<svg></svg>',
  prepareTask:()=>{},prepareAppointment:()=>{},completeTask:()=>{}
 });
 return {c,state};
}
test('preferir voz local pt-BR aprimorada a compacta',()=>{
 const ranked=rankPortugueseVoices([
  {voiceURI:'compact',lang:'pt-BR',name:'Luciana compact',localService:true},
  {voiceURI:'premium',lang:'pt-BR',name:'Francisca enhanced',localService:true},
  {voiceURI:'pt',lang:'pt-PT',name:'Fala portuguesa',localService:true},
  {voiceURI:'en',lang:'en-US',name:'Voice'}
 ]);
 assert.equal(ranked[0].voiceURI,'premium');
 assert.equal(ranked.some(v=>v.voiceURI==='en'),false);
});
test('fala usa pt-BR e escolha de voz nativa, dispara eventos de status',()=>{
 const previousWindow=globalThis.window,previousStorage=globalThis.localStorage;
 const sent=[],events=[];
 const voices=[{voiceURI:'natural',lang:'pt-BR',name:'Luciana Premium',localService:true}];
 const speechSynthesis={
  getVoices:()=>voices,
  cancel:()=>{},
  speak:item=>{sent.push(item);item.onstart?.();}
 };
 globalThis.localStorage={getItem:()=>'',setItem:()=>{},removeItem:()=>{}};
 globalThis.window={speechSynthesis,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}};
 try{
  const engine=createAssistantSpeech(message=>events.push(message));
  assert.equal(engine.voiceInfo().name,'Luciana Premium');
  assert.equal(engine.speak('Bom dia; você tem uma tarefa'),true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].lang,'pt-BR');
  assert.equal(sent[0].voice.voiceURI,'natural');
  assert.match(sent[0].text,/Bom dia\. você tem/);
  assert.ok(events.some(s=>/Reproduzindo/.test(s)));
  sent[0].onend?.();
  assert.ok(events.some(s=>/Resposta finalizada/.test(s)));
  engine.stop();
 }finally{globalThis.window=previousWindow;globalThis.localStorage=previousStorage;}
});
test('sem síntese nativa conserva resposta escrita e avisa de áudio indisponível',()=>{
 const old=globalThis.window,events=[];
 globalThis.window={};
 try{
  const voice=createAssistantSpeech(s=>events.push(s));
  assert.equal(voice.speak('Teste'),false);
  assert.match(events.at(-1),/indisponível/);
 }finally{globalThis.window=old;}
});
test('fim da fala do reconhecimento dispara parada automática sem tocar no botão',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let instance,stops=0;
 class Recognition {
  constructor(){instance=this;}
  start(){}stop(){stops++;this.onend?.();}abort(){}
 }
 const elements={
  'assistant-command-text':{value:''},
  'assistant-listening-status':{textContent:''},
  'assistant-mic-button':{dataset:{},innerHTML:''}
 };
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.document={getElementById:id=>elements[id]||null};
 try{
  const {c,state}=fixture();
  c.action({dataset:{action:'assistant-start-voice'}});
  instance.onresult({results:[Object.assign([{transcript:'Qual a minha prioridade hoje?'}],{isFinal:true})]});
  await new Promise(resolve=>setTimeout(resolve,620));
  assert.equal(stops,1);
  assert.equal(state.tasks[0].status,'open');
  assert.match(c.render(),/Publicar o primeiro anúncio/);
  c.cancelListening();
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
test('evento speechend encerra escuta sem espera do usuário',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let instance,stops=0;
 class Recognition {constructor(){instance=this;}start(){}stop(){stops++;this.onend?.();}abort(){}}
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.document={getElementById:()=>null};
 try{
  const {c}=fixture();
  c.action({dataset:{action:'assistant-start-voice'}});
  instance.onresult({results:[[{transcript:'Quais tarefas estão atrasadas?'}]]});
  instance.onspeechend();
  await new Promise(resolve=>setTimeout(resolve,610));
  assert.equal(stops,1);
  assert.match(c.render(),/Não encontrei tarefas/);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
test('layout e arquivos do iPhone mantêm os três microfones especializados e nova voz',()=>{
 const app=read('js/app.js'),css=read('css/assistant-v00324.css'),sw=read('service-worker.js');
 const start=app.indexOf('function dashboard()');
 assert.ok(app.indexOf('class="home-hero"',start)<app.indexOf('\${assistantUI.render()}',start));
 assert.ok(app.indexOf('\${assistantUI.render()}',start)<app.indexOf('class="metrics home-metrics"',start));
 assert.match(app,/assistantUI\.change\(event\)/);
 for(const action of ['task-voice-start','voice-start','sl-start-voice'])assert.match(app,new RegExp(action));
 assert.match(sw,/assistant-speech\.js/);
 assert.match(sw,/assistant-v00324\.css/);
 assert.match(css,/font-size:16px!important/);
 assert.doesNotMatch(css,/user-scalable|maximum-scale|touch-action|position:fixed/);
});
