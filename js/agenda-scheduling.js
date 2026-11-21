// MEU SÓCIO V003.12 · organização de horários sem supor duração de compromissos antigos.
export const AGENDA_DURATIONS=[0,15,30,45,60,90,120,180,240];
export const normalizeAgendaDuration=value=>{
  if(value===null||value===undefined||value==='')return 0;
  const n=Number(value);
  return AGENDA_DURATIONS.includes(n)?n:0;
};
export function agendaDurationLabel(value){
  const minutes=normalizeAgendaDuration(value);
  if(minutes===0)return 'Duração não informada';
  if(minutes<60)return minutes+' min';
  return minutes%60===0?(minutes/60)+' h':Math.floor(minutes/60)+'h'+String(minutes%60).padStart(2,'0');
}
const validDate=s=>{
  if(!/^\d{4}-\d\d-\d\d$/.test(String(s||'')))return false;
  const [y,m,d]=s.split('-').map(Number);
  const check=new Date(y,m-1,d);
  return check.getFullYear()===y&&check.getMonth()===m-1&&check.getDate()===d;
};
const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s||''));
export function agendaStart(a){
  if(!validDate(a?.date)||!validTime(a?.time))return null;
  const [y,m,d]=a.date.split('-').map(Number);
  const [h,min]=a.time.split(':').map(Number);
  const start=new Date(y,m-1,d,h,min);
  if(start.getHours()!==h||start.getMinutes()!==min)return null;
  return start.getTime();
}
export function agendaIntervalsConflict(left,right){
  if(left?.status==='done'||right?.status==='done')return false;
  const ls=agendaStart(left),rs=agendaStart(right);
  if(ls===null||rs===null)return false;
  const ld=normalizeAgendaDuration(left.durationMinutes);
  const rd=normalizeAgendaDuration(right.durationMinutes);
  // Sem duração: não presumir fim. Apenas início coincidente ou início dentro de um período informado.
  if(!ld&&!rd)return ls===rs;
  if(!ld)return ls>=rs&&ls<rs+rd*60000;
  if(!rd)return rs>=ls&&rs<ls+ld*60000;
  return ls<rs+rd*60000&&rs<ls+ld*60000;
}
export function agendaConflicts(candidate,appointments=[],excludeId=''){
  return (appointments||[]).filter(a=>a&&a.id!==excludeId&&a.id!==candidate?.id&&agendaIntervalsConflict(candidate,a));
}
const clockMinute=s=>validTime(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):-1;
const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function suggestAgendaSlots(appointments=[],config={},now=new Date()){
  const date=config.date,from=clockMinute(config.from),to=clockMinute(config.to);
  const duration=Number(config.durationMinutes),limit=Math.max(1,Math.min(6,Number(config.limit)||4));
  if(!validDate(date)||from<0||to<=from||!Number.isInteger(duration)||duration<15||duration>240)return [];
  const slots=[];
  for(let m=from;m+duration<=to;m+=30){
    const candidate={date,time:fmt(m),durationMinutes:duration,status:'open'};
    const starts=agendaStart(candidate);
    if(starts===null||starts<=now.getTime())continue;
    if(agendaConflicts(candidate,appointments).length)continue;
    slots.push({date,time:candidate.time,durationMinutes:duration,endsAt:fmt(m+duration)});
    if(slots.length>=limit)break;
  }
  return slots;
}
