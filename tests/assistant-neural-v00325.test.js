import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantNeural,PIPER_VOICE_ID,modelConsentMessage} from '../js/assistant-neural.js';
import {createAssistantSpeech} from '../js/assistant-speech.js';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const memory=new Map();
const local={getItem:key=>memory.get(key)||null,setItem:(key,v)=>memory.set(key,v),removeItem:key=>memory.delete(key)};
test('voz Faber não baixa nem consulta APIs sem um gesto e consentimento',async()=>{
 const old=globalThis.localStorage;globalThis.localStorage=local;memory.clear();
 let fetched=0;const model=createAssistantNeural({loadLibrary:async()=>{fetched++;return {};}});
 try{
  assert.equal(model.enabled(),false);
  assert.equal(fetched,0);
  assert.equal((await model.generate('Tarefa do cliente')).reason,'disabled');
  assert.equal(fetched,0);
  assert.match(modelConsentMessage(),/65 MB/);
  assert.equal(PIPER_VOICE_ID,'pt_BR-faber-medium');
 }finally{globalThis.localStorage=old;}
});
test('somente o botão consentido prepara modelo, gera WAV e usa áudio local',async()=>{
 const old=globalThis.localStorage;globalThis.localStorage=local;memory.clear();
 let loads=0,downloads=0,plays=0,generatedText='';
 const fake={
  stored:async()=>[],
  download:async(id,progress)=>{downloads++;assert.equal(id,PIPER_VOICE_ID);progress({total:100,loaded:50});},
  predict:async({text,voiceId})=>{generatedText=text;assert.equal(voiceId,PIPER_VOICE_ID);return new Blob(['WAV'],{type:'audio/x-wav'});}
 };
 const statuses=[];
 const model=createAssistantNeural({status:s=>statuses.push(s),loadLibrary:async()=>{loads++;return fake;},playAudio:async()=>{plays++;}});
 try{
  assert.equal(await model.prepare(),true);
  assert.equal(downloads,1);assert.equal(loads,1);
  assert.equal(model.enabled(),true);
  assert.equal((await model.generate('Bom dia, sua prioridade é a SOUNDLINE.')).ok,true);
  assert.equal(plays,1);assert.match(generatedText,/SOUNDLINE/);
  assert.ok(statuses.some(s=>/Baixando/.test(s)));
  assert.equal((await model.test()).ok,true);
  model.disable();
  assert.equal(model.enabled(),false);
  assert.equal((await model.generate('Texto')).reason,'disabled');
 }finally{globalThis.localStorage=old;}
});
test('falha na inicialização neural preserva fallback de voz do aparelho',async()=>{
 const old=globalThis.localStorage;globalThis.localStorage=local;memory.clear();
 const status=[];
 const model=createAssistantNeural({status:s=>status.push(s),loadLibrary:async()=>{throw Error('WebAssembly indisponível');}});
 try{
  assert.equal(await model.prepare(),false);
  assert.equal(model.enabled(),false);
  assert.match(status.at(-1),/voz padrão/);
 }finally{globalThis.localStorage=old;}
});
test('voz local previamente preparada não precisa baixar novamente',async()=>{
 const old=globalThis.localStorage;globalThis.localStorage=local;memory.clear();memory.set('socio.assistant.neural.v1','enabled');
 let downloads=0;
 const model=createAssistantNeural({loadLibrary:async()=>({
  stored:async()=>[PIPER_VOICE_ID],download:async()=>{downloads++;},
  predict:async()=>new Blob(['ok'])
 }),playAudio:async()=>{}});
 try{
  assert.equal(model.enabled(),true);
  assert.equal(await model.prepare(),true);
  assert.equal(downloads,0);
  assert.equal((await model.generate('Olá')).ok,true);
 }finally{globalThis.localStorage=old;}
});
test('sistema de áudio do iPhone é liberado no toque; geração usa Web Audio',async()=>{
 const oldWindow=globalThis.window,oldStorage=globalThis.localStorage;globalThis.localStorage=local;
 let resumed=0,started=0;
 class FakeAudioContext{
  constructor(){this.state='suspended';this.sampleRate=22050;this.destination={};}
  resume(){resumed++;this.state='running';return Promise.resolve();}
  createBuffer(){return {length:1};}
  createBufferSource(){return {connect(){},start(){started++;},stop(){},disconnect(){},onended:null};}
  decodeAudioData(){return Promise.resolve({length:1});}
 }
 globalThis.window={AudioContext:FakeAudioContext,speechSynthesis:{getVoices:()=>[],cancel(){}}};
 try{
  const engine=createAssistantSpeech();
  assert.equal(engine.primeAudio(),true);
  assert.equal(resumed,1);
  assert.equal(started,1);
  const playing=engine.playBlob(new Blob(['audio']));
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(started>=2);
  engine.stop();
  await playing;
 }finally{globalThis.window=oldWindow;globalThis.localStorage=oldStorage;}
});
test('nova opção de áudio preserva Assistente, demais microfones e cache PWA',()=>{
 const ui=read('js/assistant-ui.js'),sw=read('service-worker.js'),css=read('css/assistant-v00325.css');
 assert.match(ui,/assistant-neural-enable/);
 assert.match(ui,/assistant-neural-disable/);
 assert.match(ui,/voiceEngine\.primeAudio\(\)/);
 assert.match(ui,/modelConsentMessage\(\)/);
 assert.match(ui,/assistant-test-voice/);
 assert.match(ui,/assistant-stop-voice/);
 assert.match(sw,/assistant-neural\.js/);
 assert.match(sw,/assistant-v00325\.css/);
 assert.match(sw,/socio-v00329-20261123/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(css,/@media\(max-width:740px\)/);
});
