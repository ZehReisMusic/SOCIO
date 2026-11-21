import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('notificação inferior: fundo grafite aprovado e texto branco com contraste',()=>{
 const base=read('css/style.css'),theme=read('css/theme-v0032.css'),html=read('index.html');
 assert.match(base,/\.toast\{[^}]*color:#14251f/);
 assert.match(theme,/\.toast\{background:#24363d;color:#fff;border:1px solid #58737a/);
 assert.match(html,/href="\.\/css\/theme-v0032\.css"/);
 assert.match(html,/<div id="toast" class="toast"/);
 const rgb=hex=>hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const luminance=hex=>rgb(hex).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const contrast=(luminance('ffffff')+.05)/(luminance('24363d')+.05);
 assert.ok(contrast>=7,'contraste insuficiente: '+contrast);
});
test('ajuste visual mantém os eventos de Web Push e o mesmo armazenamento',()=>{
 assert.match(read('service-worker.js'),/self.addEventListener\('push'/);
 assert.match(read('service-worker.js'),/self.addEventListener\('notificationclick'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(read('index.html'),/apple-touch-icon\.png\?v=0035/);
 assert.equal(JSON.parse(read('version.json')).version,'V003.11');
});