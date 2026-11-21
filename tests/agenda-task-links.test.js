import test from 'node:test';
import assert from 'node:assert/strict';
import {linkedTaskIds, linkedTasks, relatedAppointments, preparationContext} from '../js/agenda-task-links.js';
import {seedData, rankTasks, reasonFor, scoreTask} from '../js/logic.js';
import {validateData} from '../js/store.js';

const now = new Date(2026, 10, 21, 12, 0);
const tasks = [{id:'t-1',title:'Proposta',status:'open'},{id:'t-2',title:'Revisar',status:'done'}];
const a = (date,time,taskIds,status='open') => ({id:'a',title:'Reunião',date,time,taskIds,status});
test('migração mantém vínculo legado e cria formato plural idempotente', () => {
  const d = seedData(now); d.appointments = [{id:'a-1',title:'Reunião',date:'2026-11-23',time:'10:00',taskId:d.tasks[0].id}];
  const clean = validateData(d);
  assert.deepEqual(clean.appointments[0].taskIds,[d.tasks[0].id]);
  assert.equal(clean.appointments[0].taskId,d.tasks[0].id);
  assert.deepEqual(validateData(clean).appointments,clean.appointments);
});
test('lista com múltiplas tarefas persiste e preserva legado', () => {
  const d = seedData(now); d.appointments = [{id:'a-1',title:'Reunião',date:'2026-11-23',time:'10:00',taskIds:d.tasks.map(t=>t.id),taskId:d.tasks[0].id}];
  const out = validateData(d);
  assert.deepEqual(out.appointments[0].taskIds, d.tasks.map(t=>t.id));
  assert.equal(out.appointments[0].taskId,d.tasks[0].id);
});
test('vínculos inválidos e duplicados são removidos sem alterar tarefas', () => {
  const original=JSON.stringify(tasks);
  assert.deepEqual(linkedTaskIds({taskIds:['t-1','inexistente','t-1','t-2']},tasks),['t-1','t-2']);
  assert.deepEqual(linkedTasks({taskIds:['t-2','t-1']},tasks).map(t=>t.id),['t-2','t-1']);
  assert.equal(JSON.stringify(tasks), original);
});
test('lista plural vazia remove vínculo legado sem reaparecer', () => {
  const d=seedData(now);d.appointments=[{id:'a',title:'R',date:'2026-11-23',time:'10:00',taskIds:[],taskId:d.tasks[0].id}];
  const out=validateData(d);
  assert.deepEqual(out.appointments[0].taskIds,[]);
  assert.equal(out.appointments[0].taskId,'');
});
test('referências de tarefas inexistentes são limpas na importação',()=>{
  const d=seedData(now);d.appointments=[{id:'a',title:'R',date:'2026-11-23',time:'10:00',taskIds:[d.tasks[0].id,'desconhecida']}];
  assert.deepEqual(validateData(d).appointments[0].taskIds,[d.tasks[0].id]);
});
test('só compromissos abertos e vinculados entram no contexto', () => {
  const list=[a('2026-11-22','10:00',['t-1']),a('2026-11-21','13:00',['t-1'],'done'),a('2026-11-21','14:00',['t-2'])];
  assert.equal(relatedAppointments('t-1',list).length,1);
  assert.equal(preparationContext(tasks[0],list,now)?.bonus,12);
  assert.equal(preparationContext(tasks[1],list,now),null);
});
test('compromissos vencidos não priorizam tarefa', () => {
  assert.equal(preparationContext(tasks[0],[a('2026-11-20','18:00',['t-1'])],now),null);
  assert.equal(preparationContext(tasks[0],[a('2026-11-21','11:00',['t-1'])],now),null);
});
test('pontuação cresce com compromisso próximo e retorna à normalidade ao concluir evento', () => {
  const d=seedData(now);const t=d.tasks[1];t.urgency=1;
  const base=scoreTask(t,d.businesses[0],now);
  d.appointments=[a('2026-11-22','10:00',[t.id])];
  assert.equal(scoreTask(t,d.businesses[0],now,d.appointments),base+12);
  assert.match(reasonFor(t,d.businesses[0],now,d.appointments),/antes do compromisso/i);
  d.appointments[0].status='done';
  assert.equal(scoreTask(t,d.businesses[0],now,d.appointments),base);
});
test('foco respeita adiar tarefa e ignora compromissos já realizados',()=>{
  const d=seedData(now);
  d.tasks[0].urgency=1;d.tasks[0].impact=1;
  d.appointments=[a('2026-11-21','16:00',[d.tasks[1].id])];
  assert.equal(rankTasks(d,now)[0].id,d.tasks[1].id);
  d.skipped={date:'2026-11-21',taskIds:[d.tasks[1].id]};
  assert.equal(rankTasks(d,now)[0].id,d.tasks[0].id);
});
test('tarefas concluídas e compromissos longínquos não ganham bônus',()=>{
  assert.equal(preparationContext(tasks[1],[a('2026-11-22','09:00',['t-2'])],now),null);
  assert.equal(preparationContext(tasks[0],[a('2026-12-20','09:00',['t-1'])],now).bonus,0);
});
test('limite de relações por compromisso protege o backup e o formulário',()=>{
  const many=Array.from({length:70},(_,i)=>'t-'+i);
  assert.equal(linkedTaskIds({taskIds:many},many).length,50);
});
