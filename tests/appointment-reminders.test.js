import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeReminderMinutes,reminderLabel,appointmentReminderEntry,appointmentReminderStatus} from '../js/appointment-reminders.js';
import {smartReminders} from '../js/push.js';
import {seedData} from '../js/logic.js';
import {validateData} from '../js/store.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const meeting=(overrides={})=>({id:'a-50',title:'Reunião de despedida do Rafa',date:'2026-11-21',time:'20:00',status:'open',...overrides});
const now=new Date(2026,10,21,13,30);
test('legado usa 30 minutos por padrão, e escolha aceita 0,10,30,60',()=>{
 assert.equal(normalizeReminderMinutes(undefined),30);
 for(const n of [0,10,30,60])assert.equal(normalizeReminderMinutes(String(n)),n);
 for(const invalid of [15,NaN,-1,1000])assert.equal(normalizeReminderMinutes(invalid),30);
 assert.equal(reminderLabel(60),'1 hora antes');
 assert.equal(reminderLabel(0),'Sem lembrete');
});
test('horário do aviso considera o horário local e pode atravessar a meia-noite',()=>{
 const a=appointmentReminderEntry(meeting({reminderMinutes:60}));
 assert.equal(a.id,'agenda-a-50');
 assert.equal(new Date(a.dueAt).getTime(),new Date(2026,10,21,19,0).getTime());
 assert.match(a.title,/Compromisso em 1 hora/);
 const midnight=appointmentReminderEntry(meeting({date:'2026-12-01',time:'00:15',reminderMinutes:30}));
 assert.equal(new Date(midnight.dueAt).getTime(),new Date(2026,10,30,23,45).getTime());
});
test('sem lembrete, concluído ou data inválida não enviam jobs',()=>{
 assert.equal(appointmentReminderEntry(meeting({reminderMinutes:0})),null);
 assert.equal(appointmentReminderEntry(meeting({status:'done'})),null);
 assert.equal(appointmentReminderEntry(meeting({date:'2026-11-31'})),null);
});
test('cada compromisso recebe o próprio antecedente; global da agenda respeita opt-in',()=>{
 const data={events:[],tasks:[],appointments:[
   meeting({id:'a10',reminderMinutes:10}),
   meeting({id:'a30',reminderMinutes:30}),
   meeting({id:'a60',reminderMinutes:60}),
   meeting({id:'a0',reminderMinutes:0}),
 ]};
 assert.deepEqual(smartReminders(data,{agendaAlerts:false},now),[]);
 const jobs=smartReminders(data,{agendaAlerts:true},now);
 assert.equal(jobs.length,3);
 assert.deepEqual(jobs.map(x=>x.id),['agenda-a60','agenda-a30','agenda-a10']);
 assert.deepEqual(jobs.map(x=>new Date(x.dueAt).getHours()),[19,19,19]);
 assert.deepEqual(jobs.map(x=>new Date(x.dueAt).getMinutes()),[0,30,50]);
});
test('indicador não mente: diferença entre salvo, opt-in, pendente e recebido pelo servidor',()=>{
 const meeting30=meeting({reminderMinutes:30}),job=appointmentReminderEntry(meeting30);
 const baseline={enabled:true,agendaAlerts:true};
 assert.equal(appointmentReminderStatus(meeting30,{enabled:false,agendaAlerts:true},now).kind,'disabled');
 assert.equal(appointmentReminderStatus(meeting30,{enabled:true,agendaAlerts:false},now).kind,'disabled');
 assert.equal(appointmentReminderStatus(meeting30,baseline,now).kind,'pending');
 assert.equal(appointmentReminderStatus(meeting30,{...baseline,syncedReminders:[{id:job.id,dueAt:job.dueAt}]},now).kind,'synced');
 assert.equal(appointmentReminderStatus(meeting30,{...baseline,syncedReminders:[{id:job.id,dueAt:'2026-01-01T00:00:00.000Z'}]},now).kind,'pending');
 assert.equal(appointmentReminderStatus(meeting30,{...baseline,syncedReminders:[{id:job.id,dueAt:job.dueAt}]},new Date(2026,10,21,20,0)).kind,'expired');
});
test('compromisso longo prazo indica a janela de até 14 dias',()=>{
 const far=meeting({date:'2027-01-01'});
 assert.equal(appointmentReminderStatus(far,{enabled:true,agendaAlerts:true},now).kind,'later');
});
test('backup preserva escolha de antecedência, legado mantém 30 e valores inválidos não entram',()=>{
 const source=seedData(now);
 source.appointments=[
  {...meeting({id:'a1',reminderMinutes:60})},
  {...meeting({id:'a2',reminderMinutes:0})},
  {...meeting({id:'a3',reminderMinutes:undefined})},
  {...meeting({id:'a4',reminderMinutes:15})}
 ];
 const migrated=validateData(source);
 assert.deepEqual(migrated.appointments.map(x=>x.reminderMinutes),[60,0,30,30]);
 assert.deepEqual(validateData(migrated).appointments.map(x=>x.reminderMinutes),[60,0,30,30]);
});
test('formulário por áudio e manual, detalhes e indicadores usam a mesma escolha',()=>{
 const app=read('js/app.js'),push=read('js/push.js');
 assert.match(app,/function agendaForm\(id='',voice=false/);
 assert.match(app,/selectField\('Lembrete \(opcional\)','reminderMinutes'/);
 assert.match(app,/selectField\('Avisar antes deste compromisso','reminderMinutes'/);
 assert.match(app,/reminderMinutes,source,status:'open'/);
 assert.match(app,/Object.assign\(appointment,\{title,date,time,notes,reminderMinutes,taskId:/);
 assert.match(app,/agendaReminderStatus\(a\)/);
 assert.match(push,/document\.dispatchEvent\(new Event\('socio:push-synced'\)\)/);
 assert.match(push,/lastSync:\{at:Date\.now\(\),reminders/);
 assert.match(push,/Compromissos da agenda \(avisos individuais:/);
});
test('V003.27 preserva Web Push, a identidade visual, a chave local e o ícone original',()=>{
 const worker=read('service-worker.js'),html=read('index.html'),updater=read('js/updater.js');
 assert.match(worker,/socio-v00327-20261123/);
 assert.match(worker,/appointment-reminders\.js/);
 assert.match(worker,/self\.addEventListener\('push'/);
 assert.match(worker,/self\.addEventListener\('notificationclick'/);
 assert.match(html,/reminders-v0039\.css/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
 assert.match(updater,/APP_VERSION = 'V003\.27'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
});

test('notificações de compromissos mostram título claro e abrem a Agenda, sem alterar o clique das tarefas',()=>{
 const sw=read('service-worker.js');
 assert.match(sw,/rawBody\.startsWith\('Uma prioridade ficou pendente: Compromisso em '\)/);
 assert.match(sw,/tag:isAgenda\?'socio-agenda'/);
 assert.match(sw,/data:\{target:isAgenda\?'agenda':'executar'\}/);
 assert.match(sw,/event\.notification\.data\?\.target==='agenda'\?'\.\/#agenda':'\.\/#executar'/);
});
