import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('iPhone: logo e botão + respeitam safe area superior sem serem escondidos pela barra de status',()=>{
 const css=read('css/iphone-safe-area-v00311.css');
 const html=read('index.html');
 assert.match(css,/@media\s*\(max-width:740px\)/);
 assert.match(css,/\.topbar\s*\{[\s\S]*?padding-top:env\(safe-area-inset-top,\s*0px\)/);
 assert.match(css,/min-height:calc\(62px \+ env\(safe-area-inset-top,\s*0px\)\)/);
 assert.match(css,/\.topbar-action\s*\{flex-shrink:0\}/);
 assert.match(html,/class="mobile-brand"/);
 assert.match(html,/class="topbar-action"/);
 assert.match(html,/href="\.\/css\/iphone-safe-area-v00311\.css"/);
});
test('iPhone: menu inferior fixo mantém margem rolável para o último cartão',()=>{
 const css=read('css/iphone-safe-area-v00311.css');
 assert.match(css,/#view\s*\{padding-bottom:calc\(148px \+ env\(safe-area-inset-bottom,\s*0px\)\)\}/);
 assert.match(css,/html\s*\{scroll-padding-bottom:calc\(118px \+ env\(safe-area-inset-bottom,\s*0px\)\)\}/);
});
test('ajuste CSS isolado preserva dados, ícone, Web Push e toast branco aprovado',()=>{
 const theme=read('css/theme-v0032.css');
 const sw=read('service-worker.js');
 assert.match(theme,/\.toast\{background:#24363d;color:#fff/);
 assert.match(sw,/socio-v00321-20261122/);
 assert.match(sw,/'\.\/css\/iphone-safe-area-v00311\.css'/);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(read('index.html'),/apple-touch-icon\.png\?v=0035/);
 assert.equal(JSON.parse(read('version.json')).version,'V003.21');
});