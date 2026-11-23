import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAssistantNeural} from '../js/assistant-neural.js';
import {createAssistantSpeech} from '../js/assistant-speech.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const previous=globalThis.localStorage;
const memory=new Map([['socio.assistant.neural.v1','enabled']]);
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
function engine(predict,playAudio=async()=>{}){
 return createAssistantNeural({status:()=>{},loadLibrary:async()=>({
  predict,stored:async()=>['pt_BR-faber-medium'],download:async()=>{}
 }),playAudio});
}
test('Piper: falha na geração tem código FABER-SYNTH e não simula um WAV existente',async()=>{
 globalThis.localStorage=storage;memory.set('socio.assistant.neural.v1','enabled');
 try{
  const e=engine(async()=>{throw new Error('failed to initialize WASM runtime');});
  const out=await e.test();
  assert.equal(out.ok,false);assert.equal(out.phase,'sintese');
  assert.equal(e.diagnostic().code,'FABER-SYNTH');
  assert.match(e.diagnostic().detail,/WASM/);
  assert.equal(e.generatedAudio(),null);
 }finally{globalThis.localStorage=previous;}
});
test('Piper: gera arquivo WAV mas reprodução falha: diagnóstico FABER-AUDIO preserva arquivo',async()=>{
 globalThis.localStorage=storage;memory.set('socio.assistant.neural.v1','enabled');
 try{
  const wav=new Blob(['wav'],{type:'audio/x-wav'});
  const e=engine(async()=>wav,async()=>{throw new Error('The request is not allowed by the user agent');});
  const out=await e.test();
  assert.equal(out.ok,false);assert.equal(out.phase,'audio');
  assert.equal(e.diagnostic().code,'FABER-AUDIO');
  assert.strictEqual(e.generatedAudio(),wav);
  assert.strictEqual(out.wav,wav);
 }finally{globalThis.localStorage=previous;}
});
test('Piper: se áudio gera e toca, diagnóstico fica vazio',async()=>{
 globalThis.localStorage=storage;memory.set('socio.assistant.neural.v1','enabled');
 try{
  const e=engine(async()=>new Blob(['wav'],{type:'audio/x-wav'}));
  const result=await e.test();
  assert.equal(result.ok,true);
  assert.equal(e.diagnostic(),null);
  assert.ok(e.generatedAudio()?.size);
 }finally{globalThis.localStorage=previous;}
});
test('Interface apresenta teste de áudio, WAV independente e identificação correta da voz ativa',()=>{
 const ui=read('js/assistant-ui.js'),css=read('css/assistant-v00326.css');
 assert.match(ui,/assistant-audio-check/);
 assert.match(ui,/assistant-neural-preview/);
 assert.match(ui,/FABER-SYNTH/);
 assert.match(ui,/Faber · masculina/);
 assert.match(ui,/voiceEngine\.testOutput/);
 assert.match(css,/audio\[hidden\]/);
 assert.doesNotMatch(css,/user-scalable|maximum-scale|position:fixed|touch-action/);
});
test('Diagnóstico de WebAudio não depende de reconhecimento de fala nem de rede',()=>{
 const oldWindow=globalThis.window;
 let sounds=0;
 class MockAudioContext{
  constructor(){this.sampleRate=22050;this.state='running';this.currentTime=0;this.destination={};}
  createBuffer(){return {};}
  createBufferSource(){return {connect(){},start(){},stop(){},disconnect(){}};}
  createOscillator(){return {frequency:{value:0},connect(){},start(){sounds++},stop(){},disconnect(){},onended:null};}
  createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
 }
 globalThis.window={AudioContext:MockAudioContext,speechSynthesis:{getVoices:()=>[],cancel(){}}};
 try{
  const e=createAssistantSpeech();
  assert.equal(e.testOutput(),true);
  assert.equal(sounds,1);
  e.stop();
 }finally{globalThis.window=oldWindow;}
});
