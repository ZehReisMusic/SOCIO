import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssistantSpeech} from '../js/assistant-speech.js';
import {createAssistantNeural,PIPER_VOICE_ID} from '../js/assistant-neural.js';
import {createAssistantController} from '../js/assistant-ui.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const KEY='socio.assistant.neural.v1';
function storage(enabled=true){
 const previous=globalThis.localStorage;
 const data=new Map(enabled?[[KEY,'enabled']]:[]);
 globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 return ()=>{globalThis.localStorage=previous;};
}
function controller(){
 return createAssistantController({
  data:()=>({tasks:[],businesses:[],appointments:[],soundline:{quotes:[]}}),
  page:()=> 'inicio',escape:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  icon:()=>'<svg></svg>',refresh:()=>{},navigate:()=>{},toast:()=>{},
  prepareTask:()=>{},prepareAppointment:()=>{},completeTask:()=>{}
 });
}

test('botão Parar áudio é uma ação independente de parar o microfone e mantém resposta escrita',()=>{
 const reset=storage(false);
 try{
  const app=controller();
  const source=read('js/assistant-ui.js');
  const css=read('css/assistant-v00329.css');
  assert.match(source,/id="assistant-stop-audio"/);
  assert.match(source,/data-action="assistant-stop-audio"/);
  assert.match(source,/Áudio interrompido\. A resposta escrita permanece disponível/);
  assert.match(source,/setSpeechBusy\(false\)/);
  assert.match(css,/assistant-stop-audio\[hidden\]\{display:none!important\}/);
  assert.match(css,/@media\(max-width:740px\)/);
  assert.equal(app.action({dataset:{action:'assistant-stop-audio'}}),true);
  assert.match(app.render(),/SÓCIO ASSISTENTE/);
 }finally{reset();}
});

test('parar a voz durante decodeAudioData evita que o iPhone inicie o WAV atrasado',async()=>{
 const reset=storage(false), oldWindow=globalThis.window;
 let unblock,created=0,active=[];
 class FakeAudioContext {
  constructor(){this.state='running';this.destination={};}
  async decodeAudioData(){return new Promise(resolve=>{unblock=resolve;});}
  createBufferSource(){created++;return {connect(){},start(){},stop(){},disconnect(){}};}
 }
 globalThis.window={AudioContext:FakeAudioContext};
 try{
  const speech=createAssistantSpeech(()=>{},on=>active.push(on));
  const pending=speech.playBlob(new Blob(['wav']));
  for(let i=0;i<10&&!unblock;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof unblock,'function');
  speech.stop({quiet:true});
  unblock({length:1});
  await assert.rejects(pending,err=>err?.name==='AbortError');
  assert.equal(created,0,'nenhum áudio deve começar após toque em parar');
  assert.equal(active.at(-1),false);
 }finally{globalThis.window=oldWindow;reset();}
});

test('cancelar Faber em preparação não aciona fallback nem registra erro técnico',async()=>{
 const reset=storage();
 let finishPredict,entered=false;
 const voice=createAssistantNeural({
  loadLibrary:async()=>({
   stored:async()=>[PIPER_VOICE_ID],download:async()=>{},
   predict:async()=>{entered=true;return new Promise(resolve=>{finishPredict=resolve;});}
  }),
  playAudio:async()=>{throw Error('não deve reproduzir');}
 });
 try{
  const pending=voice.generate('Exemplo de tarefa longa');
  for(let i=0;i<10&&!entered;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(entered,true);
  voice.cancel();
  finishPredict(new Blob(['wav']));
  const result=await pending;
  assert.equal(result.reason,'cancelled');
  assert.equal(voice.diagnostic(),null);
 }finally{voice.disable();reset();}
});

test('tempos da consulta local e síntese são expostos apenas no diagnóstico recolhido',async()=>{
 const reset=storage();
 let timing;
 const voice=createAssistantNeural({
  loadLibrary:async()=>({
   stored:async()=>[PIPER_VOICE_ID],download:async()=>{},
   predict:async()=>new Blob(['wav'])
  }),
  onTiming:data=>{timing=data;},
  playAudio:async()=>{}
 });
 try{
  assert.equal((await voice.generate('Minha prioridade')).ok,true);
  assert.equal(timing.characters,16);
  assert.equal(timing.fromCache,false);
  assert.ok(timing.readyMs>=0);
  assert.equal((await voice.generate('Minha prioridade')).ok,true);
  assert.equal(timing.fromCache,true);
  const ui=read('js/assistant-ui.js');
  assert.match(ui,/Consulta local:/);
  assert.match(ui,/Voz pronta:/);
  assert.match(ui,/<details class="assistant-voice-advanced"/);
  assert.match(ui,/assistant-voice-timing/);
 }finally{voice.disable();reset();}
});

test('arquivos PWA atualizados para V003.30 preservam outras áreas e Web Push',()=>{
 assert.match(read('index.html'),/assistant-v00329\.css/);
 assert.match(read('index.html'),/MEU SÓCIO · V003\.30/);
 assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.30'/);
 assert.match(read('service-worker.js'),/socio-v00330-20261123/);
 assert.match(read('service-worker.js'),/assistant-v00329\.css/);
 assert.match(read('service-worker.js'),/self\.addEventListener\('push'/);
 assert.match(read('js/app.js'),/createAssistantController/);
 assert.match(read('version.json'),/V003\.30/);
});
