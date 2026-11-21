import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaDayKeys,buildAgendaOverview} from '../js/agenda-overview.js';

test('semana de sete dias atravessa mês e usa datas locais',()=>{
  assert.deepEqual(agendaDayKeys(new Date(2026,10,28,23,0)),[
    '2026-11-28','2026-11-29','2026-11-30','2026-12-01',
    '2026-12-02','2026-12-03','2026-12-04']);
});
test('hoje, atrasados e semana não incluem tarefas e compromissos concluídos',()=>{
  const source={
    appointments:[
      {id:'a1',title:'Antes',date:'2026-11-20',time:'09:00',status:'open'},
      {id:'a2',title:'Hoje',date:'2026-11-21',time:'14:00',status:'open'},
      {id:'a3',title:'Semana',date:'2026-11-24',time:'10:00',status:'open'},
      {id:'a4',title:'Feito',date:'2026-11-21',time:'08:00',status:'done'},
      {id:'a5',title:'Depois',date:'2026-12-10',time:'10:00',status:'open'}],
    tasks:[
      {id:'t1',title:'Vencida',due:'2026-11-19',status:'open'},
      {id:'t2',title:'Entrega',due:'2026-11-21',status:'open'},
      {id:'t3',title:'Futuro',due:'2026-11-23',status:'open'},
      {id:'t4',title:'Sem prazo',due:'',status:'open'},
      {id:'t5',title:'Concluída',due:'2026-11-21',status:'done'}]
  };
  const original=JSON.stringify(source);
  const view=buildAgendaOverview(source,new Date(2026,10,21,12,0));
  assert.equal(view.today,'2026-11-21');
  assert.deepEqual(view.overdueAppointments.map(a=>a.id),['a1']);
  assert.deepEqual(view.overdueTasks.map(t=>t.id),['t1']);
  assert.deepEqual(view.todayAppointments.map(a=>a.id),['a2']);
  assert.deepEqual(view.todayTasks.map(t=>t.id),['t2']);
  assert.deepEqual(view.week[2].tasks.map(t=>t.id),['t3']);
  assert.deepEqual(view.week[3].appointments.map(a=>a.id),['a3']);
  assert.equal(view.week.length,7);
  assert.equal(view.laterCount,1);
  assert.equal(JSON.stringify(source),original);
});
