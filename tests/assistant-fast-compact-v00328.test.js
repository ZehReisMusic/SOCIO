import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssistantNeural,PIPER_VOICE_ID} from '../js/assistant-neural.js';
import {createAssistantController} from '../js/assistant-ui.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const KEY='socio.assistant.neural.v1';

function withStorage(enabled=true){
 const old=globalThis.localStorage,map=new Map();
 if(enabled)map.set(KEY,'enabled');
 globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 return ()=>{globalThis.localStorage=old;};
}
test('pré-aquecer Faber inicializa sessão ONNX uma só vez após consentimento',async()=>{
 const reset=withStorage();
 let warms=0,imports=0,stored=0,played=0;
 const e=createAssistantNeural({loadLibrary:async()=>{
  imports++;
  return {
   stored:async()=>{stored++;return [PIPER_VOICE_ID];},
   download:async()=>{},
   TtsSession:{create:async({voiceId})=>{assert.equal(voiceId,PIPER_VOICE_ID);warms++;}},
   predict:async()=>new Blob(['wav'],{type:'audio/x-wav'})
  };
 },playAudio:async()=>{played++;}});
 try{
  assert.equal(await e.warmup(),true);
  assert.equal(await e.warmup(),true);
  assert.equal(warms,1);assert.equal(imports,1);assert.equal(stored,1);
  assert.equal(e.warmedUp(),true);
  assert.equal((await e.generate('Bom dia')).ok,true);assert.equal(played,1);
 }finally{e.disable();reset();}
});
test('Faber reutiliza WAV de respostas idênticas sem sintetizar novamente',async()=>{
 const reset=withStorage();
 let predictions=0,played=0;
 const engine={
  stored:async()=>[PIPER_VOICE_ID],download:async()=>{},
  predict:async({text})=>{predictions++;return new Blob([text],{type:'audio/x-wav'});}
 };
 const e=createAssistantNeural({loadLibrary:async()=>engine,playAudio:async()=>{played++;}});
 try{
  assert.equal((await e.generate('Minha prioridade hoje')).ok,true);
  assert.equal((await e.generate('Minha prioridade hoje')).ok,true);
  assert.equal(predictions,1);assert.equal(played,2);
  assert.equal((await e.generate('Outra tarefa')).ok,true);
  assert.equal(predictions,2);
  e.disable();
  assert.equal(e.generatedAudio(),null);
  assert.equal((await e.generate('Outra tarefa')).reason,'disabled');
 }finally{reset();}
});
test('limite de três áudios em memória evita crescimento ilimitado',async()=>{
 const reset=withStorage();
 let predictions=0;
 const e=createAssistantNeural({loadLibrary:async()=>({
  stored:async()=>[PIPER_VOICE_ID],download:async()=>{},
  predict:async({text})=>{predictions++;return new Blob([text]);}
 }),playAudio:async()=>{}});
 try{
  for(const message of ['A','B','C','D'])assert.equal((await e.generate(message)).ok,true);
  assert.equal(predictions,4);
  assert.equal((await e.generate('B')).ok,true);
  assert.equal(predictions,4);
  assert.equal((await e.generate('A')).ok,true);
  assert.equal(predictions,5);
 }finally{e.disable();reset();}
});
test('sem sessão especial exportada pelo Piper, fallback de warmup não desativa sintetizador',async()=>{
 const reset=withStorage();
 const e=createAssistantNeural({loadLibrary:async()=>({
  stored:async()=>[PIPER_VOICE_ID],download:async()=>{},
  predict:async()=>new Blob(['ok'])
 }),playAudio:async()=>{}});
 try{
  assert.equal(await e.warmup(),false);
  assert.equal(e.enabled(),true);
  assert.equal((await e.generate('Oi')).ok,true);
 }finally{e.disable();reset();}
});
function controller(){
 return createAssistantController({
  data:()=>({tasks:[],businesses:[],appointments:[],soundline:{quotes:[]}}),
  page:()=> 'inicio',escape:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  icon:()=>'<svg></svg>',refresh:()=>{},navigate:()=>{},toast:()=>{},
  prepareTask:()=>{},prepareAppointment:()=>{},completeTask:()=>{}
 });
}
test('com Faber ativa, controles simples aparecem antes de diagnóstico recolhido',()=>{
 const reset=withStorage();
 try{
  const html=controller().render();
  assert.match(html,/Faber · masculina/);
  assert.match(html,/Voz masculina brasileira/);
  assert.match(html,/Selecionada/);
  assert.match(html,/Ouvir exemplo/);
  assert.match(html,/Trocar voz/);
  assert.match(html,/<details class="assistant-voice-advanced" id="assistant-voice-tech">/);
  assert.match(html,/<summary>Diagnóstico de áudio<\/summary>/);
  assert.doesNotMatch(html,/<select id="assistant-voice-select"/);
  assert.doesNotMatch(html,/teste experimental/i);
 }finally{reset();}
});
test('com voz iPhone ativa, só mostrar escolha nativa, exemplo e opção Faber',()=>{
 const reset=withStorage(false);
 try{
  const html=controller().render();
  assert.match(html,/<select id="assistant-voice-select"/);
  assert.match(html,/Usar voz masculina Faber/);
  assert.match(html,/Ouvir exemplo/);
  assert.match(html,/<details class="assistant-voice-advanced"/);
  assert.doesNotMatch(html,/Voltar à voz do iPhone/);
 }finally{reset();}
});
test('assistente continua na Home após saudação, layout iPhone, Web Push e dados existentes preservados',()=>{
 const app=read('js/app.js'),css=read('css/assistant-v00328.css'),sw=read('service-worker.js');
 const start=app.indexOf('function dashboard()');
 assert.ok(app.indexOf('class="home-hero"',start)<app.indexOf('\${assistantUI.render()}',start));
 assert.ok(app.indexOf('\${assistantUI.render()}',start)<app.indexOf('class="metrics home-metrics"',start));
 assert.match(css,/@media\(max-width:740px\)/);assert.match(css,/min-width:0/);
 assert.doesNotMatch(css,/position:fixed|user-scalable|maximum-scale/);
 assert.match(sw,/socio-v00328-20261123/);
 assert.match(sw,/assistant-neural\.js/);
 assert.match(sw,/self\.addEventListener\('push'/);
});
