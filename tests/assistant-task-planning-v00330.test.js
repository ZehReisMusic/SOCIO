import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAssistantCommand} from '../js/assistant-core.js';
import {findScheduledTask,getTaskScheduleOptions,isTaskSlotAvailable} from '../js/assistant-task-planning.js';
import {createAssistantController} from '../js/assistant-ui.js';
const at=new Date(2026,10,23,11,38);
const data=()=>({
 businesses:[{id:'b-r',name:'REIZZOR STATION',status:'manutencao',focus:3}],
 tasks:[{id:'t-vs',title:'Organizar VS da REIZZOR antes do ensaio',businessId:'b-r',status:'open',impact:5,urgency:5,effort:2,minutes:60,due:'2026-11-24'}],
 appointments:[{id:'a',title:'Estúdio',date:'2026-11-23',time:'14:00',durationMinutes:180,status:'open'}],
 events:[],skipped:{date:'',taskIds:[]},soundline:{quotes:[]}
});
test('pergunta natural sobre organizar o show da Razor encontra tarefa VS da REIZZOR',()=>{
 const d=data(),snap=JSON.stringify(d);
 const r=resolveAssistantCommand('Que horas eu poderia organizar o show da Razor?',d,at);
 assert.equal(r.kind,'task-schedule');assert.equal(r.taskId,'t-vs');
 assert.equal(r.slots[0].date,'2026-11-23');assert.equal(r.slots[0].time,'12:00');
 assert.equal(r.slots[0].durationMinutes,60);
 assert.match(r.message,/compromissos cadastrados/);
 assert.equal(JSON.stringify(d),snap);
});
test('não sugere intervalo que colida com compromisso nem com margem de segurança',()=>{
 const d=data(),slots=getTaskScheduleOptions(d.tasks[0],d.appointments,at);
 assert.equal(slots.some(s=>s.date==='2026-11-23'&&s.time==='13:00'),false);
 assert.equal(isTaskSlotAvailable({date:'2026-11-23',time:'13:00',durationMinutes:60},d.appointments,at),false);
});
test('compromisso sem duração torna o período posterior incerto',()=>{
 const d=data();d.appointments=[{date:'2026-11-23',time:'11:00',status:'open',title:'Reunião'}];
 const slots=getTaskScheduleOptions(d.tasks[0],d.appointments,at);
 assert.ok(slots.every(s=>s.date!=='2026-11-23'));
});
test('nunca propõe horário passado nem posterior ao prazo; permite pedir amanhã',()=>{
 const d=data();const slots=getTaskScheduleOptions(d.tasks[0],[],at,'posso fazer essa tarefa amanhã?');
 assert.ok(slots.length>0);assert.ok(slots.every(s=>s.date==='2026-11-24'));
 d.tasks[0].due='2026-11-23';
 assert.deepEqual(getTaskScheduleOptions(d.tasks[0],[],at,'posso fazer essa tarefa amanhã?'),[]);
});
test('pronomes usam a última tarefa confirmada, sem escolher entre tarefas ambíguas',()=>{
 const d=data();d.tasks.push({...d.tasks[0],id:'t2',title:'Organizar VS da REIZZOR para retorno'});
 assert.equal(findScheduledTask('que horas posso organizar VS da REIZZOR',d).ambiguous,true);
 const r=resolveAssistantCommand('Quando posso fazer essa tarefa?',d,at,{lastTaskId:'t-vs'});
 assert.equal(r.kind,'task-schedule');assert.equal(r.taskId,'t-vs');
});
test('consulta sem referência não finge conhecer a tarefa',()=>{
 const d=data();d.tasks.push({...d.tasks[0],id:'t3',title:'Editar guitarra'});
 const r=resolveAssistantCommand('Que horas posso organizar?',d,at);
 assert.equal(r.kind,'answer');assert.match(r.message,/Qual tarefa/);
});
test('só abre a revisão, nunca salva automaticamente, e pode lembrar a tarefa recém-criada',()=>{
 const d=data(),calls=[];
 const c=createAssistantController({data:()=>d,page:()=> 'inicio',escape:s=>String(s),icon:()=>'',refresh:()=>{},toast:()=>{},navigate:()=>{},completeTask:()=>{},prepareTask:()=>{},prepareAppointment:p=>calls.push(p)});
 c.rememberTask('t-vs');
 c.action({dataset:{action:'assistant-example',query:'Quando posso fazer essa tarefa?'}});
 assert.match(c.render(),/assistant-use-task-slot/);
 assert.equal(calls.length,0);
 c.action({dataset:{action:'assistant-use-task-slot',index:'0'}});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].taskIds,['t-vs']);
 assert.equal(calls[0].title,'Executar: Organizar VS da REIZZOR antes do ensaio');
 assert.equal(d.appointments.length,1);
});
