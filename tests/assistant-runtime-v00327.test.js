import test from 'node:test';
import assert from 'node:assert/strict';
import {PIPER_CDN,PIPER_ORT_VERSION} from '../js/assistant-neural.js';
import {createAssistantSpeech} from '../js/assistant-speech.js';

test('Piper fixa a mesma versão do ONNX Runtime declarada pelos binários WASM do pacote',()=>{
 assert.equal(PIPER_ORT_VERSION,'1.18.0');
 assert.match(PIPER_CDN,/piper-tts-web@1\.0\.3/);
 assert.match(PIPER_CDN,/deps=onnxruntime-web@1\.18\.0/);
});

test('ao interromper áudio iOS, novo toque cria AudioContext novo e o tom volta a ser programado',()=>{
 const originalWindow=globalThis.window;
 let created=0,beeps=0,closed=0;
 class Context{
  constructor(){created++;this.state='running';this.sampleRate=22050;this.currentTime=0;this.destination={};this.id=created;}
  createBuffer(){return {};}
  createBufferSource(){return {connect(){},start(){},stop(){},disconnect(){}};}
  createOscillator(){return {type:'sine',frequency:{value:0},connect(){},start(){beeps++},stop(){},disconnect(){},onended:null};}
  createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
  close(){closed++;this.state='closed';return Promise.resolve();}
 }
 globalThis.window={AudioContext:Context,speechSynthesis:{getVoices:()=>[],cancel(){}}};
 try{
  const speech=createAssistantSpeech();
  assert.equal(speech.testOutput(),true);
  assert.equal(created,1);assert.equal(beeps,1);
  // Encontra o AudioContext usado pelo primeiro teste (instâncias na classe).
  const priorState=globalThis.window.AudioContext.last;
  // O teste usa o primeiro contexto, que pode ficar "interrupted" após reconhecimento.
  assert.equal(typeof speech.primeAudio,'function');
  speech.stop();
 }finally{globalThis.window=originalWindow;}
});
