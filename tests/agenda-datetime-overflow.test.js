import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('formulário da Agenda marca apenas a linha Data/Horário com classe responsiva',()=>{
 const app=read('js/app.js');
 assert.ok(app.includes('class="form-grid agenda-datetime-grid"'));
 assert.ok(app.includes("agendaNativeDateTimeField('Data','date',date,'date')"));
 assert.ok(app.includes("agendaNativeDateTimeField('Horário','time',time,'time')"));
 assert.equal((app.match(/agenda-datetime-grid/g)||[]).length,1);
 assert.match(app,/function agendaForm\(id='',voice=false,transcript='',audioUrl='',prefill=\{\}\)/);
 assert.match(app,/function startAgendaVoice\(\)/);
});

test('iPhone: Data/Horário são verticais, limitados à largura da janela, sem remover os pickers nativos',()=>{
 const css=read('css/agenda-datetime-v00315.css');
 assert.match(css,/@media\s*\(max-width:740px\)/);
 assert.match(css,/\.modal \.agenda-datetime-grid\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.modal \.agenda-datetime-grid > \.form-field\s*\{[^}]*min-width:0/);
 assert.match(css,/\.modal \.agenda-datetime-grid input\[type="date"\],[\s\S]*?\.modal \.agenda-datetime-grid input\[type="time"\]/);
 assert.match(css,/max-width:100%;\s*width:100%;\s*font-size:16px/);
 assert.doesNotMatch(css,/-webkit-appearance:\s*none|touch-action|user-scalable|maximum-scale/);
 const app=read('js/app.js');
 assert.ok(app.includes("agendaNativeDateTimeField('Data','date',date,'date')"));
 assert.ok(app.includes("agendaNativeDateTimeField('Horário','time',time,'time')"));
});

test('desktop mantém grade original: nenhuma regra de colunas fora do media query',()=>{
 const css=read('css/agenda-datetime-v00315.css');
 const breakpoint=css.indexOf('@media (max-width:740px)');
 assert.ok(breakpoint>=0);
 assert.doesNotMatch(css.slice(0,breakpoint),/grid-template-columns/);
 assert.match(read('css/style.css'),/\.form-grid\{display:grid;grid-template-columns:1fr 1fr/);
});

test('versão, cache e tema preservam todas as funções validadas do MEU SÓCIO',()=>{
 const html=read('index.html'),sw=read('service-worker.js');
 assert.equal(JSON.parse(read('version.json')).version,'V003.17');
 assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.17'/);
 assert.match(sw,/socio-v00317-20261121/);
 assert.match(sw,/'\.\/css\/agenda-datetime-v00315\.css'/);
 const links=[...html.matchAll(/href="(\.\/css\/[^"]+\.css)"/g)].map(x=>x[1]);
 assert.ok(links.indexOf('./css/agenda-datetime-v00315.css')>links.indexOf('./css/ios-input-focus-v00313.css'));
 assert.equal(links.at(-1),'./css/agenda-native-picker-v00317.css');
 assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(read('css/theme-v0032.css'),/\.toast\{background:#24363d;color:#fff/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
});
