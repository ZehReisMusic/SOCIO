// V003.8: recorte local de Hoje e dos próximos sete dias.
// Somente leitura: não cria nem modifica compromissos e tarefas.
import {dateKey} from './logic.js';
import {sortAppointments} from './agenda.js';

export function agendaDayKeys(now = new Date(), count = 7) {
  return Array.from({length:count}, (_,i) =>
    dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)));
}

export function buildAgendaOverview(source, now = new Date()) {
  const days = agendaDayKeys(now);
  const today = days[0];
  const last = days[days.length - 1];
  const appointments = sortAppointments((source.appointments || []).filter(a =>
    a && a.status !== 'done' && typeof a.date === 'string'));
  const tasks = (source.tasks || []).filter(t =>
    t && t.status !== 'done' && typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due));
  const byDue = (a,b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title);
  return {
    today,
    overdueAppointments: appointments.filter(a => a.date < today),
    overdueTasks: tasks.filter(t => t.due < today).sort(byDue),
    todayAppointments: appointments.filter(a => a.date === today),
    todayTasks: tasks.filter(t => t.due === today).sort(byDue),
    week: days.map(date => ({
      date,
      appointments: appointments.filter(a => a.date === date),
      tasks: tasks.filter(t => t.due === date).sort(byDue)
    })),
    laterCount: appointments.filter(a => a.date > last).length
  };
}
