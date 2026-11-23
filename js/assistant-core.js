/** MEU SÓCIO V003.23 — Assistente operacional determinístico (sem IA/API).
 * Interpreta apenas intenções conhecidas. Nunca altera registros. */
import {dateKey,dueMeta,rankTasks,reasonFor} from './logic.js';
import {availableTimeContext,selectTaskForTime} from './time-aware.js';
import {sortAppointments,appointmentDateTime,parseVoiceAppointment} from './agenda.js';
import {parseVoiceTask} from './task-voice.js';
import {calculateQuote} from './soundline-core.js';

export function normalizeAssistantPhrase(input){
 return String(input??'').toLocaleLowerCase('pt-BR').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[!?.,;:]+/g,' ').replace(/\s+/g,' ').trim();
}
export function stripAssistantWakeword(input){
 return String(input??'').trim().replace(/^\s*(?:(?:ei|ola|oi)\s+)?(?:meu\s+)?s[oó]cio[,.!?:\s-]*/i,'').trim();
}
const reply=(message,options={})=>({kind:'answer',message,...options});
const taskLabel=(tasks,n=3)=>tasks.slice(0,n).map((t,i)=>(i+1)+': '+t.title).join('; ');
const sameDay=(d,now)=>d===dateKey(now);
const minutesFor=t=>Number.isFinite(Number(t?.minutes))&&Number(t.minutes)>0?Math.ceil(Number(t.minutes)):20;
const accessibleBusinesses=data=>Array.isArray(data?.businesses)?data.businesses:[];
const openTasks=data=>Array.isArray(data?.tasks)?data.tasks.filter(t=>t.status!=='done'):[];
const activeAppointments=data=>Array.isArray(data?.appointments)?data.appointments.filter(a=>a?.status!=='done'&&a.date&&a.time):[];
const getBusiness=(data,id)=>accessibleBusinesses(data).find(b=>b.id===id);
function timespan(command){
 const m=command.match(/\b(?:em|de|durante|tenho|com)\s*(\d{1,3})\s*(minutos?|mins?|horas?|h)\b/);
 if(!m)return null;
 const n=Number(m[1])*(m[2].startsWith('hora')||m[2]==='h'?60:1);
 return n>=5&&n<=480?n:null;
}
function taskReference(input, data,context={}){
 const norm=normalizeAssistantPhrase(input);
 const tasks=openTasks(data);
 if(/\b(?:essa|esta|a)\s+tarefa\b|\b(?:ela|isso)\b/.test(norm)){
  const found=tasks.find(t=>t.id===context.lastTaskId);
  if(found)return {task:found,ambiguous:false};
 }
 let cleaned=norm.replace(/^(?:(?:socio\s+)?(?:marque|marcar|marca|conclui|concluir|conclua|finalizar|finalize|terminei|finalizei|dei como concluida)\s*)+/,'')
   .replace(/^(?:a\s+)?tarefa\s+/,'')
   .replace(/\s+(?:como\s+)?(?:concluida|concluido|feita|feito|finalizada|finalizado)\b/g,'').trim();
 // Não assuma a primeira tarefa quando a fala está vaga.
 if(!cleaned||/^(?:essa|esta|a)?\s*tarefa$/.test(cleaned))return {task:null,ambiguous:false};
 const exact=tasks.filter(t=>normalizeAssistantPhrase(t.title)===cleaned);
 if(exact.length===1)return {task:exact[0],ambiguous:false};
 const matches=tasks.filter(t=>normalizeAssistantPhrase(t.title).includes(cleaned)&&cleaned.length>=5);
 if(matches.length===1)return {task:matches[0],ambiguous:false};
 return {task:null,ambiguous:matches.length>1};
}

export function resolveAssistantCommand(input,data,now=new Date(),context={}){
 const raw=stripAssistantWakeword(input);
 const q=normalizeAssistantPhrase(raw);
 if(!q)return reply('Pode perguntar sobre sua prioridade, tarefas, agenda ou orçamentos. Também posso preparar uma tarefa ou compromisso para você confirmar.');

 // As intenções de escrita são conservadoras: abrir formulário de revisão ou pedir confirmação.
 if(/^(?:marque|marcar|conclua|concluir|conclui|finalize|finalizar|finalizei|terminei)\b/.test(q) &&
    /\b(tarefa|concluid|finaliz|terminei|finalizei|feita|feito)\b/.test(q)){
  const result=taskReference(raw,data,context);
  if(!result.task)return reply(result.ambiguous?
   'Encontrei mais de uma tarefa parecida. Diga o nome completo para eu identificar a correta.':
   'Qual tarefa você quer concluir? Diga o nome dela, ou pergunte primeiro qual é sua prioridade.');
  return {kind:'confirm-complete',taskId:result.task.id,
    message:'Encontrei a tarefa "'+result.task.title+'". Posso marcá-la como concluída?',lastTaskId:result.task.id};
 }
 if(/\b(?:criar|crie|cadastrar|cadastre|adicionar|adicione|anotar|anote|registrar|registre)\b.*\btarefa\b/.test(q)||
    /^(?:nova tarefa)\b/.test(q)){
   const p=parseVoiceTask(raw,accessibleBusinesses(data),now);
   if(!p.title||p.title.length<3)return reply('Descreva a tarefa que deseja criar, por exemplo: criar tarefa para retornar ao cliente amanhã.');
   return {kind:'prepare-task',message:'Vou abrir a nova tarefa preenchida. Confira os campos e confirme antes de salvar.',transcript:raw};
 }
 if(/\b(?:agendar|agende|marcar|marque)\b.*\b(?:reuniao|compromisso|consulta|visita|horario|encontro)\b/.test(q)||
    /\b(?:criar|crie|novo|nova)\s+compromisso\b/.test(q)||
    /^coloque na agenda\b/.test(q)){
   const p=parseVoiceAppointment(raw,now);
   if(!p.title||p.title.length<3)return reply('Descreva o compromisso, com data e horário, para eu preparar a revisão na Agenda.');
   return {kind:'prepare-appointment',message:'Vou preparar o compromisso. Confira data e horário antes de salvar.',
     prefill:{title:p.title,date:p.date,time:p.time}};
 }
 if(/\b(?:criar|crie|novo|nova|fazer|preparar)\s+(?:um\s+|uma\s+)?orcamento\b/.test(q))
  return {kind:'open-soundline',message:'Vou abrir a SOUNDLINE para você criar e revisar seu orçamento.'};

 // Primeiro as perguntas específicas, depois comandos mais amplos.
 if(/\b(?:orcam(?:ento|entos)|propostas?)\b/.test(q)){
  const quotes=Array.isArray(data?.soundline?.quotes)?data.soundline.quotes:[];
  if(!quotes.length)return reply('Ainda não há orçamentos registrados na SOUNDLINE. Você pode começar em Negócios, SOUNDLINE.');
  const sent=quotes.filter(v=>v.status==='enviado'),draft=quotes.filter(v=>v.status==='rascunho'),
   approved=quotes.filter(v=>v.status==='aprovado');
  const latest=sent.slice().sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'')).slice(0,2);
  let message='Na SOUNDLINE há '+sent.length+' orçamento'+(sent.length===1?' enviado':'s enviados')+
   ' aguardando resposta, '+draft.length+' rascunho'+(draft.length===1?'':'s')+
   ' e '+approved.length+' aprovado'+(approved.length===1?'':'s')+'.';
  if(latest.length)message+=' Aguardando resposta: '+latest.map(x=>x.clientName+' ('+x.number+')').join(', ')+'.';
  const totalValue=sent.reduce((n,v)=>n+calculateQuote(v).totalCents,0);
  return reply(message,{related:'soundline',detail:sent.length?'Valor dos produtos e entregas cobradas nos orçamentos enviados: '+(totalValue/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):''});
 }
 if(/\b(?:atrasad|vencid|fora do prazo)\w*/.test(q)){
  const overdue=openTasks(data).filter(t=>dueMeta(t.due,now).kind==='late')
   .sort((a,b)=>(a.due||'').localeCompare(b.due||''));
  if(!overdue.length)return reply('Não encontrei tarefas com prazo vencido entre as que estão abertas.');
  return reply('Há '+overdue.length+' tarefa'+(overdue.length===1?'':'s')+' atrasada'+(overdue.length===1?'':'s')+'. '+taskLabel(overdue,3)+'.',
    {related:'tarefas',lastTaskId:overdue[0].id});
 }
 const span=timespan(q);
 if(span!==null&&/\b(?:fazer|executar|cabe|posso|tarefa|tempo|tenho)\b/.test(q)){
  const ranked=rankTasks(data,now);
  const free=availableTimeContext(activeAppointments(data),now);
  if(free.status==='occupied'||free.status==='uncertain')return reply(
   free.status==='occupied'?'Há um compromisso em andamento na Agenda. Não posso confirmar uma janela livre agora.':
   'Há um compromisso anterior sem duração cadastrada. Não posso confirmar que sua agenda esteja livre agora.',
   {related:'agenda'});
  const limit=free.status==='bounded'||free.status==='too-short'?Math.min(span,free.availableMinutes):span;
  const fit=ranked.filter(t=>minutesFor(t)<=limit);
  if(!fit.length)return reply('Não encontrei uma tarefa aberta que caiba em '+limit+' minutos'+
   (free.status==='bounded'?' antes do próximo compromisso.':'.')+' Você pode revisar as durações cadastradas.');
  const t=fit[0];
  return reply('Em até '+limit+' minutos, sugiro "'+t.title+'". A duração cadastrada é de '+minutesFor(t)+
   ' minutos.'+(free.status==='bounded'?' Considerei a margem de dez minutos antes do compromisso.':
    ' A disponibilidade fora da Agenda não foi verificada.'),{related:'tarefas',lastTaskId:t.id});
 }
 if(/\b(?:quanto tempo (?:tenho|resta|falta)|tempo livre|janela (?:livre|disponivel)|quanto tempo ate)\b/.test(q)){
  const ctx=availableTimeContext(activeAppointments(data),now);
  if(ctx.status==='occupied')return reply('Você tem um compromisso cadastrado em andamento até '+ctx.endsAt+'. Não considero esse período livre.',{related:'agenda'});
  if(ctx.status==='uncertain')return reply('Existe um compromisso anterior sem duração cadastrada. Não consigo confirmar seu tempo livre.',{related:'agenda'});
  if(ctx.status==='bounded'||ctx.status==='too-short')return reply('Há cerca de '+ctx.availableMinutes+' minutos úteis antes do próximo compromisso, às '+ctx.nextAt+', já descontando dez minutos de margem.',{related:'agenda'});
  return reply('Não há próximo compromisso cadastrado para hoje. Não consigo estimar sua disponibilidade fora da Agenda.',{related:'agenda'});
 }
 if(/\b(?:proxim[oa]\s+compromisso|proxim[oa]\s+reuniao)\b/.test(q)){
  const next=activeAppointments(data).filter(a=>appointmentDateTime(a)>=now)
   .sort((a,b)=>appointmentDateTime(a)-appointmentDateTime(b))[0];
  return next?reply('Seu próximo compromisso cadastrado é "'+next.title+'", em '+
   new Date(next.date+'T12:00:00').toLocaleDateString('pt-BR')+' às '+next.time+'.',{related:'agenda'}):
   reply('Não encontrei compromissos futuros cadastrados na sua Agenda.');
 }
 if(/\b(?:agenda|compromissos?|reunioes)\b/.test(q)){
  const today=activeAppointments(data).filter(a=>sameDay(a.date,now))
   .sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(!today.length)return reply('Você não tem compromissos cadastrados para hoje na Agenda. Isso não significa que todo o dia esteja livre.');
  return reply('Hoje há '+today.length+' compromisso'+(today.length===1?'':'s')+' cadastrado'+(today.length===1?'':'s')+
   ': '+today.slice(0,3).map(a=>a.time+', '+a.title).join('; ')+'.',{related:'agenda'});
 }
 if(/\b(?:semana|ultimos sete dias|ultimos 7 dias)\b/.test(q)&&/\b(?:fiz|conclui|concluir|avancei|resultado|conquistas?|progresso|realizei|concluidas?|concluidas)\b/.test(q)){
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-6);
  const from=start.getTime();
  const done=(data?.tasks||[]).filter(t=>t.completedAt&&new Date(t.completedAt).getTime()>=from&&new Date(t.completedAt)<=now);
  const eventCount=(data?.events||[]).filter(e=>e.type==='avanco'&&new Date(e.createdAt)>=start&&new Date(e.createdAt)<=now).length;
  return reply('Nos últimos sete dias, você concluiu '+done.length+' tarefa'+(done.length===1?'':'s')+
   ' e registrou '+eventCount+' avanço'+(eventCount===1?'':'s')+' avulso'+(eventCount===1?'':'s')+'.');
 }
 if(/\b(?:o que|quais|listar|mostrar|minhas)\b.*\b(?:tarefas|atividades)\b/.test(q)&&/\b(?:hoje|pendentes?|abertas?)\b/.test(q)){
  const todayTasks=openTasks(data).filter(t=>sameDay(t.due,now));
  const ranked=rankTasks(data,now);
  if(!ranked.length)return reply('Não há tarefas disponíveis para recomendar hoje.');
  return reply(todayTasks.length?'Você tem '+todayTasks.length+' tarefa'+(todayTasks.length===1?'':'s')+' com prazo hoje: '+
   taskLabel(todayTasks,3)+'.':'Não encontrei tarefas com prazo exatamente hoje. Estas são as prioridades abertas: '+
   taskLabel(ranked,3)+'.',{related:'tarefas',lastTaskId:todayTasks[0]?.id||ranked[0]?.id});
 }
 if(/\b(?:prioridade|principal tarefa|fazer primeiro|fazer agora|comecar hoje|comecar agora|devo fazer|preciso fazer|qual tarefa)\b/.test(q)){
  const ranked=rankTasks(data,now),plan=selectTaskForTime(ranked,activeAppointments(data),now);
  if(!ranked.length)return reply('Não há tarefas disponíveis para recomendar. Cadastre uma ação ou reveja as tarefas adiadas.');
  if(plan.status==='occupied')return reply('Seu compromisso cadastrado está em andamento. Prefiro não sugerir uma tarefa como se esse tempo estivesse livre.',{related:'agenda'});
  if(plan.status==='uncertain')return reply('Há um compromisso anterior sem duração informada. Antes de indicar a próxima tarefa, confira se você está disponível.',{related:'agenda'});
  if(plan.status==='too-short'||plan.status==='no-fit')return reply('Você tem pouco tempo antes do próximo compromisso, e nenhuma tarefa cadastrada cabe nessa janela com a margem de segurança.',{related:'agenda'});
  const t=plan.task||ranked[0],business=getBusiness(data,t.businessId);
  let msg='Sua prioridade agora é "'+t.title+'". '+reasonFor(t,business,now,activeAppointments(data));
  if(plan.status==='fits')msg+=' Há cerca de '+plan.availableMinutes+' minutos úteis antes do compromisso das '+plan.nextAt+'.';
  else msg+=' Não há próximo compromisso cadastrado para hoje; isso não confirma que todo o seu tempo esteja livre.';
  return reply(msg,{related:'tarefas',lastTaskId:t.id});
 }
 if(/\b(?:abrir|abra|ir para|mostrar)\b.*\b(tarefas|agenda|soundline|negocios)\b/.test(q)){
  const section=/soundline/.test(q)?'soundline':/agenda/.test(q)?'agenda':/tarefas/.test(q)?'tarefas':'negocios';
  return {kind:'navigate',page:section,message:'Vou abrir '+(section==='soundline'?'a SOUNDLINE':section==='agenda'?'sua Agenda':section==='tarefas'?'suas Tarefas':'Meus Negócios')+'.'};
 }
 return reply('Ainda não reconheço esse comando. Posso consultar prioridades, tarefas atrasadas, agenda, orçamentos SOUNDLINE, tarefas que cabem no seu tempo e preparar novos registros para sua confirmação.');
}
