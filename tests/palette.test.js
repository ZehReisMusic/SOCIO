import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('paleta azul é aplicada após a composição visual nas 7 abas e na STATION',()=>{
 const html=read('index.html'),css=read('css/palette-v0036.css'),worker=read('service-worker.js');
 assert.match(html,/experience-v0033\.css"[\s\S]*palette-v0036\.css"/);
 assert.match(worker,/'\.\/css\/palette-v0036\.css'/);
 for(const selector of ['.business-card','.setting-card','.panel','.execution-card','.station-song','.station-detail','.station-intro','.task-row','.agenda-date','.station-guide','.filter-btn'])
   assert.ok(css.includes(selector),'Seletor ausente '+selector);
 assert.match(css,/linear-gradient\(153deg,#1b3445/);
 assert.match(css,/--socio-cyan:#48b8d5/);
});
test('tela Início continua com o azul e layout aprovados',()=>{
 const css=read('css/palette-v0036.css');
 assert.match(css,/body:not\(\[data-page="inicio"\]\)/);
 assert.doesNotMatch(css,/^\.home-hero\s*\{/m);
 assert.doesNotMatch(css,/^\.home-metrics\s*\{/m);
});
test('ângulos âmbar permanecem e ícone 01 não é substituído',()=>{
 const css=read('css/palette-v0036.css'),manifest=JSON.parse(read('manifest.webmanifest'));
 assert.match(css,/var\(--amber\)/);
 assert.match(css,/\.filter-btn.active/);
 assert.ok(manifest.icons.every(icon=>icon.src.includes('0035')));
});
test('Web Push e dados mantêm contratos existentes',()=>{
 const sw=read('service-worker.js'),push=read('js/push.js'),store=read('js/store.js');
 assert.match(sw,/self.addEventListener\('push'/);
 assert.match(sw,/self.addEventListener\('notificationclick'/);
 assert.match(push,/socio\.v003\.push/);
 assert.match(store,/socio\.v001\.data/);
});
