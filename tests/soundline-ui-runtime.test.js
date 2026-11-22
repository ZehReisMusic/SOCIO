import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundlineController} from '../js/soundline-ui.js';
import {createSoundlineState} from '../js/soundline-core.js';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const state={soundline:createSoundlineState(),businesses:[],tasks:[]};
state.soundline.supplies=[
 {id:'c',name:'Cabo Premium',category:'cabo',costCents:450,active:true},
 {id:'p',name:'Plug SA2X',category:'conector',costCents:1200,active:true}
];
const mk=()=>createSoundlineController({
 getData:()=>state,refresh:()=>{},commit:()=>{},navigate:()=>{},toast:()=>{},
 esc,newId:prefix=>prefix+'-1',svg:()=>'<svg></svg>',
 btn:(name,act,variant,attrs='')=>'<button data-action="'+act+'" '+attrs+'>'+name+'</button>',
 field:(name,id,value,type,attrs='')=>'<label>'+name+'<input name="'+id+'" value="'+esc(value)+'" '+attrs+'></label>',
 selectField:(name,id,value,items)=>'<label>'+name+'<select name="'+id+'">'+items.map(x=>'<option>'+esc(x[1])+'</option>').join('')+'</select></label>',
 textArea:(name,id,value)=>'<label>'+name+'<textarea>'+esc(value)+'</textarea></label>',
 formWrap:(k,t,c)=>'<form>'+c+'</form>',openModal:()=>{},closeModal:()=>{},
 modalMode:()=>'',modalId:()=>''
});
test('central inicia com lista, explica custos e tem entrada para cadastro',()=>{
 const ui=mk();const html=ui.render();
 assert.match(html,/SOUNDLINE/);
 assert.match(html,/Novo orçamento/);
 assert.match(html,/Falar orçamento/);
 assert.match(html,/Cadastrar insumos/);
});
test('novo orçamento abre editor com modelos reais e cálculo privado',()=>{
 const ui=mk();
 assert.equal(ui.action({dataset:{action:'sl-new-quote'}}),true);
 const html=ui.render();
 assert.match(html,/Nome do cliente/);
 assert.match(html,/Plug SA2X/);
 assert.match(html,/Comprimento de cada cabo/);
 assert.match(html,/SOUNDLINE/);
 assert.match(html,/Lucro bruto estimado/);
});
test('parar o microfone realmente abre revisão e mantém a transcrição',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 let instance;
 class Recognition{
  constructor(){instance=this;}start(){}stop(){this.onend?.();}abort(){}
 }
 const elements=new Map([['sl-voice-trigger',{dataset:{},textContent:''}],['sl-voice-live',{textContent:''}]]);
 globalThis.window={SpeechRecognition:Recognition};
 globalThis.document={getElementById:id=>elements.get(id)||null};
 try{
  const ui=mk();
  ui.action({dataset:{action:'sl-start-voice'}});
  instance.onresult({results:[[{transcript:'Criar orçamento para Carlos, dois cabos de cinco metros SA2X'}]]});
  ui.action({dataset:{action:'sl-stop-voice'}});
  const html=ui.render();
  assert.match(html,/Revisar|Novo orçamento/);
  assert.match(html,/Carlos/);
  assert.match(html,/Transcrição recebida/);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
