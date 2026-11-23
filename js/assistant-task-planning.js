/** SÓCIO V003.30 — Sugestões de horários vinculadas a tarefas, sem salvar nada.
 * Considera apenas compromissos locais e não presume disponibilidade fora da Agenda. */
import {dateKey} from './logic.js';
import {agendaStart,normalizeAgendaDuration} from './agenda-scheduling.js';

const MINUTE=60000, BUFFER=10*MINUTE;
const DURATIONS=[15,30,45,60,90,120,180,240];
const IGNORED=new Set('que qual quando horas hora horario horarios momento dia dias posso poderia consigo conseguiria eu o a os as um uma de da do das dos para por no na nos nas meu minha me voce tem tenho tarefa tarefas atividade atividades essa esta aquela esse isso ela hoje amanha agora livre livres disponivel disponiveis melhor seria fazer executar trabalhar dedicar reservar separar encaixar arranjar tempo antes depois quanto ao e em com preciso gostaria'.split(' '));
const canonical=word=>{
 if(['razor','razer','reizer','reizzor','reisor'].includes(word))return 'reizzor';
 return word;
};
const clean=s=>String(s||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const tokens=s=>[...new Set(clean(s).split(/\s+/).map(canonical).filter(w=>w.length>1&&!IGNORED.has(w)))];
const taskMinutes=t=>{const n=Number(t?.minutes);return Number.isFinite(n)&&n>0?Math.min(240,Math.ceil(n)):20;};
export const reservationMinutes=task=>DURATIONS.find(n=>n>=taskMinutes(task))||240;
const formatMinutes=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const dateValid=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&dateKey(new Date(d+'T12:00:00'))===d;
const dateDescription=(d,now)=>d===dateKey(now)?'hoje':d===dateKey(addDays(now,1))?'amanhã':new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});

export function isTaskScheduleQuestion(q){
 const str=clean(q);
 return /\b(?:que horas|qual horario|que horario|em que horario|em qual horario|quando posso|quando consigo|quando poderia|melhor horario|horario para|encaixar na agenda|reservar um horario|separar um horario|achar um horario|encontrar um horario)\b/.test(str) &&
  /\b(?:posso|poderia|consigo|conseguiria|fazer|organizar|executar|preparar|editar|trabalhar|agendar|encaixar|reservar|separar|tarefa|atividade|vs|show)\b/.test(str);
}

export function findScheduledTask(q,data,lastTaskId=''){
 const open=(Array.isArray(data?.tasks)?data.tasks:[]).filter(t=>t&&t.status!=='done');
 const normalized=clean(q);
 const anaphora=/\b(?:essa tarefa|esta tarefa|a tarefa|aquela tarefa|essa atividade|essa acao|isso|ela)\b/.test(normalized);
 if(anaphora&&lastTaskId){
  const task=open.find(t=>t.id===lastTaskId);
  if(task)return {task,ambiguous:false};
 }
 if(anaphora&&open.length===1)return {task:open[0],ambiguous:false};
 const queryWords=tokens(q);
 const scored=open.map(task=>{
  const titleWords=tokens(task.title);
  const matches=queryWords.filter(w=>titleWords.includes(w));
  const score=matches.reduce((sum,w)=>sum+(w==='reizzor'?3:w==='vs'?2:1),0);
  return {task,score,matches:matches.length};
 }).filter(item=>item.score>=3&&item.matches>=2).sort((a,b)=>b.score-a.score);
 if(!scored.length)return {task:null,ambiguous:false};
 if(scored.length>1&&scored[0].score-scored[1].score<2)return {task:null,ambiguous:true};
 return {task:scored[0].task,ambiguous:false};
}

/** Margem conservadora de dez minutos antes e depois de compromissos com duração.
 * Se não há duração, não se sugere tempo após o início no mesmo dia. */
export function isTaskSlotAvailable(slot,appointments=[],now=new Date()){
 const start=agendaStart(slot),duration=Number(slot?.durationMinutes);
 if(start===null||!Number.isFinite(duration)||duration<15||duration>240||start<=now.getTime()+5*MINUTE)return false;
 const clock=Number(slot.time.slice(0,2))*60+Number(slot.time.slice(3));
 if(clock<9*60||clock+duration>21*60)return false;
 const end=start+duration*MINUTE;
 for(const ap of (Array.isArray(appointments)?appointments:[])){
  if(!ap||ap.status==='done')continue;
  const apStart=agendaStart(ap);
  if(apStart===null)continue;
  const apMinutes=normalizeAgendaDuration(ap.durationMinutes);
  if(apMinutes){
   const apEnd=apStart+apMinutes*MINUTE;
   if(start<apEnd+BUFFER&&end+BUFFER>apStart)return false;
  }else if(ap.date===slot.date&&(start>=apStart||end+BUFFER>apStart)){
   return false;
  }
 }
 return true;
}

export function getTaskScheduleOptions(task,appointments=[],now=new Date(),query=''){
 if(!task||task.status==='done'||!Number.isFinite(now.getTime()))return [];
 const today=dateKey(now);
 const due=dateValid(task.due)&&task.due>=today?task.due:null;
 const endDate=due&&due<dateKey(addDays(now,2))?due:dateKey(addDays(now,2));
 const q=clean(query);
 const tomorrowOnly=/\bamanha\b/.test(q)&&!/\b(?:antes do|ensaio de|show de|reuniao de)\s+amanha\b/.test(q);
 const dates=[];
 for(let n=tomorrowOnly?1:0;n<=2;n++){
  const date=dateKey(addDays(now,n));
  if(date>endDate)break;
  dates.push(date);
 }
 const length=reservationMinutes(task),slots=[];
 for(const date of dates){
  for(let minutes=9*60;minutes+length<=21*60;minutes+=30){
   const slot={date,time:formatMinutes(minutes),durationMinutes:length,endsAt:formatMinutes(minutes+length),taskId:task.id};
   if(isTaskSlotAvailable(slot,appointments,now))slots.push(slot);
   if(slots.length>=3)return slots;
  }
 }
 return slots;
}

export function planTaskSchedule(q,data,now=new Date(),context={}){
 const tasks=Array.isArray(data?.tasks)?data.tasks.filter(t=>t?.status!=='done'):[];
 if(!tasks.length)return {kind:'answer',message:'Não há tarefas abertas para encaixar na Agenda. Cadastre uma tarefa primeiro.',related:'tarefas'};
 const found=findScheduledTask(q,data,context.lastTaskId);
 if(!found.task)return {kind:'answer',message:found.ambiguous?
   'Encontrei mais de uma tarefa parecida. Diga o título completo para eu procurar um horário seguro.':
   'Qual tarefa você quer organizar? Diga o nome cadastrado ou pergunte primeiro sobre sua prioridade.',related:'tarefas'};
 const task=found.task;
 const slots=getTaskScheduleOptions(task,data?.appointments||[],now,q);
 if(!slots.length)return {kind:'answer',related:'agenda',lastTaskId:task.id,
  message:'Não encontrei horários para "'+task.title+'" na faixa de 9h às 21h, considerando o prazo e os compromissos cadastrados. Confira durações e horários na Agenda; não vou presumir que você esteja livre.'};
 const choices=slots.map(slot=>dateDescription(slot.date,now)+' às '+slot.time).join('; ');
 return {kind:'task-schedule',taskId:task.id,lastTaskId:task.id,related:'agenda',slots,
  message:'Para "'+task.title+'", sugestões de '+reservationMinutes(task)+' minutos: '+choices+'. Esses horários não conflitam com os compromissos cadastrados, mas não verificam sua disponibilidade fora do SÓCIO. Escolha uma opção para revisar na Agenda antes de salvar.'};
}
