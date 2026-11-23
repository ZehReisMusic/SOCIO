import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAssistantCommand,normalizeAssistantPhrase,stripAssistantWakeword} from '../js/assistant-core.js';
import {dateKey} from '../js/logic.js';
const at=new Date(2026,10,23,9,0,0);
const today=dateKey(at),yesterday=dateKey(new Date(2026,10,22));
const d=()=>({
 businesses:[{id:'b-soundline',name:'SOUNDLINE',status:'ativo',focus:5},
             {id:'b-estudio',name:'Estúdio',status:'manutencao',focus:2}],
 tasks:[
  {id:'a',title:'Finalizar orçamento de Carlos',businessId:'b-soundline',status:'open',impact:5,urgency:5,effort:2,minutes:30,due:today,createdAt:'2026-11-20T12:00:00Z'},
  {id:'b',title:'Comprar embalagem',businessId:'b-soundline',status:'open',impact:3,urgency:3,effort:2,minutes:10,due:yesterday,createdAt:'2026-11-21T12:00:00Z'},
  {id:'c',title:'Editar gravação',businessId:'b-estudio',status:'done',impact:3,urgency:3,effort:2,minutes:60,due:yesterday,completedAt:'2026-11-22T15:00:00Z'}
 ],
 appointments:[],soundline:{quotes:[]},skipped:{date:today,taskIds:[]},events:[]
});
const ask=(question,data=d(),options={})=>resolveAssistantCommand(question,data,at,options);
test('normaliza invocação SÓCIO sem trocar o significado',()=>{
 assert.equal(stripAssistantWakeword('Sócio, qual minha prioridade hoje?'),'qual minha prioridade hoje?');
 assert.equal(normalizeAssistantPhrase('  Orçamentos   ATRASADOS  '),'orcamentos atrasados');
});
test('prioridade consulta motor existente e devolve ID da tarefa, não escreve',()=>{
 const original=d(),before=JSON.stringify(original);
 const answer=ask('Sócio, qual minha principal tarefa para hoje?',original);
 assert.equal(answer.kind,'answer');
 assert.match(answer.message,/Finalizar orçamento de Carlos/);
 assert.equal(answer.lastTaskId,'a');
 assert.equal(JSON.stringify(original),before);
});
test('ocupação registrada impede afirmar disponibilidade fictícia',()=>{
 const x=d();x.appointments=[{date:today,time:'08:30',durationMinutes:90,status:'open',title:'Reunião'}];
 const a=ask('Qual minha prioridade agora?',x);
 assert.match(a.message,/compromisso cadastrado está em andamento/i);
 const b=ask('Quanto tempo tenho livre?',x);
 assert.match(b.message,/Não considero esse período livre/i);
});
test('compromisso sem duração anterior interrompe recomendação de tempo',()=>{
 const x=d();x.appointments=[{date:today,time:'08:30',status:'open',title:'Alinhamento'}];
 const r=ask('O que posso fazer em 30 minutos?',x);
 assert.match(r.message,/não posso confirmar/i);
});
test('sugere apenas tarefas que caibam no prazo solicitado',()=>{
 const x=d();
 const a=ask('O que posso fazer em 15 minutos?',x);
 assert.match(a.message,/Comprar embalagem/);
 assert.equal(a.lastTaskId,'b');
});
test('avisa sobre margem de dez minutos até o compromisso',()=>{
 const x=d();x.appointments=[{date:today,time:'09:20',durationMinutes:30,status:'open',title:'Ligação'}];
 const r=ask('Quanto tempo tenho livre?',x);
 assert.match(r.message,/10 minutos úteis/);
});
test('tarefas atrasadas não incluem concluídas',()=>{
 const a=ask('Quais tarefas estão atrasadas?');
 assert.match(a.message,/Comprar embalagem/);
 assert.doesNotMatch(a.message,/Editar gravação/);
});
test('compromissos de hoje e próximo compromisso são separados',()=>{
 const x=d();x.appointments=[{date:today,time:'10:30',durationMinutes:60,status:'open',title:'Fornecedor'}];
 assert.match(ask('Quais compromissos tenho hoje?',x).message,/10:30, Fornecedor/);
 assert.match(ask('Qual é o próximo compromisso?',x).message,/Fornecedor/);
});
test('orçamentos pendentes vêm apenas dos registros reais SOUNDLINE',()=>{
 const x=d();x.soundline.quotes=[
  {id:'q1',number:'SL-2026-0001',clientName:'Carlos',status:'enviado',channel:'direto',items:[],pricing:{markupPct:100,minMarkupPct:100},productPriceCents:10000,delivery:{mode:'retirada',quotedCents:null}},
  {id:'q2',number:'SL-2026-0002',clientName:'Ana',status:'rascunho',channel:'direto',items:[],pricing:{markupPct:100,minMarkupPct:100},productPriceCents:10000,delivery:{mode:'retirada',quotedCents:null}}
 ];
 const r=ask('Quais orçamentos estão pendentes?',x);
 assert.match(r.message,/1 orçamento enviado/);assert.match(r.message,/1 rascunho/);
 assert.match(r.message,/Carlos/);assert.doesNotMatch(r.message,/Ana \(/);
});
test('prepara tarefas e reuniões sem salvar dados',()=>{
 const x=d(),snapshot=JSON.stringify(x);
 const task=ask('Sócio, crie uma tarefa para retornar ao cliente amanhã',x);
 assert.equal(task.kind,'prepare-task');assert.match(task.transcript,/crie uma tarefa/);
 const appt=ask('Marcar reunião amanhã às 15 horas',x);
 assert.equal(appt.kind,'prepare-appointment');
 assert.equal(appt.prefill.date,'2026-11-24');assert.equal(appt.prefill.time,'15:00');
 assert.equal(JSON.stringify(x),snapshot);
});
test('conclusão pede confirmação e jamais altera status sem ela',()=>{
 const x=d(),r=ask('Marcar essa tarefa como concluída',x,{lastTaskId:'a'});
 assert.equal(r.kind,'confirm-complete');assert.equal(r.taskId,'a');
 assert.equal(x.tasks[0].status,'open');
 const unknown=ask('Marcar essa tarefa como concluída',x);
 assert.match(unknown.message,/Qual tarefa/);
});
test('não supõe tarefa certa quando a referência é ambígua',()=>{
 const x=d();x.tasks.push({...x.tasks[0],id:'d',title:'Finalizar orçamento de Carla'});
 const r=ask('Concluir orçamento',x);
 assert.equal(r.kind,'answer');assert.match(r.message,/mais de uma tarefa/);
});
test('relato semanal não inventa resultados',()=>{
 const r=ask('O que consegui concluir nesta semana?');
 assert.match(r.message,/1 tarefa/);
});
test('desconhecido não executa comando e informa escopo',()=>{
 const r=ask('Sócio, faça uma análise psicológica profunda');
 assert.equal(r.kind,'answer');assert.match(r.message,/Ainda não reconheço esse comando/);
});
test('abrir área e criar orçamento não alteram as listas',()=>{
 assert.equal(ask('Abra SOUNDLINE').page,'soundline');
 assert.equal(ask('Criar orçamento').kind,'open-soundline');
});
