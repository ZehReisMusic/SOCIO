import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('tema aprovado está ligado ao HTML, offline PWA e usa acentos âmbar e azul-teal',()=>{
  const html=read('index.html'),worker=read('service-worker.js'),css=read('css/theme-v0032.css');
  assert.match(html,/href="\.\/css\/theme-v0032\.css"/);
  assert.match(worker,/'\.\/css\/theme-v0032\.css'/);
  assert.match(css,/--amber:#edb46c/);
  assert.match(css,/--teal:#48b8d5/);
  assert.match(css,/--teal-deep:#217d9e/);
  assert.match(css,/--font-display:'Inter Tight'/);
});
test('design unificado cobre todas as telas sem criar uma segunda aplicação',()=>{
  const css=read('css/theme-v0032.css');
  for(const className of ['.sidebar','.topbar','.mobile-nav','.metrics','.dashboard-grid',
    '.business-card','.task-row','.execution-card','.agenda-voice-panel',
    '.activity-row','.setting-card','.station-intro','.station-song',
    '.station-detail','.modal','.form-field'])
    assert.ok(css.includes(className),'Faltou '+className);
  assert.doesNotMatch(css,/url\((?:https?:)?\/\//i,'Tema não deve usar fotos externas');
});
test('atalhos da tela inicial são ações reais, sem números inventados',()=>{
  const app=read('js/app.js');
  assert.match(app,/function dashboard\(\)/);
  assert.match(app,/const s=stats\(data\),top=recommend\(data\)/);
  for(const code of ['data-nav="tarefas"','data-nav="agenda"','data-nav="negocios"','data-action="open-station"'])
    assert.ok(app.includes(code),'Atalho não conectado: '+code);
});
test('versionamento consistente V003.25 sem apagar dados nem alterar subscrição',()=>{
  const version=JSON.parse(read('version.json'));
  const html=read('index.html'),app=read('js/app.js'),updater=read('js/updater.js');
  const worker=read('service-worker.js');
  assert.equal(version.version,'V003.25');
  assert.match(html,/MEU SÓCIO · V003\.25/);
  assert.match(html,/agenda-v0038\.css/);
  assert.match(worker,/agenda-overview\.js/);
  assert.match(updater,/APP_VERSION = 'V003\.25'/);
  assert.match(worker,/socio-v00325-20261123/);
  assert.match(worker,/self\.addEventListener\('push'/);
  assert.match(worker,/self\.addEventListener\('notificationclick'/);
  assert.match(app,/initPush\(\{notify:toast,data:\(\)=>data\}\)/);
  assert.match(app,/void syncPush\(data\)/);
});
test('navegação móvel continua com todas as rotas; atualização da PWA não troca o localStorage',()=>{
  const app=read('js/app.js'),store=read('js/store.js');
  for(const route of ['inicio','negocios','tarefas','agenda','executar','historico','ajustes'])
    assert.ok(app.includes("'"+route+"'"),'Rota '+route+' ausente');
  assert.match(app,/page==='estacao'/);
  assert.match(store,/socio\.v001\.data/);
});
