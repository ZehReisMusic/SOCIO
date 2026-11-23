import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('iPhone: grid da janela não cresce acima do viewport por largura intrínseca de controles nativos',()=>{
 const css=read('css/ios-modal-width-v00316.css');
 assert.match(css,/@media\s*\(max-width:740px\)/);
 assert.match(css,/\.modal-backdrop\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.modal-backdrop\s*\{[^}]*overflow-x:hidden/);
 assert.match(css,/\.modal\s*\{[^}]*width:100%;[^}]*max-width:100%;[^}]*min-width:0;[^}]*overflow-x:hidden;[^}]*overflow-y:auto/);
 assert.match(css,/\.modal > form,[\s\S]*?\.modal \.form-field\s*\{[^}]*max-width:100%;[^}]*min-width:0/);
});
test('data e horário continuam nativos, completos e em linhas separadas no iPhone',()=>{
 const css=read('css/ios-modal-width-v00316.css');
 const app=read('js/app.js');
 assert.match(css,/\.modal \.agenda-datetime-grid\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.modal \.agenda-datetime-grid input\[type="date"\],[\s\S]*?\.modal \.agenda-datetime-grid input\[type="time"\]/);
 assert.match(css,/inline-size:100%;[^}]*max-inline-size:100%;[^}]*min-inline-size:0/);
 assert.ok(app.includes('class="form-grid agenda-datetime-grid"'));
 assert.ok(app.includes("agendaNativeDateTimeField('Data','date',date,'date')"));
 assert.ok(app.includes("agendaNativeDateTimeField('Horário','time',time,'time')"));
 assert.ok(app.includes("agendaNativeDateTimeField('Data','date',date,'date')"));
 assert.ok(app.includes("agendaNativeDateTimeField('Horário','time',time,'time')"));
});
test('rolagem vertical e zoom por pinça continuam disponíveis',()=>{
 const css=read('css/ios-modal-width-v00316.css');
 const html=read('index.html');
 assert.match(css,/overflow-y:auto/);
 assert.doesNotMatch(css,/touch-action|pinch-zoom|user-scalable|maximum-scale/);
 assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
});
test('PWA V003.25 mantém cache de estilos, aviso branco e conexão Web Push',()=>{
 const sw=read('service-worker.js'),html=read('index.html');
 assert.equal(JSON.parse(read('version.json')).version,'V003.25');
 assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.25'/);
 assert.match(sw,/socio-v00325-20261123/);
 assert.match(sw,/'\.\/css\/ios-modal-width-v00316\.css'/);
 const links=[...html.matchAll(/href="(\.\/css\/[^"]+\.css)"/g)].map(x=>x[1]);
 assert.ok(links.includes('./css/agenda-native-picker-v00317.css'));
 assert.equal(links.at(-1),'./css/assistant-v00325.css');
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('css/theme-v0032.css'),/\.toast\{background:#24363d;color:#fff/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
});
