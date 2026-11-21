import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {smartReminders} from '../js/push.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const localTime=d=>[String(d.getHours()).padStart(2,'0'),String(d.getMinutes()).padStart(2,'0')].join(':');
const blank=()=>({tasks:[],events:[],appointments:[]});

test('teste rápido agenda lembrete real em minutos sem criar tarefa do usuário',()=>{
 const now=new Date(),dueAt=new Date(now.getTime()+90000).toISOString();
 const result=smartReminders(blank(),{diagnostic:{id:'diagnostic-123456789',dueAt}},now);
 assert.equal(result.length,1);
 assert.equal(result[0].id,'diagnostic-123456789');
 assert.equal(result[0].dueAt,dueAt);
 assert.match(result[0].title,/TESTE AGENDADO/);
});
test('teste antigo some da programação e lembretes inteligentes ficam desligados por padrão',()=>{
 const now=new Date(),dueAt=new Date(now.getTime()-11*60000).toISOString();
 const d=blank(),start=new Date(now.getTime()+90*60000);
 d.appointments.push({id:'ap-1',title:'Ensaio',date:localDate(start),time:localTime(start),status:'open'});
 d.tasks.push({id:'ta-1',title:'Entrega',due:localDate(new Date(now.getTime()+86400000)),status:'open'});
 assert.deepEqual(smartReminders(d,{diagnostic:{id:'diagnostic-123456789',dueAt}},now),[]);
});
test('agenda só agenda 30 min antes e mediante opção expressa',()=>{
 const now=new Date(),start=new Date(now.getTime()+90*60000);
 const data=blank();data.appointments.push({id:'ap-1',title:'Reunião cliente',date:localDate(start),time:localTime(start),status:'open'});
 const active=smartReminders(data,{agendaAlerts:true},now);
 assert.equal(active.length,1);
 assert.equal(active[0].id,'agenda-ap-1');
 assert.match(active[0].title,/Compromisso em 30 minutos/);
 const when=new Date(active[0].dueAt).getTime();
 assert.ok(Math.abs(when-(start.getTime()-30*60000))<60000);
 data.appointments[0].status='done';assert.deepEqual(smartReminders(data,{agendaAlerts:true},now),[]);
});
test('prazo respeita preferência, tarefa aberta e horário local escolhido',()=>{
 const now=new Date(),tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
 const data=blank();data.tasks.push({id:'t-um',title:'Publicar produto',due:localDate(tomorrow),status:'open'});
 const reminders=smartReminders(data,{deadlineAlerts:true,hour:'14:30'},now);
 assert.equal(reminders.length,1);assert.equal(reminders[0].id,'prazo-t-um');
 const date=new Date(reminders[0].dueAt);
 assert.equal(date.getHours(),14);assert.equal(date.getMinutes(),30);
 data.tasks[0].status='done';assert.deepEqual(smartReminders(data,{deadlineAlerts:true,hour:'14:30'},now),[]);
});
test('UI contém botão para teste e só ativa agenda/prazo quando o usuário opta',()=>{
 const push=read('js/push.js'),app=read('js/app.js'),worker=read('push-worker/wrangler.jsonc');
 assert.match(push,/data-action="push-scheduled-test"/);
 assert.match(push,/id="push-agenda-alerts"/);
 assert.match(push,/id="push-deadline-alerts"/);
 assert.match(push,/agendaAlerts:false,deadlineAlerts:false/);
 assert.match(push,/const reminders=smartReminders\(data,c\)/);
 assert.match(push,/subscription:sub\.toJSON\(\),reminders/);
 assert.match(app,/case 'push-scheduled-test':void schedulePushDiagnostic\(\)/);
 assert.match(app,/case 'push-save-preferences':void savePushPreferences\(\)/);
 assert.match(worker,/"\*\/5 \* \* \* \*"/);
});
test('testes agendados não modificam handler Web Push ou ícone do iPhone',()=>{
 const sw=read('service-worker.js'),manifest=JSON.parse(read('manifest.webmanifest'));
 assert.match(sw,/socio-v00318-20261121/);
 assert.match(sw,/self.addEventListener\('push'/);
 assert.match(sw,/self.addEventListener\('notificationclick'/);
 assert.equal(manifest.icons.length,2);
 assert.ok(manifest.icons.every(x=>x.src.includes('0035')));
});
