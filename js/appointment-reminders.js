// V003.9 · Lembretes individuais. Cálculos locais, sem conversão para UTC fixo.
export const REMINDER_MINUTES=[0,10,30,60];
export function normalizeReminderMinutes(value) {
  if(value===0||value==='0') return 0;
  const minutes=Number(value);
  return [10,30,60].includes(minutes)?minutes:30;
}
export function reminderLabel(minutes) {
  const n=normalizeReminderMinutes(minutes);
  if(n===0) return 'Sem lembrete';
  return n===60?'1 hora antes':n+' minutos antes';
}
export function appointmentReminderEntry(a) {
  if(!a||a.status==='done'||normalizeReminderMinutes(a.reminderMinutes)===0)return null;
  const date=String(a.date||''),time=String(a.time||'');
  if(!/^\d{4}-\d\d-\d\d$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
  const [year,month,day]=date.split('-').map(Number);
  const [hours,minutes]=time.split(':').map(Number);
  const starts=new Date(year,month-1,day,hours,minutes);
  if(starts.getFullYear()!==year||starts.getMonth()!==month-1||starts.getDate()!==day||starts.getHours()!==hours||starts.getMinutes()!==minutes)return null;
  const suffix=String(a.id||'').replace(/[^\w-]/g,'').slice(0,80);
  if(!suffix)return null;
  const lead=normalizeReminderMinutes(a.reminderMinutes);
  return {id:'agenda-'+suffix,dueAt:new Date(starts.getTime()-lead*60000).toISOString(),
    title:'Compromisso em '+(lead===60?'1 hora':lead+' minutos')+': '+String(a.title||'Compromisso').slice(0,75),
    minutes:lead};
}
export function appointmentReminderStatus(a, settings={}, now=new Date()) {
  const minutes=normalizeReminderMinutes(a?.reminderMinutes);
  if(minutes===0)return {kind:'off',label:'Sem lembrete'};
  if(a?.status==='done')return {kind:'off',label:'Compromisso concluído'};
  const job=appointmentReminderEntry(a);
  if(!job)return {kind:'off',label:'Confira data e horário'};
  if(!settings.enabled)return {kind:'disabled',label:'Web Push não conectado'};
  if(!settings.agendaAlerts)return {kind:'disabled',label:'Ative avisos de agenda em Ajustes'};
  const when=Date.parse(job.dueAt),clock=now.getTime();
  if(when<clock-600000)return {kind:'expired',label:'Horário do aviso já passou'};
  if(when>clock+14*86400000)return {kind:'later',label:'Aguardando janela de 14 dias'};
  const matched=Array.isArray(settings.syncedReminders)&&settings.syncedReminders.some(r=>r.id===job.id&&r.dueAt===job.dueAt);
  const at=new Date(when).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(matched)return {kind:'synced',label:'Sincronizado com Cloudflare · '+at,at};
  return {kind:'pending',label:'Aguardando sincronização com Cloudflare'};
}
