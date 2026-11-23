import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeVocabulary,addVocabulary,removeVocabulary,applyVocabulary,proposeVoiceCorrection} from '../js/assistant-vocabulary.js';
import {validateData} from '../js/store.js';
import {seedData} from '../js/logic.js';
import {createAssistantController} from '../js/assistant-ui.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pair={heard:'Hazor',correct:'REIZZOR'};
test('vocabulário local substitui palavra inteira em frase longa, sem modificar outras',()=>{
 const source='Que horas posso organizar o VS da Hazor antes do ensaio?';
 assert.equal(applyVocabulary(source,[pair]),'Que horas posso organizar o VS da REIZZOR antes do ensaio?');
 assert.equal(applyVocabulary('hazor, HAZOR! hazorz e minha Hazor.',[pair]),'REIZZOR, REIZZOR! hazorz e minha REIZZOR.');
 assert.equal(applyVocabulary('Sou Hazor?',[pair]),'Sou REIZZOR?');
});
test('expressão de mais de uma palavra funciona mesmo com mudança de caixa e acento',()=>{
 const saved=[{heard:'Vê esse',correct:'VS'},{heard:'Sound Line',correct:'SOUNDLINE'}];
 assert.equal(applyVocabulary('Preciso revisar ve esse da sound line amanhã.',saved),'Preciso revisar VS da SOUNDLINE amanhã.');
 assert.equal(applyVocabulary('revisar ve, esse',saved),'revisar ve, esse');
 assert.equal(applyVocabulary('meu Sound Line',saved),'meu SOUNDLINE');
});
test('substituições não ocorrem em cascata nem vazam para outras palavras',()=>{
 const entries=[{heard:'Razor',correct:'REIZZOR'},{heard:'REIZZOR',correct:'SOUNDLINE'}];
 assert.equal(applyVocabulary('Razor',entries),'REIZZOR');
 assert.equal(applyVocabulary('Razorismo',entries),'Razorismo');
});
test('aprender e remover com validação de entradas duplicadas e limites',()=>{
 const first=addVocabulary([],'HAZOR','REIZZOR');
 assert.equal(first.ok,true);
 assert.deepEqual(first.entries,[{heard:'HAZOR',correct:'REIZZOR'}]);
 assert.equal(addVocabulary(first.entries,'hazor','REIZZOR').ok,false);
 assert.equal(addVocabulary(first.entries,'HAZOR','SOUNDLINE').ok,false);
 assert.equal(addVocabulary([], 'hoje','hoje').ok,false);
 assert.equal(addVocabulary([], 'a '.repeat(6),'SOUNDLINE').ok,false);
 assert.deepEqual(removeVocabulary(first.entries,'hazor'),[]);
});
test('backups atuais preservam vocabulário e antigos migram sem perdê-los',()=>{
 const original=seedData();
 original.vocabulary=[pair,{heard:'Sound Line',correct:'SOUNDLINE'}];
 const clean=validateData(JSON.parse(JSON.stringify(original)));
 assert.deepEqual(clean.vocabulary,original.vocabulary);
 assert.deepEqual(validateData(clean).vocabulary,original.vocabulary);
 delete original.vocabulary;
 assert.deepEqual(validateData(original).vocabulary,[]);
});
test('importação descarta aliases inválidos e não duplica regras',()=>{
 const source=seedData();
 source.vocabulary=[{heard:'HAZOR',correct:'REIZZOR'},{heard:'hazor',correct:'Outro'},null,{heard:'<img>',correct:'X'},{heard:'x'.repeat(99),correct:'OK'}];
 assert.deepEqual(validateData(source).vocabulary,[pair].map(v=>({heard:'HAZOR',correct:v.correct})));
});
test('correção manual de uma palavra com contexto suficiente gera proposta',()=>{
 const old='que horas posso organizar o VS da HAZOR antes do ensaio';
 const edited='que horas posso organizar o VS da REIZZOR antes do ensaio';
 assert.deepEqual(proposeVoiceCorrection(old,edited),{heard:'HAZOR',correct:'REIZZOR'});
 assert.deepEqual(proposeVoiceCorrection('Preciso fazer vê esse da banda amanhã','Preciso fazer VS da banda amanhã'),{heard:'vê esse',correct:'VS'});
});
test('edição de comando diferente e números não criam regras',()=>{
 assert.equal(proposeVoiceCorrection('Qual minha prioridade hoje?','Quais tarefas estão atrasadas?'),null);
 assert.equal(proposeVoiceCorrection('Marcar reunião amanhã às 14 horas','Marcar reunião amanhã às 15 horas'),null);
 assert.equal(proposeVoiceCorrection('Fazer tarefa hoje','Fazer tarefa amanhã'),null);
 assert.equal(proposeVoiceCorrection('Sócio, que horas da reunião?','Sócio, que horas da reunião?'),null);
});
test('fluxo real do assistente: só aprende depois de correção e confirmação, e corrige próximo ditado',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let speech;
 class Recognition{
  constructor(){speech=this;}
  start(){}
  stop(){this.onend?.();}
  abort(){}
 }
 const input={value:''},status={textContent:''},mic={dataset:{},innerHTML:''};
 const elements=new Map([['assistant-command-text',input],['assistant-listening-status',status],['assistant-mic-button',mic]]);
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.document={getElementById:id=>elements.get(id)||null};
 const data=seedData();data.vocabulary=[];
 const events=[];
 const controller=createAssistantController({
  data:()=>data,page:()=> 'inicio',
  icon:()=>'<svg></svg>',
  escape:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  refresh:()=>{},navigate:()=>{},toast:m=>events.push(m),prepareTask:()=>{},prepareAppointment:()=>{},completeTask:()=>{},
  learnVocabulary:(heard,correct)=>{
   const result=addVocabulary(data.vocabulary,heard,correct);
   if(!result.ok)return false;
   data.vocabulary=result.entries;return true;
  }
 });
 try{
  controller.action({dataset:{action:'assistant-start-voice'}});
  speech.onresult({results:[[{transcript:'Que horas posso organizar o VS da HAZOR antes do ensaio?'}]]});
  controller.action({dataset:{action:'assistant-stop-voice'}});
  assert.match(controller.render(),/SÓCIO RESPONDE/);
  assert.equal(data.vocabulary.length,0);
  input.value='Que horas posso organizar o VS da REIZZOR antes do ensaio?';
  controller.submit({target:{id:'assistant-command-form',querySelector:()=>input},preventDefault(){}});
  assert.match(controller.render(),/Aprender esta correção/);
  assert.equal(data.vocabulary.length,0);
  controller.action({dataset:{action:'assistant-learn-ignore'}});
  assert.equal(data.vocabulary.length,0);
  // A última transcrição precisa ser obtida novamente após ignorar.
  controller.action({dataset:{action:'assistant-start-voice'}});
  speech.onresult({results:[[{transcript:'Que horas posso organizar o VS da Hazor?'}]]});
  controller.action({dataset:{action:'assistant-stop-voice'}});
  input.value='Que horas posso organizar o VS da REIZZOR?';
  controller.submit({target:{id:'assistant-command-form',querySelector:()=>input},preventDefault(){}});
  assert.match(controller.render(),/Sim, aprender/);
  controller.action({dataset:{action:'assistant-learn-confirm'}});
  assert.equal(data.vocabulary.length,1);
  assert.deepEqual(data.vocabulary[0],{heard:'Hazor',correct:'REIZZOR'});
  controller.action({dataset:{action:'assistant-start-voice'}});
  speech.onresult({results:[[{transcript:'Que horas posso organizar o VS da HAZOR antes do ensaio?'}]]});
  assert.match(input.value,/REIZZOR/);
  controller.action({dataset:{action:'assistant-stop-voice'}});
  assert.doesNotMatch(controller.render(),/Aprender esta correção/);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
test('Ajustes tem inclusão, listagem, exclusão; comandos especiais consultam a mesma base',()=>{
 const app=read('js/app.js'),ui=read('js/assistant-ui.js'),soundline=read('js/soundline-ui.js'),store=read('js/store.js');
 for(const name of ['vocab-add-form','vocab-heard','vocab-correct','vocab-delete','Vocabulário do SÓCIO'])assert.ok(app.includes(name));
 assert.match(app,/session.transcript=applyVocabulary/);
 assert.match(soundline,/voiceText=applyVocabulary/);
 assert.match(ui,/pendingLearning/);
 assert.match(ui,/learnVocabulary/);
 assert.match(store,/vocabulary:normalizeVocabulary\(value.vocabulary\)/);
 assert.match(read('service-worker.js'),/self.addEventListener\('push'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
});
