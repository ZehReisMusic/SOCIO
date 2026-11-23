import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function simulateOpenModal(finePointer){
 const app=read('js/app.js');
 const start=app.indexOf('function openModal('),end=app.indexOf('function closeModal(');
 assert.ok(start>0&&end>start,'Função openModal não encontrada');
 let focusCalls=0;
 const elements={
   'modal-content':{innerHTML:'',dataset:{},querySelector:()=>({focus(){focusCalls++}})},
   'modal-backdrop':{hidden:true}
 };
 const document={body:{style:{overflow:''}}};
 const fn=runInNewContext('('+app.slice(start,end).trim()+')',{
   $:id=>elements[id],document,
   window:{matchMedia:q=>({matches:finePointer&&q==='(hover: hover) and (pointer: fine)'})},
   setTimeout:callback=>callback()
 });
 fn('<div>Formulário</div>','create-agenda','a-01');
 return {focusCalls,elements,document};
}
test('iPhone/touch: modal abre sem foco automático nem deslocamento causado pelo teclado',()=>{
 const {focusCalls,elements,document}=simulateOpenModal(false);
 assert.equal(focusCalls,0);
 assert.equal(elements['modal-backdrop'].hidden,false);
 assert.equal(elements['modal-content'].dataset.mode,'create-agenda');
 assert.equal(document.body.style.overflow,'hidden');
});
test('computador com mouse: preserva foco automático no primeiro campo',()=>{
 const {focusCalls}=simulateOpenModal(true);
 assert.equal(focusCalls,1);
});
test('zoom manual e PWA continuam intactos, sem configuração especial de viewport',()=>{
 const html=read('index.html'),sw=read('service-worker.js'),app=read('js/app.js');
 assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
 assert.match(app,/const finePointer=window\.matchMedia\?\./);
 assert.match(app,/if\(finePointer\)setTimeout/);
 assert.match(read('css/ios-input-focus-v00313.css'),/font-size:16px/);
 assert.match(sw,/socio-v00324-20261122/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
 assert.equal(JSON.parse(read('version.json')).version,'V003.24');
});