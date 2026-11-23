import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Etapa 04 está conectada às telas e persiste vínculos múltiplos no cadastro e detalhes',()=>{
 const app=read('js/app.js');
 assert.match(app,/from '.\/agenda-task-links\.js'/);
 assert.match(app,/function agendaTaskLinks\(a=\{\}\)/);
 assert.match(app,/name="taskIds"/);
 assert.match(app,/\$\{agendaTaskLinks\(a\)\}/);
 assert.match(app,/const taskIds=selectedAppointmentTasks\(f\)/);
 assert.match(app,/a\.taskIds=taskIds/);
 assert.match(app,/taskId:taskIds\[0\]\|\|'',taskIds/);
});

test('deletar tarefa limpa referências plural e legado sem apagar compromissos',()=>{
 const app=read('js/app.js');
 assert.match(app,/data\.tasks=data\.tasks\.filter\(x=>x\.id!==id\)/);
 assert.match(app,/const ids=linkedTaskIds\(a,data\.tasks\.filter/);
 assert.match(app,/a\.taskIds=ids;a\.taskId=ids\[0\]\|\|''/);
});

test('recomendação usa Agenda e não modifica datas ou situação de tarefas',()=>{
 const app=read('js/app.js'),logic=read('js/logic.js');
 assert.match(logic,/preparationContext\(task, appointments, now\)/);
 assert.match(logic,/scoreTask\(t,businesses\.get\(t\.businessId\),now,data\.appointments\|\|\[\]\)/);
 assert.match(app,/reasonFor\(top,business\(top\.businessId\),new Date\(\),data\.appointments\|\|\[\]\)/);
 assert.match(app,/function taskPreparationTag\(t\)/);
});

test('checkboxes e textos cabem no iPhone sem alterar pickers, menu ou zoom',()=>{
 const css=read('css/agenda-task-links-v00319.css'),html=read('index.html');
 assert.match(css,/\.agenda-task-fieldset\s*\{[\s\S]*?min-width:0/);
 assert.match(css,/\.agenda-task-options\s*\{[\s\S]*?overflow-x:hidden/);
 assert.match(css,/@media \(max-width:740px\)/);
 assert.doesNotMatch(css,/user-scalable|maximum-scale|position:fixed|touch-action/);
 assert.ok(html.indexOf('agenda-task-links-v00319.css')>html.indexOf('push-time-mobile-v00318.css'));
});

test('cache da PWA inclui ambos novos arquivos e mantém Web Push e design anteriores',()=>{
 const sw=read('service-worker.js');
 assert.match(sw,/socio-v00331-20261123/);
 assert.ok(sw.includes('./js/agenda-task-links.js'));
 assert.ok(sw.includes('./css/agenda-task-links-v00319.css'));
 for(const previous of ['./css/push-time-mobile-v00318.css','./css/agenda-native-picker-v00317.css','./js/push.js'])
   assert.ok(sw.includes(previous),'Arquivo anterior ausente: '+previous);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
});

test('migração protege vínculo de tarefa legado na mesma chave de armazenamento',()=>{
 const store=read('js/store.js');
 assert.match(store,/socio\.v001\.data/);
 assert.match(store,/taskIds=linkedTaskIds\(v,t\)/);
 assert.match(store,/taskId:taskIds\[0\]\|\|'',taskIds/);
});
