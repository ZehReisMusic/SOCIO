/** Etapa 05 — tempo real até compromissos cadastrados. Sem agenda externa.
 * Não assume horas de trabalho nem a duração de eventos antigos. */
import {agendaStart,normalizeAgendaDuration} from './agenda-scheduling.js';
import {dateKey} from './logic.js';

export const PREPARATION_BUFFER_MINUTES = 10;
const DAY = 86400000;
const estimated = t => Number.isFinite(Number(t?.minutes)) && Number(t.minutes)>0 ? Math.ceil(Number(t.minutes)) : 20;
const hhmm = time => new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(time);

/** Considera só registros presentes, não declara a agenda externa livre. */
export function availableTimeContext(appointments = [],now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return {status:'unknown',availableMinutes:null};
  const today=dateKey(now),present=now.getTime();
  const entries=(Array.isArray(appointments)?appointments:[])
    .filter(a=>a && a.status!=='done' && a.date===today)
    .map(a=>({appointment:a,start:agendaStart(a),duration:normalizeAgendaDuration(a.durationMinutes)}))
    .filter(e=>e.start!==null).sort((a,b)=>a.start-b.start);
  const ongoing=entries.filter(e=>e.duration>0 && e.start<=present && present<e.start+e.duration*60000);
  if(ongoing.length){
    const endsAt=new Date(Math.max(...ongoing.map(e=>e.start+e.duration*60000)));
    return {status:'occupied',availableMinutes:0,endsAt:hhmm(endsAt),appointment:ongoing[0].appointment};
  }
  // Compromisso anterior sem duração: desconhecemos se terminou.
  const uncertain=entries.find(e=>e.duration===0 && e.start<=present);
  if(uncertain)return {status:'uncertain',availableMinutes:null,appointment:uncertain.appointment};
  const next=entries.find(e=>e.start>present);
  if(!next)return {status:'unbounded',availableMinutes:null,appointment:null};
  const untilMinutes=Math.max(0,Math.floor((next.start-present)/60000));
  const availableMinutes=Math.max(0,untilMinutes-PREPARATION_BUFFER_MINUTES);
  return {status:availableMinutes<5?'too-short':'bounded',availableMinutes,
    untilMinutes,bufferMinutes:PREPARATION_BUFFER_MINUTES,
    nextAt:hhmm(new Date(next.start)),appointment:next.appointment};
}

/** A seleção real favorece o melhor trabalho QUE CAIBA; não edita tarefas. */
export function selectTaskForTime(rankedTasks=[],appointments=[],now=new Date()) {
  const ranked=Array.isArray(rankedTasks)?rankedTasks:[];
  const context=availableTimeContext(appointments,now);
  if(context.status!=='bounded')return {...context,task:context.status==='unbounded'?ranked[0]||null:null};
  const fit=ranked.find(t=>estimated(t)<=context.availableMinutes);
  return {...context,status:fit?'fits':'no-fit',task:fit||null,
    fittingCount:ranked.filter(t=>estimated(t)<=context.availableMinutes).length};
}
