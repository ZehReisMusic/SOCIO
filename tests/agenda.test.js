import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceAppointment,sortAppointments} from '../js/agenda.js';
const date=new Date(2026,10,19,10,0); // quinta-feira, 19/11/2026
const cases=[
 ['Marcar reunião com fornecedor amanhã às 15 horas','2026-11-20','15:00','Reunião com fornecedor'],
 ['Agendar dentista dia 25 de novembro às 9h30','2026-11-25','09:30','Dentista'],
 ['Ligar para o contador na sexta às quinze horas','2026-11-20','15:00','Ligar para o contador'],
 ['Reunião hoje às 14:45','2026-11-19','14:45','Reunião'],
 ['Reunião dia 03 de dezembro às 10h','2026-12-03','10:00','Reunião'],
 ['Ligar dia 29 às 16 horas','2026-11-29','16:00','Ligar'],
 ['Visita 21/11 às 8h da noite','2026-11-21','20:00','Visita'],
 ['Consulta depois de amanhã às 8h','2026-11-21','08:00','Consulta']
];
for(const [input,day,time,title] of cases){test(`interpreta: ${input}`,()=>{const r=parseVoiceAppointment(input,date);assert.equal(r.date,day);assert.equal(r.time,time);assert.equal(r.title,title);});}
test('faltam dados? não inventa hora',()=>{const r=parseVoiceAppointment('Agendar revisão com fornecedor',date);assert.equal(r.time,'');assert.equal(r.date,'');assert.equal(r.title,'Revisão com fornecedor');});
test('ordena os compromissos',()=>{assert.equal(sortAppointments([{date:'2026-11-20',time:'13:00'},{date:'2026-11-19',time:'18:00'}])[0].date,'2026-11-19');});
