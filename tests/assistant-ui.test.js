import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssistantController} from '../js/assistant-ui.js';
import {dateKey} from '../js/logic.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const now=new Date(),day=dateKey(now);
function harness(){
 const data={
  businesses:[{id:'a',name:'SOUNDLINE',status:'ativo',focus:5}],
  tasks:[{id:'t1',title:'Publicar primeiro anúncio',businessId:'a',status:'open',impact:5,urgency:5,effort:2,minutes:20,due:day}],
  appointments:[],soundline:{quotes:[]},events:[],skipped:{date:day,taskIds:[]}
 };
 const calls={refresh:0,complete:[],tasks:[],appointments:[],nav:[],toast:[]};
 const c=createAssistantController({
  data:()=>data,page:()=> 'inicio',
  escape:input=>String(input??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  icon:()=>'<svg></svg>',
  refresh:()=>{calls.refresh++;},
  navigate:target=>calls.nav.push(target),
  toast:text=>calls.toast.push(text),
  prepareTask:t=>calls.tasks.push(t),
  prepareAppointment:prefill=>calls.appointments.push(prefill),
  completeTask:id=>{calls.complete.push(id);data.tasks.find(t=>t.id===id).status='done';}
 });
 return {c,calls,data};
}
test('banner da saudação aparece antes do assistente e indicadores',()=>{
 const app=read('js/app.js'),top=app.indexOf('function dashboard()');
 assert.ok(app.indexOf('\${assistantUI.render()}',top)>top);
 assert.ok(app.indexOf('class="home-hero"',top)<app.indexOf('\${assistantUI.render()}',top));
 assert.ok(app.indexOf('\${assistantUI.render()}',top)<app.indexOf('class="metrics home-metrics"',top));
 assert.match(app,/createAssistantController/);
 assert.match(app,/assistantUI\.submit\(event\)/);
 assert.match(app,/assistantUI\.action\(target\)/);
 assert.match(app,/assistantUI\.cancelListening/);
});
test('cartão oferece microfone, texto, acesso rápido e replay',()=>{
 const {c}=harness(),html=c.render();
 assert.match(html,/id="assistant-command-form"/);
 assert.match(html,/id="assistant-command-text"/);
 assert.match(html,/assistant-start-voice/);
 assert.match(html,/Qual minha prioridade hoje/);
 assert.match(html,/SOUNDLINE/);
 assert.match(html,/Fale com o SÓCIO/);
 assert.match(html,/assistant-voice-select/);
 assert.match(html,/assistant-test-voice/);
});
test('resposta aparece escrita depois de consulta sem alterar tarefas',()=>{
 const {c,data}=harness(),before=JSON.stringify(data);
 c.action({dataset:{action:'assistant-example',query:'Qual minha prioridade hoje?'}});
 assert.match(c.render(),/Publicar primeiro anúncio/);
 assert.equal(JSON.stringify(data),before);
 assert.match(c.render(),/assistant-repeat/);
});
test('criar tarefa abre revisão, sem salvar',()=>{
 const {c,calls,data}=harness();
 c.action({dataset:{action:'assistant-example',query:'crie uma tarefa para ligar para Carlos amanhã'}});
 assert.equal(calls.tasks.length,1);
 assert.match(calls.tasks[0],/crie uma tarefa/);
 assert.equal(data.tasks.length,1);
});
test('concluir tarefa exige confirmação explícita, sem mutação antecipada',()=>{
 const {c,calls,data}=harness();
 c.action({dataset:{action:'assistant-example',query:'qual minha prioridade agora'}});
 c.action({dataset:{action:'assistant-example',query:'Marcar essa tarefa como concluída'}});
 assert.match(c.render(),/Confirmar conclusão/);
 assert.equal(data.tasks[0].status,'open');
 c.action({dataset:{action:'assistant-cancel-task'}});
 assert.equal(data.tasks[0].status,'open');
 c.action({dataset:{action:'assistant-example',query:'Marcar essa tarefa como concluída'}});
 c.action({dataset:{action:'assistant-confirm-task'}});
 assert.equal(data.tasks[0].status,'done');
 assert.deepEqual(calls.complete,['t1']);
});
test('reconhecimento faz leitura de transcrição ao parar, sem IA',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let instance;
 class Recognition {
  constructor(){instance=this;}
  start(){}stop(){this.onend?.();}abort(){}
 }
 const input={value:''},status={textContent:''},mic={dataset:{},innerHTML:''};
 const elements=new Map([['assistant-command-text',input],['assistant-listening-status',status],['assistant-mic-button',mic]]);
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.document={getElementById:id=>elements.get(id)||null};
 try{
  const {c}=harness();
  assert.equal(c.action({dataset:{action:'assistant-start-voice'}}),true);
  assert.equal(mic.dataset.action,'assistant-stop-voice');
  instance.onresult({results:[[{transcript:'Qual minha prioridade hoje?'}]]});
  c.action({dataset:{action:'assistant-stop-voice'}});
  assert.match(c.render(),/Publicar primeiro anúncio/);
  assert.equal(input.value,'Qual minha prioridade hoje?');
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
test('transcrição não autorizada não dispara ação com áudio parcial',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let instance;
 class Recognition {constructor(){instance=this;}start(){}stop(){this.onend?.();}abort(){}}
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.document={getElementById:()=>null};
 try{
  const {c,data,calls}=harness();
  c.action({dataset:{action:'assistant-start-voice'}});
  instance.onresult({results:[[{transcript:'marcar essa tarefa como concluída'}]]});
  instance.onerror({error:'not-allowed'});instance.onend();
  assert.equal(data.tasks[0].status,'open');assert.equal(calls.complete.length,0);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
test('responsividade preserva zoom do iPhone e Web Push anterior',()=>{
 const css=read('css/assistant-v00323.css'),html=read('index.html'),sw=read('service-worker.js');
 assert.match(css,/@media\(max-width:740px\)/);assert.match(css,/min-width:0/);
 assert.match(css,/font-size:16px!important/);
 assert.doesNotMatch(css,/maximum-scale|user-scalable|position:fixed|touch-action/);
 assert.match(html,/assistant-v00323.css/);
 assert.match(sw,/assistant-core\.js/);assert.match(sw,/assistant-ui\.js/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
});
