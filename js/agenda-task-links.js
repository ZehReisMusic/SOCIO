/** Etapa 04: relações locais entre Agenda e tarefas, sem automações destrutivas. */
const MAX_LINKS = 50;
const appointmentKey = a => String(a.date || '') + 'T' + String(a.time || '');

export function linkedTaskIds(appointment, tasks = []) {
  const valid = new Set(tasks.map(item => typeof item === 'string' ? item : item?.id).filter(Boolean));
  const raw = Array.isArray(appointment?.taskIds) ? appointment.taskIds
    : appointment?.taskId ? [appointment.taskId] : [];
  return [...new Set(raw.filter(id => typeof id === 'string' && valid.has(id)))].slice(0, MAX_LINKS);
}

export function linkedTasks(appointment, tasks = []) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  return linkedTaskIds(appointment, tasks).map(id => byId.get(id)).filter(Boolean);
}

export function relatedAppointments(taskId, appointments = []) {
  if (!taskId) return [];
  return appointments.filter(a => a && a.status !== 'done' &&
    (Array.isArray(a.taskIds) ? a.taskIds.includes(taskId) : a.taskId === taskId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(a.time || ''))
    .sort((a, b) => appointmentKey(a).localeCompare(appointmentKey(b)));
}

/** O compromisso mais próximo ainda futuro. Não altera datas, prazos ou estados. */
export function preparationContext(task, appointments = [], now = new Date()) {
  if (!task?.id || task.status === 'done') return null;
  const current = now.getTime();
  if (!Number.isFinite(current)) return null;
  for (const appointment of relatedAppointments(task.id, appointments)) {
    const start = new Date(appointment.date + 'T' + appointment.time + ':00');
    if (!Number.isFinite(start.getTime())) continue;
    // Datas inválidas (ex.: 31/02) nunca devem influenciar prioridades.
    if (start.getFullYear() !== Number(appointment.date.slice(0, 4)) ||
        start.getMonth() + 1 !== Number(appointment.date.slice(5, 7)) ||
        start.getDate() !== Number(appointment.date.slice(8, 10))) continue;
    const diff = start.getTime() - current;
    if (diff < 0) continue;
    const minutesUntil = Math.ceil(diff / 60000);
    const bonus = diff <= 24 * 3600000 ? 12
      : diff <= 3 * 86400000 ? 8
      : diff <= 7 * 86400000 ? 5
      : diff <= 14 * 86400000 ? 2 : 0;
    const label = diff < 24 * 3600000 ? 'nas próximas 24 horas'
      : diff < 3 * 86400000 ? 'nos próximos 3 dias'
      : diff < 7 * 86400000 ? 'nos próximos 7 dias'
      : diff <= 14 * 86400000 ? 'nos próximos 14 dias' : 'mais adiante';
    return {appointment, minutesUntil, bonus, label};
  }
  return null;
}
