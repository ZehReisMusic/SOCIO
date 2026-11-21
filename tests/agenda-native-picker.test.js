import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function renderNativeField(label,name,value,type){
 const app=read('js/app.js'),start=app.indexOf('function agendaNativeDateTimeField('),end=app.indexOf('function textArea(',start);
 assert.ok(start>0&&end>start,'Campo nativo independente não encontrado');
 const fn=runInNewContext('('+app.slice(start,end).trim()+')',{esc:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;')});
 return fn(label,name,value,type);
}
test('Data mantém picker nativo date e contrato name/id exigidos pelo salvamento',()=>{
 const html=renderNativeField('Data','date','2026-11-23','date');
 assert.match(html,/class="agenda-native-picker-shell"/);
 assert.match(html,/<label for="f-date">Data<\/label>/);
 assert.match(html,/<input id="f-date" name="date" type="date" value="2026-11-23" required>/);
});
test('Horário mantém picker nativo time e valor 14:00, sem controles fictícios',()=>{
 const html=renderNativeField('Horário','time','14:00','time');
 assert.match(html,/<label for="f-time">Horário<\/label>/);
 assert.match(html,/<input id="f-time" name="time" type="time" value="14:00" required>/);
 assert.doesNotMatch(html,/<button|type="text"|type="hidden"/);
});
test('borda da moldura é independente do input WebKit e fica confinada à largura do modal',()=>{
 const css=read('css/agenda-native-picker-v00317.css');
 assert.match(css,/@media\s*\(max-width:740px\)/);
 assert.match(css,/\.modal \.agenda-datetime-grid \.agenda-native-picker-shell\s*\{[^}]*width:100%;[^}]*max-width:100%;[^}]*min-width:0;[^}]*min-height:46px;[^}]*overflow:hidden/);
 assert.match(css,/border:1px solid #436679;/);
 assert.match(css,/\.modal \.agenda-datetime-grid \.agenda-native-picker-shell > input\[type="date"\],[\s\S]*?input\[type="time"\]/);
 assert.match(css,/flex:1 1 0%/);
 assert.match(css,/max-inline-size:100%/);
 assert.match(css,/border:0/);
 assert.match(css,/::-webkit-date-and-time-value/);
 assert.doesNotMatch(css,/appearance:none|touch-action|user-scalable|maximum-scale/);
});
test('V003.19 preserva Web Push, dados, zoom manual e ícone',()=>{
 const html=read('index.html'),sw=read('service-worker.js');
 assert.equal(JSON.parse(read('version.json')).version,'V003.19');
 assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.19'/);
 assert.match(sw,/socio-v00319-20261121/);
 assert.match(sw,/'\.\/css\/agenda-native-picker-v00317\.css'/);
 const links=[...html.matchAll(/href="(\.\/css\/[^"]+\.css)"/g)].map(m=>m[1]);
 assert.ok(links.includes('./css/agenda-native-picker-v00317.css'));
 assert.equal(links.at(-1),'./css/agenda-task-links-v00319.css');
 assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(read('css/theme-v0032.css'),/\.toast\{background:#24363d;color:#fff/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
});