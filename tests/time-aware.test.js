import test from 'node:test';
import assert from 'node:assert/strict';
import {availableTimeContext,selectTaskForTime} from '../js/time-aware.js';
import {seedData,rankTasks} from '../js/logic.js';
const now=new Date(2026,10,22,15,0);
const meeting=(time,durationMinutes=60,status='open')=>({id:'a',title:'Reunião',date:'2026-11-22',time,durationMinutes,status});
test('intervalo real desconta margem de preparação, não supõe fim de agenda',()=>{
 const c=availableTimeContext([meeting('16:00')],now);
 assert.equal(c.status,'bounded'); assert.equal(c.availableMinutes,50);
 assert.equal(c.nextAt,'16:00');assert.equal(c.bufferMinutes,10);
 assert.equal(availableTimeContext([],now).status,'unbounded');
});
test('compromisso concluído não restringe disponibilidade',()=>{
 assert.equal(availableTimeContext([meeting('15:30',60,'done')],now).status,'unbounded');
});
test('evento em andamento com duração conhecida bloqueia sugestões',()=>{
 const c=availableTimeContext([meeting('14:30',60)],now);
 assert.equal(c.status,'occupied');assert.equal(c.endsAt,'15:30');
 assert.equal(selectTaskForTime([{id:'t',minutes:5}],[meeting('14:30',60)],now).task,null);
});
test('compromisso sem duração passada não é interpretado como tempo livre',()=>{
 const c=availableTimeContext([meeting('14:30',0),meeting('17:00')],now);
 assert.equal(c.status,'uncertain');assert.equal(c.availableMinutes,null);
});
test('tarefa curta substitui tarefa de maior prioridade que não cabe',()=>{
 const ranked=[{id:'grande',minutes:90},{id:'curta',minutes:20}];
 const plan=selectTaskForTime(ranked,[meeting('15:45')],now);
 assert.equal(plan.status,'fits');assert.equal(plan.task.id,'curta');assert.equal(plan.availableMinutes,35);
 assert.deepEqual(ranked.map(t=>t.id),['grande','curta']);
});
test('sem tarefa que caiba, não inventa tempo e não inicia tarefa longa',()=>{
 const plan=selectTaskForTime([{id:'grande',minutes:90}],[meeting('15:30')],now);
 assert.equal(plan.status,'no-fit');assert.equal(plan.task,null);
 const zero=selectTaskForTime([{id:'pequena',minutes:5}],[meeting('15:10')],now);
 assert.equal(zero.status,'too-short');assert.equal(zero.task,null);
});
test('sem compromisso futuro, preserva ranking normal sem inventar janela',()=>{
 const data=seedData(now),ranked=rankTasks(data,now);
 const p=selectTaskForTime(ranked,[],now);
 assert.equal(p.status,'unbounded');assert.equal(p.task.id,ranked[0].id);
 assert.equal(p.availableMinutes,null);
});
test('evento de outro dia não restringe hoje',()=>{
 const a={...meeting('16:00'),date:'2026-11-23'};
 assert.equal(availableTimeContext([a],now).status,'unbounded');
});
test('fronteiras e horários inválidos não geram disponibilidade falsa',()=>{
 const a={...meeting('16:00'),date:'2026-11-22',time:'25:00'};
 assert.equal(availableTimeContext([a],now).status,'unbounded');
 const plan=selectTaskForTime([{id:'t',minutes:40}],[meeting('15:59')],now);
 assert.equal(plan.availableMinutes,49);assert.equal(plan.task.id,'t');
});
