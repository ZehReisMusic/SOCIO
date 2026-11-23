import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('o campo Horário dos lembretes é encapsulado sem trocar input nativo, id ou o valor salvo',()=>{
  const push=read('js/push.js');
  const line=push.split('\n').find(s=>s.includes('label for="push-time"'));
  assert.ok(line,'Horário dos lembretes ausente');
  assert.match(line,/class="form-field push-time-field"/);
  assert.match(line,/class="push-time-shell"/);
  assert.match(line,/<input id="push-time" type="time" value="'\+escape\(c\.hour\)\+'">/);
  assert.equal((push.match(/<input id="push-time"/g)||[]).length,1);
  assert.match(push,/export async function updatePushTime\(/);
  assert.match(read('js/app.js'),/case 'push-time':void updatePushTime\(\);break;/);
});
test('no iPhone, a moldura do horário cabe dentro do cartão, com picker WebKit e zoom disponíveis',()=>{
  const css=read('css/push-time-mobile-v00318.css');
  assert.match(css,/@media \(max-width:740px\)/);
  assert.match(css,/\.setting-card \.push-time-field \.push-time-shell\s*\{[^}]*overflow:hidden;[^}]*width:100%;[^}]*max-width:100%;[^}]*min-width:0/);
  assert.match(css,/\> #push-time\s*\{[^}]*flex:1 1 0%;[^}]*width:100%;[^}]*max-width:100%;[^}]*min-width:0/);
  assert.match(css,/font-size:16px/);
  assert.match(css,/::-webkit-date-and-time-value/);
  assert.doesNotMatch(css,/appearance:\s*none|user-scalable|touch-action|maximum-scale/i);
  const html=read('index.html');
  assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
});
test('V003.30 preserva assinatura Web Push, Agenda, dados, logo e atualizador automático',()=>{
  const html=read('index.html'),sw=read('service-worker.js');
  assert.equal(JSON.parse(read('version.json')).version,'V003.30');
  assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.30'/);
  assert.match(sw,/socio-v00330-20261123/);
  assert.match(sw,/'\.\/css\/push-time-mobile-v00318\.css'/);
  const links=[...html.matchAll(/href="(\.\/css\/[^"]+\.css)"/g)].map(x=>x[1]);
  assert.equal(links.at(-1),'./css/assistant-v00329.css');
  assert.match(sw,/self\.addEventListener\('push'/);
  assert.match(sw,/self\.addEventListener\('notificationclick'/);
  assert.match(read('js/store.js'),/socio\.v001\.data/);
  assert.match(read('js/push.js'),/socio\.v003\.push/);
  assert.match(html,/apple-touch-icon\.png\?v=0035/);
  assert.match(read('js/app.js'),/function agendaSlotsPanel\(\)/);
  assert.match(read('css/theme-v0032.css'),/\.toast\{background:#24363d;color:#fff/);
});