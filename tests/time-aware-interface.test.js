import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Etapa 05 conecta disponibilidade a Início e Executar sem alterar tarefas',()=>{
 const app=read('js/app.js');
 assert.match(app,/import \{selectTaskForTime\} from '.\/time-aware\.js'/);
 assert.match(app,/function timePlan\(now=new Date\(\)\)/);
 assert.match(app,/selectTaskForTime\(rankTasks\(data,now\),data\.appointments\|\|\[\],now\)/);
 assert.match(app,/\$\{focusCard\(plan.task,false,plan\)\}/);
 assert.match(app,/function execution\(\)\{const plan=timePlan\(\),top=plan.task/);
 assert.match(app,/function timeGuidance\(plan\)/);
});
test('layout temporal tem seu próprio cartão, sem mexer no menu e nos seletores iOS',()=>{
 const css=read('css/time-aware-v00320.css'),html=read('index.html');
 assert.match(css,/box-sizing:border-box/);assert.match(css,/min-width:0/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.doesNotMatch(css,/user-scalable|maximum-scale|touch-action|position:fixed/);
 assert.ok(html.indexOf('time-aware-v00320.css')>html.indexOf('push-time-mobile-v00318.css'));
});
test('versão PWA correta com todos os módulos offline e Web Push intacto',()=>{
 const html=read('index.html'),sw=read('service-worker.js'),updater=read('js/updater.js');
 assert.match(html,/MEU SÓCIO · V003\.25/);
 assert.match(updater,/APP_VERSION = 'V003\.25'/);
 assert.match(sw,/socio-v00325-20261123/);
 for(const file of ['./js/time-aware.js','./css/time-aware-v00320.css','./js/agenda-task-links.js','./js/push.js'])
   assert.ok(sw.includes(file));
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
});
