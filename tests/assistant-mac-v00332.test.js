import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssistantController} from '../js/assistant-ui.js';
import {createAssistantNeural,PIPER_VOICE_ID} from '../js/assistant-neural.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const KEY='socio.assistant.neural.v1';
function fixture({faber=false,agent='Macintosh; Intel Mac OS X 10_15_7'}={}){
 const original={navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),localStorage:globalThis.localStorage,window:globalThis.window};
 const kv=new Map(faber?[[KEY,'enabled']]:[]);
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:agent}});
 globalThis.localStorage={getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,v),removeItem:k=>kv.delete(k)};
 delete globalThis.window;
 const calls={refresh:0,answers:[],toasts:[]};
 const c=createAssistantController({data:()=>({tasks:[],businesses:[],appointments:[],soundline:{quotes:[]},vocabulary:[]}),
  page:()=> 'inicio',icon:()=>'',escape:val=>String(val||''),
  refresh:()=>calls.refresh++,toast:v=>calls.toasts.push(v),navigate:()=>{},completeTask:()=>{},
  prepareTask:()=>{},prepareAppointment:()=>{}});
 return {c,calls,kv,restore(){
  if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);
  else delete globalThis.navigator;
  globalThis.localStorage=original.localStorage;globalThis.window=original.window;
 }};
}
test('Mac novo avisa por que a Faber do iPhone não é compartilhada e oferece ativação',()=>{
 const f=fixture();
 try{
  const html=f.c.render();
  assert.match(html,/Ativar Faber neste Mac/);
  assert.match(html,/Faber do iPhone não é transferida automaticamente/);
  assert.match(html,/Voz do dispositivo/);
  assert.equal(f.kv.get(KEY),undefined,'não é permitido consentimento ou download automáticos');
 }finally{f.restore();}
});
test('Mac onde Faber já foi ativada preserva voz masculina sem convite duplicado',()=>{
 const f=fixture({faber:true});
 try{
  const html=f.c.render();
  assert.match(html,/Faber ativa neste Mac/);
  assert.match(html,/Faber · masculina/);
  assert.doesNotMatch(html,/Ativar Faber neste Mac/);
 }finally{f.restore();}
});
test('iPhone não recebe aviso específico do Mac; voz masculina continua opt-in',()=>{
 const f=fixture({agent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
 try{
  assert.doesNotMatch(f.c.render(),/Ativar Faber neste Mac/);
  assert.match(f.c.render(),/Usar voz masculina Faber/);
 }finally{f.restore();}
});
test('o motor Faber aceita seleção local no Mac sem API paga e sem autoativar',async()=>{
 const f=fixture();let downloaded=0,played=0;
 const engine=createAssistantNeural({loadLibrary:async()=>({
  stored:async()=>[],download:async()=>{downloaded++},
  predict:async()=>new Blob(['WAV'])
 }),playAudio:async()=>{played++}});
 try{
  assert.equal(engine.enabled(),false);
  assert.equal(downloaded,0);
  assert.equal(await engine.prepare(),true);
  assert.equal(f.kv.get(KEY),'enabled');
  assert.equal(downloaded,1);
  assert.equal((await engine.generate('Bom dia')).ok,true);
  assert.equal(played,1);
 }finally{engine.disable();f.restore();}
});
test('consulta por voz apaga somente a pergunta após 15s, mantendo a resposta no Mac',()=>{
 const orig={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 let recognition;const timers=new Map();let current=0;
 class Speech{
  constructor(){recognition=this;}start(){}stop(){this.onend?.();}abort(){}
 }
 const input={id:'assistant-command-text',value:''},status={textContent:''},mic={dataset:{},innerHTML:''};
 const elements=new Map([['assistant-command-text',input],['assistant-listening-status',status],['assistant-mic-button',mic]]);
 globalThis.window={SpeechRecognition:Speech};
 globalThis.document={getElementById:id=>elements.get(id)||null,activeElement:null};
 globalThis.setTimeout=(fn,ms)=>{const id=++current;timers.set(id,{fn,ms,cleared:false});return id;};
 globalThis.clearTimeout=id=>{if(timers.has(id))timers.get(id).cleared=true;};
 const f=fixture();
 // A factory de teste limpa window; restauramos o recognizer ao criar a sessão.
 globalThis.window={SpeechRecognition:Speech};
 try{
  f.c.action({dataset:{action:'assistant-start-voice'}});
  recognition.onresult({results:[[{transcript:'Qual minha prioridade hoje?'}]]});
  f.c.action({dataset:{action:'assistant-stop-voice'}});
  assert.match(f.c.render(),/SÓCIO RESPONDE/);
  assert.match(input.value,/Qual minha prioridade hoje/);
  const delayed=[...timers.values()].filter(t=>t.ms===15000&&!t.cleared);
  assert.equal(delayed.length,1);
  delayed[0].fn();
  assert.equal(input.value,'');
  assert.match(f.c.render(),/SÓCIO RESPONDE/);
  assert.match(f.c.render(),/value=""/);
 }finally{f.restore();globalThis.window=orig.window;globalThis.document=orig.document;globalThis.setTimeout=orig.setTimeout;globalThis.clearTimeout=orig.clearTimeout;}
});
test('correção digitada não some quando usuário está editando nem se o campo recebe foco',()=>{
 const orig={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 let recognition;const timers=[];let timeId=0;
 class Speech{constructor(){recognition=this;}start(){}stop(){this.onend?.();}abort(){}}
 const input={id:'assistant-command-text',value:''},status={textContent:''},mic={dataset:{},innerHTML:''};
 const elements=new Map([['assistant-command-text',input],['assistant-listening-status',status],['assistant-mic-button',mic]]);
 globalThis.window={SpeechRecognition:Speech};
 globalThis.document={getElementById:id=>elements.get(id)||null,activeElement:null};
 globalThis.setTimeout=(fn,ms)=>{const timer={id:++timeId,fn,ms,cancelled:false};timers.push(timer);return timer.id;};
 globalThis.clearTimeout=id=>{const t=timers.find(t=>t.id===id);if(t)t.cancelled=true;};
 const f=fixture();globalThis.window={SpeechRecognition:Speech};
 try{
  f.c.action({dataset:{action:'assistant-start-voice'}});
  recognition.onresult({results:[[{transcript:'Que horas posso organizar o VS da HAZOR antes do ensaio?'}]]});
  f.c.action({dataset:{action:'assistant-stop-voice'}});
  assert.ok(timers.some(t=>t.ms===15000&&!t.cancelled));
  input.value='Que horas posso organizar o VS da REIZZOR antes do ensaio?';
  f.c.onCommandInput({target:input});
  assert.ok(timers.filter(t=>t.ms===15000).every(t=>t.cancelled));
  f.c.onCommandBlur({target:input});
  assert.equal(timers.filter(t=>t.ms===15000&&!t.cancelled).length,0);
  assert.match(input.value,/REIZZOR/);
  f.c.submit({target:{id:'assistant-command-form',querySelector:()=>input},preventDefault(){}});
  assert.match(f.c.render(),/Aprender esta correção/);
  const pending=timers.filter(t=>t.ms===15000&&!t.cancelled);
  assert.equal(pending.length,0,'o usuário tem tempo para confirmar a correção');
  f.c.action({dataset:{action:'assistant-learn-ignore'}});
  assert.ok(timers.some(t=>t.ms===15000&&!t.cancelled));
 }finally{f.restore();globalThis.window=orig.window;globalThis.document=orig.document;globalThis.setTimeout=orig.setTimeout;globalThis.clearTimeout=orig.clearTimeout;}
});
test('integração Mac verifica CSS, updates, microfone, Faber, vocabulário, agenda e Push',()=>{
 const app=source('js/app.js'),ui=source('js/assistant-ui.js'),worker=source('service-worker.js'),html=source('index.html');
 assert.match(app,/assistantUI\.onCommandInput/);
 assert.match(app,/assistantUI\.onCommandBlur/);
 assert.match(ui,/INPUT_IDLE_MS=15000/);
 assert.match(ui,/assistant-mac-voice/);
 assert.match(ui,/assistant-neural-enable/);
 assert.match(ui,/proposeVoiceCorrection/);
 assert.match(ui,/assistant-use-task-slot/);
 assert.match(ui,/speechBusy/);
 assert.match(html,/assistant-v00332\.css/);
 assert.match(worker,/assistant-neural\.js/);
 assert.match(worker,/assistant-vocabulary\.js/);
 assert.match(worker,/self\.addEventListener\('push'/);
 assert.match(worker,/self\.addEventListener\('notificationclick'/);
 assert.match(source('js/store.js'),/socio\.v001\.data/);
});
