import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('painel real usa ondas vetoriais na página inicial, sem imagens da REIZZOR',()=>{
  const app=source('js/app.js'),css=source('css/experience-v0033.css'),svg=source('assets/socio-waves.svg');
  assert.match(app,/class="home-hero"/);
  assert.match(app,/class="home-hero-art"/);
  assert.match(css,/\.home-hero-art\s*\{/);
  assert.match(css,/url\("\.\.\/assets\/socio-waves\.svg"\)/);
  assert.match(svg,/<svg\b/);
  assert.match(svg,/linearGradient/);
  assert.doesNotMatch(svg,/REIZZOR|Retina Azul|RESISTIR/i);
});

test('tela inicial não usa números inventados e mantém os eventos reais dos botões',()=>{
  const app=source('js/app.js');
  assert.match(app,/const s=stats\(data\),top=recommend\(data\)/);
  assert.match(app,/const available=rankTasks\(data\)/);
  assert.match(app,/data\.tasks\.filter\(x=>x\.status==='done'\)/);
  assert.match(app,/data-action="toggle-task"/);
  assert.match(app,/data-action="open-station"/);
  assert.match(app,/data-nav="agenda"/);
  assert.match(app,/data-nav="tarefas"/);
});

test('tela compacta mantém os comandos de executar e adiar tarefas',()=>{
  const app=source('js/app.js');
  assert.match(app,/function focusCard\(t,large=false,plan=null\)/);
  assert.match(app,/btn\('Deixar para depois','skip-task'/);
  assert.match(app,/start-execution/);
  assert.match(source('css/experience-v0033.css'),/\.home-dashboard \.focus-panel/);
});

test('nova versão mantém todos os arquivos offline e o recebimento do Web Push',()=>{
  const sw=source('service-worker.js'),html=source('index.html');
  assert.match(sw,/'\.\/css\/experience-v0033\.css'/);
  assert.match(sw,/'\.\/assets\/socio-waves\.svg'/);
  assert.match(html,/href="\.\/css\/experience-v0033\.css"/);
  assert.match(sw,/self\.addEventListener\('push'/);
  assert.match(sw,/self\.addEventListener\('notificationclick'/);
  assert.match(source('js/updater.js'),/APP_VERSION = 'V003\.31'/);
});

test('navegação iPhone não duplica o rótulo Início junto ao nome do aplicativo',()=>{
 const app=source('js/app.js'),css=source('css/experience-v0033.css');
 assert.match(app,/document\.body\.dataset\.page=page/);
 assert.match(css,/\.topbar-left #topbar-current\s*\{display:none!important\}/);
});
