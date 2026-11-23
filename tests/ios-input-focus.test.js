import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('iOS: todos os campos editáveis da Agenda e ajustes têm texto >= 16px, sem zoom automático',()=>{
 const css=read('css/ios-input-focus-v00313.css');
 const html=read('index.html');
 assert.match(css,/@media\s*\(max-width:740px\)/);
 for(const selector of [
  '.modal input:not([type="checkbox"]):not([type="radio"])',
  '.modal select',
  '.modal textarea',
  '#view .form-field input:not([type="checkbox"]):not([type="radio"])',
  '#view .form-field select',
  '#view .form-field textarea'
 ])assert.ok(css.includes(selector),'Regra ausente para '+selector);
 assert.match(css,/font-size:16px\s*;/);
 const styles=[...html.matchAll(/href="(\.\/css\/[^"]+\.css)"/g)].map(m=>m[1]);
 assert.ok(styles.indexOf('./css/ios-input-focus-v00313.css')>styles.indexOf('./css/theme-v0032.css'),'fontes 16px devem vir depois dos temas');
 assert.ok(styles.indexOf('./css/agenda-datetime-v00315.css')>styles.indexOf('./css/ios-input-focus-v00313.css'),'correção Data/Horário é a última regra específica');
 assert.match(read('css/theme-v0032.css'),/\.form-field input,\.form-field textarea,\.form-field select\{[^}]*font-size:14px/);
});
test('não bloquear zoom manual, não alterar meta viewport nem duplicar campos',()=>{
 const html=read('index.html');
 const css=read('css/ios-input-focus-v00313.css');
 assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/i);
 assert.doesNotMatch(css,/touch-action:|user-scalable|maximum-scale/i);
 assert.match(css,/\.modal \.form-grid > \.form-field \{\s*min-width:0/);
 assert.match(css,/\.modal \.form-grid \.form-field input \{\s*min-width:0;\s*max-width:100%/);
});
test('microversão conserva PWA, ícone, push, armazenamentos, ajustes visuais e Agenda',()=>{
 const sw=read('service-worker.js'),html=read('index.html');
 assert.equal(JSON.parse(read('version.json')).version,'V003.27');
 assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.27'/);
 assert.match(sw,/socio-v00327-20261123/);
 assert.match(sw,/'\.\/css\/ios-input-focus-v00313\.css'/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
 assert.match(html,/iphone-safe-area-v00311\.css/);
 assert.match(read('css/theme-v0032.css'),/\.toast\{background:#24363d;color:#fff/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(read('js/app.js'),/function agendaSlotsPanel\(\)/);
});
