import {BUSINESS_STATES,BUSINESS_COLORS,newId,dateKey,niceDate,todayFull,htmlEscape as esc,scoreTask,dueMeta,rankTasks,recommend,reasonFor,stats,seedData} from './logic.js';
import {STORAGE_KEY,readData,writeData,validateData,downloadJson} from './store.js';
import {parseVoiceAppointment,sortAppointments,appointmentDateTime} from './agenda.js';
import {buildAgendaOverview} from './agenda-overview.js';
import {normalizeReminderMinutes,reminderLabel} from './appointment-reminders.js';
import {normalizeAgendaDuration,agendaDurationLabel,agendaConflicts,suggestAgendaSlots} from './agenda-scheduling.js';
import {APP_VERSION,initUpdates,checkForUpdates,applyDeferredUpdate} from './updater.js';
import {renderPushSettings,initPush,enablePush,syncPush,updatePushTime,testPush,schedulePushDiagnostic,savePushPreferences,disablePush,agendaReminderStatus} from './push.js';
import {STATION_STATUSES,renderStationContent} from './reizzor-station.js';

const icons={
  inicio:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h5"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
  negocios:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  tarefas:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  executar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  historico:'<path d="M3 12a9 9 0 1 0 3-6.7M3 3v5h5M12 7v5l3.5 2"/>',
  ajustes:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 2-.1-.1a1.7 1.7 0 0 0-1.9-.3l-.3.1V21h-3v-.2a1.7 1.7 0 0 0-1.4-1.7H9a1.7 1.7 0 0 0-1.9.3l-.1.1-2-2 .1-.1a1.7 1.7 0 0 0 .3-1.9l-.1-.3H3v-3h.2A1.7 1.7 0 0 0 5 10.7L4.9 10l-1.4-1 2-2L7 8.1a1.7 1.7 0 0 0 1.9.3l.1-.1V5h3v.2a1.7 1.7 0 0 0 1.4 1.7l.6.1A1.7 1.7 0 0 0 16 6.7l1.1-.5 2 2-1.1 1.1a1.7 1.7 0 0 0-.3 1.9l.1.3H21v3h-1.8z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',right:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',arrow:'<path d="m9 18 6-6-6-6"/>',edit:'<path d="m14 4 6 6M3 21l4.5-1 12-12a2.1 2.1 0 0 0-3-3l-12 12L3 21z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',upload:'<path d="M12 17V5m-4 4 4-4 4 4M4 17v4h16v-4"/>',delete:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',star:'<path d="m12 2 3 6.5 7 1-5 5 .9 7.3-5.9-3.4-5.9 3.4L7 14.5l-5-5 7-1z"/>',trend:'<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',coffee:'<path d="M4 8h13v7a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 9h2a3 3 0 0 1 0 6h-2M4 4h12"/>',spark:'<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2z"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',note:'<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',pause:'<path d="M7 4v16M17 4v16"/>',shield:'<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'};
const svg=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.star}</svg>`;
const $=id=>document.getElementById(id);
let data=readData(),page='inicio',taskFilter='all',toastTimer=null,voiceSession=null,stationSongId='',agendaPeriod='hoje',agendaAllOpen=false,agendaAvailability={open:false,date:dateKey(),from:'09:00',to:'21:00',durationMinutes:60,results:null};
const routes=[['inicio','Início'],['negocios','Negócios'],['tarefas','Tarefas'],['agenda','Minha Agenda'],['executar','Executar'],['historico','Histórico'],['ajustes','Ajustes']];
const business=id=>data.businesses.find(b=>b.id===id);
const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(s=>s.charAt(0)).join('').toUpperCase();
const businessIcon=b=>`<div class="b-icon" style="--item-color:${BUSINESS_COLORS.includes(b?.color)?b.color:BUSINESS_COLORS[0]}">${esc(initials(b?.name))}</div>`;
const btn=(text,action,variant='outline',attrs='')=>`<button type="button" class="btn-${variant}" data-action="${action}" ${attrs}>${text}</button>`;
const tag=(text,extra='')=>`<span class="pill ${extra}">${text}</span>`;
function save(){if(!writeData(data)) toast('Não foi possível salvar neste dispositivo. Exporte seus dados.');render();void syncPush(data);}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function navigate(next){if(!routes.some(r=>r[0]===next)&&next!=='estacao')next='inicio';page=next;location.hash=next;render();window.scrollTo({top:0,behavior:'instant'});}
function renderNavigation(){document.body.dataset.page=page;const navHtml=routes.slice(0,5).map(([id,label])=>`<button type="button" class="nav-item ${(page===id||(page==='estacao'&&id==='negocios'))?'active':''}" data-nav="${id}" aria-current="${(page===id||(page==='estacao'&&id==='negocios'))?'page':'false'}">${svg(id)}<span class="nav-label">${label}</span>${id==='tarefas'?`<span class="nav-number">${data.tasks.filter(x=>x.status!=='done').length}</span>`:''}</button>`).join('');$('main-nav').innerHTML=navHtml;$('mobile-nav').innerHTML=routes.map(([id,label])=>`<button type="button" class="${(page===id||(page==='estacao'&&id==='negocios'))?'active':''}" data-nav="${id}" aria-label="${label}" aria-current="${(page===id||(page==='estacao'&&id==='negocios'))?'page':'false'}">${svg(id)}<span>${id==='agenda'?'Agenda':label}</span></button>`).join('');$('topbar-current').textContent=page==='estacao'?'REIZZOR STATION':routes.find(([id])=>id===page)?.[1]||'Visão geral';}
function render(){renderNavigation();$('view').innerHTML=({inicio:dashboard,negocios:businesses,tarefas:tasksView,executar:execution,historico:history,ajustes:settings,agenda:agendaView,estacao:stationView}[page]||dashboard)();}
function sectionHeader(kicker,title,subtitle,actions=''){return `<div class="eyebrow">${kicker}</div><div class="view-header"><div><h1>${title}</h1><p>${subtitle}</p></div>${actions?`<div class="view-actions">${actions}</div>`:''}</div>`;}
function metric(label,note,num,icon){return `<div class="metric"><div class="metric-heading">${svg(icon)}${label}</div><div class="metric-number">${num}</div><div class="metric-foot">${note}</div></div>`;}
function empty(title,subtitle,action='new-task',button='Criar tarefa'){return `<div class="empty"><span class="empty-symbol">${svg('spark')}</span><h3>${title}</h3><p>${subtitle}</p>${btn(`${svg('plus')} ${button}`,action,'primary')}</div>`;}
function focusCard(t,large=false){if(!t){const hasTasks=data.tasks.some(x=>x.status!=='done');return `<div class="panel focus-panel">${empty(hasTasks?'Tudo pode esperar por hoje':'Nenhuma ação pendente',hasTasks?'Você adiou as ações restantes para hoje. Amanhã elas voltam à lista automaticamente.':'Cadastre uma ação concreta para receber uma recomendação. ',hasTasks?'restore-skips':'new-task',hasTasks?'Rever ações de hoje':'Criar primeira ação')}</div>`;}
 const b=business(t.businessId),why=reasonFor(t,b),minutes=t.minutes||20;
 return `<div class="panel focus-panel"><div class="focus-label">Ação recomendada para hoje</div><h2 class="focus-title">${esc(t.title)}</h2><div class="focus-text">${esc(t.notes||b?.objective||'Dê um pequeno passo concreto nessa direção.')}</div><div class="focus-split">${tag(esc(b?.name||'Sem negócio'))}${tag(`${svg('clock',12)} ${minutes} min`,'soft-pill')}</div><div class="focus-buttons">${btn(`${svg('target')} Entrar no Modo Execução`,'start-execution','primary')}${btn('Deixar para depois','skip-task','outline',`data-id="${esc(t.id)}"`)}</div><div class="focus-footer"><b>${svg('spark',12)} POR QUE ESSA AÇÃO?</b><p>${esc(why)}</p></div></div>`;}
function businessRow(b){const open=data.tasks.filter(t=>t.businessId===b.id&&t.status==='open').length;return `<div class="business-row">${businessIcon(b)}<div class="b-content"><div class="b-title">${esc(b.name)}</div><div class="b-description">${esc(b.objective)}</div></div><span class="b-tag">${open} ${open===1?'ação':'ações'}</span><button class="icon-btn" data-action="edit-business" data-id="${esc(b.id)}" aria-label="Editar ${esc(b.name)}">${svg('edit')}</button></div>`;}
function activityRow(e){const b=business(e.businessId),types={decisao:['Decisão','ink','note'],avanco:['Avanço','', 'trend'],conclusao:['Concluída','', 'check'],agenda:['Agenda','grey','agenda'],adiamento:['Adiada','grey','clock'],reaberta:['Retomada','grey','clock'],sistema:['Sistema','grey','spark']};const [label,kind,icon]=types[e.type]||types.sistema;const dt=new Date(e.createdAt);const timestamp=Number.isNaN(dt.getTime())?'':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(dt);return `<div class="activity-row"><div class="activity-dot ${kind}">${svg(icon)}</div><div class="activity-content"><div class="activity-title">${esc(e.title)}</div><div class="activity-sub">${label}${b?` · ${esc(b.name)}`:''}${e.note?` — ${esc(e.note)}`:''}</div></div><div class="activity-date">${esc(timestamp)}</div></div>`;}
function dashboard(){
 const now=new Date(),hour=now.getHours(),greeting=hour<12?'Bom dia.':hour<18?'Boa tarde.':'Boa noite.';
 const s=stats(data),top=recommend(data),last=[...data.events].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,3);
 const businessesToShow=[...data.businesses].sort((a,b)=>b.focus-a.focus).slice(0,3);
 const available=rankTasks(data).slice(0,3),done=data.tasks.filter(x=>x.status==='done').length,total=data.tasks.length,progress=total?Math.round(done/total*100):0;
 const shortcut=(label,icon,attribute)=>`<button type="button" class="dashboard-shortcut" ${attribute}>${svg(icon,22)}<span>${label}</span></button>`;
 const quickLinks=`<div class="dashboard-shortcuts" aria-label="Acesso rápido">
  ${shortcut('Tarefas','tarefas','data-nav="tarefas"')}
  ${shortcut('Agenda','agenda','data-nav="agenda"')}
  ${shortcut('Negócios','negocios','data-nav="negocios"')}
  ${data.businesses.some(b=>b.id==='b-reizzor')?shortcut('Estação','note','data-action="open-station"'):shortcut('Histórico','historico','data-nav="historico"')}
 </div>`;
 const actionRows=available.map(t=>`<div class="home-task-item">
   <button class="home-task-check" type="button" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="Concluir ${esc(t.title)}">${svg('check',14)}</button>
   <span class="home-task-name">${esc(t.title)}</span>
 </div>`).join('');
 return `<div class="home-dashboard">
   <section class="home-hero" aria-label="Painel de produtividade">
    <div class="home-hero-art" aria-hidden="true"></div>
    <div class="home-hero-content">
     <div class="home-hero-eyebrow">MEU SÓCIO <span></span> SEU PAINEL</div>
     <h1>${greeting}</h1>
     <p>Foco, execução e resultados.<br>Vamos avançar no que importa.</p>
    </div>
    <div class="home-hero-date">${esc(todayFull(now))}</div>
   </section>
   <div class="metrics home-metrics">
    ${metric('Negócios','Em acompanhamento',s.businesses,'negocios')}
    ${metric('Ações abertas','Para avançar',s.open,'tarefas')}
    ${metric('Avanços','Já registrados',s.progress,'trend')}
   </div>
   <div class="home-primary-grid">
    ${focusCard(top)}
    <section class="home-day-card panel" aria-label="Progresso de tarefas">
     <div class="home-card-kicker">${svg('check',16)} EXECUÇÃO DO DIA</div>
     <div class="home-day-heading"><h2>Um passo de cada vez.</h2><span>${available.length===1?'1 disponível':available.length+' disponíveis'}</span></div>
     <div class="home-day-content">
      <div class="home-progress-ring" style="--progress:${progress}%"><span><strong>${done}/${total}</strong><small>no total</small></span></div>
      <div class="home-day-tasks">${actionRows||'<p class="home-day-empty">Nenhuma tarefa disponível hoje.</p>'}</div>
     </div>
     <button class="home-day-link" data-nav="tarefas" type="button">Ver todas as tarefas ${svg('arrow',15)}</button>
    </section>
   </div>
   <section class="home-surface-section" aria-label="Negócios">
    <div class="home-section-heading"><h2>MEUS NEGÓCIOS</h2><button class="list-link" type="button" data-nav="negocios">Ver todos ${svg('arrow',13)}</button></div>
    <div class="home-business-list">${businessesToShow.map(businessRow).join('')||empty('Sem negócios','Cadastre sua primeira frente.','new-business','Novo negócio')}</div>
   </section>
   <section class="home-surface-section home-shortcut-section" aria-label="Acesso rápido">
    <div class="home-section-heading"><h2>ACESSO RÁPIDO</h2></div>${quickLinks}
   </section>
   <section class="home-surface-section home-history-section" aria-label="Últimos movimentos">
    <div class="home-section-heading"><h2>ÚLTIMOS MOVIMENTOS</h2><button class="list-link" type="button" data-nav="historico">Histórico ${svg('arrow',13)}</button></div>
    <div class="home-history-content">${last.length?last.map(activityRow).join(''):empty('Ainda sem registros','Seu histórico será criado conforme você avança.','new-entry','Registrar avanço')}</div>
   </section>
 </div>`;
}
function businesses(){const arranged=[...data.businesses].sort((a,b)=>b.focus-a.focus||a.name.localeCompare(b.name));return `${sectionHeader('SUAS FRENTES','Meus negócios','Uma visão clara do que está ativo, em espera ou em avaliação.',btn(`${svg('plus')} Novo negócio`,'new-business','primary'))}<div class="business-grid">${arranged.map(b=>{const open=data.tasks.filter(t=>t.businessId===b.id&&t.status==='open').length;return `<article class="business-card"><div class="business-head">${businessIcon(b)}<span class="b-tag">${BUSINESS_STATES[b.status]?.label}</span></div><div><h2>${esc(b.name)}</h2><p>${esc(b.objective||'Sem objetivo definido.')}</p><p><strong>Situação:</strong> ${esc(b.situation||'Não informada.')}</p></div><div class="business-meta"><span>${open} ${open===1?'tarefa aberta':'tarefas abertas'}</span><span>·</span><span>Foco</span><div class="focus-bubbles">${Array.from({length:5},(_,i)=>`<span class="${i<b.focus?'on':''}"></span>`).join('')}</div></div><div class="business-bottom">${b.id==='b-reizzor'?'<button type="button" class="btn-primary btn-small" data-action="open-station">Abrir estação</button>':''}<button class="list-link" data-action="new-task" data-business="${esc(b.id)}">${svg('plus',13)} Nova tarefa</button><button class="btn-outline btn-small" data-action="edit-business" data-id="${esc(b.id)}">${svg('edit',13)} Editar</button></div></article>`;}).join('')}</div>`;}
function taskRow(t){const b=business(t.businessId),d=dueMeta(t.due),done=t.status==='done';return `<div class="task-row ${done?'done':''}"><button type="button" class="complete-toggle ${done?'done':''}" data-action="toggle-task" data-id="${esc(t.id)}" title="${done?'Reabrir tarefa':'Concluir tarefa'}" aria-label="${done?'Reabrir':'Concluir'} ${esc(t.title)}">${done?svg('check'):''}</button>${b?businessIcon(b):''}<div class="task-content"><div class="task-title">${esc(t.title)}</div><div class="task-subrow"><span>${esc(b?.name||'Sem negócio')}</span><span>${t.minutes||20} min</span><span>${esc(d.label)}</span><span>Impacto ${t.impact}/5</span></div></div>${!done?`<div class="task-score" title="Pontuação de prioridade">${scoreTask(t,b)}</div>`:''}<div class="task-actions"><button class="icon-btn" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Editar tarefa">${svg('edit')}</button><button class="icon-btn" data-action="delete-task" data-id="${esc(t.id)}" aria-label="Excluir tarefa">${svg('delete')}</button></div></div>`;}
function tasksView(){let tasks=[...data.tasks].sort((a,b)=>{if(a.status!==b.status)return a.status==='open'?-1:1;return scoreTask(b,business(b.businessId))-scoreTask(a,business(a.businessId));});if(taskFilter==='open')tasks=tasks.filter(t=>t.status==='open');else if(taskFilter==='done')tasks=tasks.filter(t=>t.status==='done');return `${sectionHeader('AÇÕES CONCRETAS','Tarefas inteligentes','Não é uma lista infinita. O foco é escolher ações que realmente geram avanço.',btn(`${svg('plus')} Nova tarefa`,'new-task','primary'))}<div class="filter-bar">${[['all','Todas'],['open','Pendentes'],['done','Concluídas']].map(([id,label])=>`<button type="button" data-action="filter-task" data-filter="${id}" class="filter-btn ${taskFilter===id?'active':''}">${label} ${id==='open'?`(${data.tasks.filter(t=>t.status==='open').length})`:''}</button>`).join('')}</div><div class="task-list">${tasks.length?tasks.map(taskRow).join(''):empty('Nenhuma tarefa aqui','Você pode registrar uma nova ação concreta sem fazer planos enormes.','new-task','Criar tarefa')}</div><div class="tipline section-gap">${svg('spark',14)} Pontuação calculada automaticamente com impacto financeiro, urgência, esforço, foco do negócio e prazo. Ela é uma sugestão, não uma obrigação.</div>`;}
function execution(){const top=recommend(data);return `<section class="execution-layout"><div class="execution-top"><div class="eyebrow">MODO EXECUÇÃO</div><h1>Uma coisa de cada vez.</h1><p>Feche o resto. Execute um pequeno passo concreto.</p></div>${top?`<div class="execution-card"><div class="caps">SUA ÚNICA PRIORIDADE AGORA</div><h2>${esc(top.title)}</h2><p>${esc(top.notes||'Defina a menor ação possível e execute sem polir além do necessário.')}</p><div class="focus-split">${tag(esc(business(top.businessId)?.name||'Geral'))}${tag(`${svg('clock',13)} ${top.minutes||20} minutos`,'soft-pill')}</div><div class="focus-buttons">${btn(`${svg('check')} Concluí essa ação`,'complete-task','primary',`data-id="${esc(top.id)}"`)}${btn('Não agora, outra ação','skip-task','outline',`data-id="${esc(top.id)}"`)}</div><div class="execution-reason"><strong>${svg('spark',13)} POR QUE AGORA?</strong><p>${esc(reasonFor(top,business(top.businessId)))}</p></div></div>`:`<div class="execution-card">${empty('Hoje você já pode encerrar','Nenhuma ação disponível agora. É permitido descansar ou rever as ações adiadas.',data.tasks.some(t=>t.status==='open')?'restore-skips':'new-task',data.tasks.some(t=>t.status==='open')?'Rever ações de hoje':'Criar próxima ação')}</div>`}<div class="execution-footer">Sem cronômetro obrigatório. Sem pontos por produtividade. <strong>Só avanço real.</strong></div></section>`;}
function reminderCaption(a){
 const state=agendaReminderStatus(a);
 const hint=reminderLabel(a.reminderMinutes);
 return `<span class="agenda-reminder-status ${esc(state.kind)}">${svg('clock',12)} ${esc(hint)} · ${esc(state.label)}</span>`;
}
function agendaTimingNote(a){
 const duration=normalizeAgendaDuration(a.durationMinutes),conflicts=agendaConflicts(a,data.appointments||[],a.id);
 return (duration?`<span class="agenda-duration-note">${svg('clock',12)} Duração estimada: ${esc(agendaDurationLabel(duration))}</span>`:'')+
   (conflicts.length?`<span class="agenda-conflict-note" role="status">⚠ Possível conflito de horário com ${esc(conflicts.slice(0,2).map(x=>x.title).join(', '))}${conflicts.length>2?' e outros':''}.</span>`:'');
}
function agendaRow(a){
 const dt=appointmentDateTime(a),past=dt<new Date(),done=a.status==='done';
 return `<div class="agenda-item ${done?'agenda-finished':''}"><div class="agenda-date"><strong>${esc(a.date.slice(8,10))}</strong><span>${esc(new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(dt))}</span></div><div class="agenda-details"><div class="agenda-time">${svg('clock',13)} ${esc(a.time)}${a.source==='voz'?' · por voz':''}${done?' · concluído':past?' · passou':''}</div><div class="agenda-title"><button type="button" class="agenda-detail-link" data-action="agenda-details" data-id="${esc(a.id)}">${esc(a.title)}</button></div>${reminderCaption(a)}${agendaTimingNote(a)}${a.notes?`<p>${esc(a.notes)}</p>`:''}</div><div class="agenda-actions"><button class="icon-btn" data-action="toggle-agenda" data-id="${esc(a.id)}" aria-label="${done?'Reabrir':'Marcar como realizado'} ${esc(a.title)}" title="${done?'Reabrir':'Marcar realizado'}">${svg('check')}</button><button class="icon-btn" data-action="edit-agenda" data-id="${esc(a.id)}" aria-label="Editar compromisso">${svg('edit')}</button><button class="icon-btn" data-action="delete-agenda" data-id="${esc(a.id)}" aria-label="Excluir compromisso">${svg('delete')}</button></div></div>`;
}
function agendaBriefRow(record,kind){
 const isAppointment=kind==='appointment';
 const sub=isAppointment?(record.taskId?` · Tarefa: ${data.tasks.find(t=>t.id===record.taskId)?.title||'não disponível'}`:''):(business(record.businessId)?.name||'Tarefa sem negócio');
 const label=isAppointment?record.time:'Prazo';
 const action=isAppointment?'agenda-details':'edit-task';
 return `<div class="agenda-brief"><span class="agenda-brief-time">${esc(label)}</span><div class="agenda-brief-body"><button type="button" data-action="${action}" data-id="${esc(record.id)}">${esc(record.title)}</button><small>${esc(isAppointment?'Compromisso'+sub:sub)}</small>${isAppointment?reminderCaption(record)+agendaTimingNote(record):''}</div><span class="agenda-brief-kind">${isAppointment?'Agenda':'Tarefa'}</span></div>`;
}
function agendaTodayPanel(snapshot){
 const due=[...snapshot.todayAppointments.map(a=>['appointment',a]),...snapshot.todayTasks.map(t=>['task',t])];
 const overdue=[...snapshot.overdueAppointments.map(a=>['appointment',a]),...snapshot.overdueTasks.map(t=>['task',t])];
 const limit=8;
 const group=(items,heading,isOverdue=false)=>`<div class="agenda-overview-caption ${isOverdue?'overdue':''}">${heading} · ${items.length}</div>${items.length?items.slice(0,limit).map(([kind,record])=>agendaBriefRow(record,kind)).join('')+(items.length>limit?`<p class="agenda-more">Mais ${items.length-limit} registros. Use “Todos os compromissos” para ver a agenda completa e a aba Tarefas para ver todos os prazos.</p>`:''):`<p class="agenda-overview-empty">${isOverdue?'Nenhuma pendência anterior.':'Nada com data marcada para hoje.'}</p>`}`;
 return `<section class="panel agenda-panel"><div class="agenda-overview-head"><div><h2>Hoje · ${esc(new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long'}).format(new Date(snapshot.today+'T12:00:00')))}</h2><p>Compromissos e tarefas com prazo para hoje, além do que ficou pendente.</p></div><span class="soft-pill">${due.length} para hoje</span></div>${group(due,'PARA HOJE')}${group(overdue,'ATRASADOS',true)}</section>`;
}
function agendaWeekPanel(snapshot){
 const weekdays=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'short'});
 return `<section class="panel agenda-panel"><div class="agenda-overview-head"><div><h2>Próximos sete dias</h2><p>Uma visão simples dos compromissos e prazos, começando hoje. Nenhum horário é criado automaticamente.</p></div><span class="soft-pill">7 dias</span></div><div class="agenda-week-list">${snapshot.week.map(day=>{
   const items=[...day.appointments.map(a=>['appointment',a]),...day.tasks.map(t=>['task',t])];
   const label=weekdays.format(new Date(day.date+'T12:00:00'));
   return `<div class="agenda-week-day ${day.date===snapshot.today?'today':''}"><div class="agenda-week-head"><strong>${esc(label)}${day.date===snapshot.today?' · Hoje':''}</strong><span>${items.length} ${items.length===1?'item':'itens'}</span></div>${items.length?items.slice(0,6).map(([kind,record])=>agendaBriefRow(record,kind)).join('')+(items.length>6?`<p class="agenda-more">+ ${items.length-6} itens neste dia</p>`:''):'<p class="agenda-week-empty">Nenhum compromisso ou prazo.</p>'}</div>`;
 }).join('')}</div>${snapshot.laterCount?`<p class="agenda-more">Mais ${snapshot.laterCount} compromisso(s) após esses sete dias. Use “Todos os compromissos” abaixo para consultá-los.</p>`:''}</section>`;
}
function agendaDetails(id){
 const a=(data.appointments||[]).find(x=>x.id===id);if(!a)return;
 const linked=data.tasks.find(t=>t.id===a.taskId);
 const taskOptions=[['','Nenhuma tarefa vinculada'],...data.tasks.map(t=>[t.id,`${t.title}${t.status==='done'?' (concluída)':''}`])];
 const details=`<p class="agenda-detail-copy"><strong>Quando:</strong> ${esc(niceDate(a.date))}, às ${esc(a.time)}</p><p class="agenda-detail-copy"><strong>Duração estimada:</strong> ${esc(agendaDurationLabel(a.durationMinutes))}</p>${agendaTimingNote(a)}<p class="agenda-detail-copy"><strong>Observações:</strong> ${esc(a.notes||'Nenhuma observação.')}</p><p class="agenda-detail-task">${linked?'Tarefa relacionada: '+esc(linked.title):'Sem tarefa relacionada.'}</p>${reminderCaption(a)}${selectField('Vincular uma tarefa existente (opcional)','taskId',a.taskId||'',taskOptions)}${selectField('Avisar antes deste compromisso','reminderMinutes',normalizeReminderMinutes(a.reminderMinutes),[[0,'Sem lembrete'],[10,'10 minutos'],[30,'30 minutos (padrão)'],[60,'1 hora']])}<p class="tipline">Este vínculo não altera a tarefa nem o horário do compromisso. Você pode removê-lo selecionando “Nenhuma tarefa vinculada”.</p><button class="btn-outline" type="button" data-action="edit-agenda" data-id="${esc(id)}">${svg('edit',15)} Editar data, horário ou detalhes</button>`;
 openModal(formWrap('DETALHES DO COMPROMISSO',esc(a.title),details,'Salvar vínculo'),'link-agenda-task',id);
}
function agendaView(){
 const snapshot=buildAgendaOverview(data,new Date()),sorted=sortAppointments(data.appointments||[]);
 const now=new Date(),upcoming=sorted.filter(a=>a.status!=='done'&&appointmentDateTime(a)>=now),earlier=sorted.filter(a=>a.status==='done'||appointmentDateTime(a)<now);
 const count=sorted.length;
 const voicePanel=`<div class="panel agenda-voice-panel"><div class="agenda-voice-mark">${svg('mic',26)}</div><div class="agenda-voice-copy"><h2>Fale. Nós organizamos.</h2><p>Exemplo: “Marcar reunião com fornecedor amanhã às 15 horas”.</p><p class="muted small" id="agenda-voice-status" aria-live="polite">O áudio será temporário. O agendamento só acontece após a sua confirmação.</p></div><button type="button" class="btn-primary" data-action="voice-start" id="agenda-mic-button">${svg('mic',17)} Gravar áudio</button></div>`;
 return `${sectionHeader('SEU TEMPO','Minha Agenda','Compromissos, prazos e o que merece atenção agora.',btn(`${svg('plus')} Novo compromisso`,'new-agenda','primary'))}<div class="agenda-overview"><div class="agenda-switch" role="group" aria-label="Período da agenda"><button type="button" data-action="agenda-period" data-period="hoje" class="${agendaPeriod==='hoje'?'active':''}" aria-pressed="${agendaPeriod==='hoje'}">Hoje</button><button type="button" data-action="agenda-period" data-period="semana" class="${agendaPeriod==='semana'?'active':''}" aria-pressed="${agendaPeriod==='semana'}">Semana</button></div>${agendaPeriod==='semana'?agendaWeekPanel(snapshot):agendaTodayPanel(snapshot)}</div><div class="section-gap">${voicePanel}</div><div class="agenda-all-toggle">${btn(`${agendaAllOpen?'Ocultar':'Ver'} todos os compromissos (${count})`,'toggle-agenda-list','outline',`aria-expanded="${agendaAllOpen}"`)}</div>${agendaAllOpen?`<section class="panel agenda-panel section-gap"><div class="panel-head"><div class="panel-title">Próximos compromissos</div><span class="muted small">${upcoming.length} previstos</span></div>${upcoming.length?`<div class="agenda-list">${upcoming.map(agendaRow).join('')}</div>`:'<div class="agenda-empty">Nenhum compromisso futuro.</div>'}</section>${earlier.length?`<section class="panel agenda-panel section-gap"><div class="panel-head"><div class="panel-title">Anteriores e concluídos</div></div><div class="agenda-list">${earlier.slice().reverse().map(agendaRow).join('')}</div></section>`:''}`:''}<div class="tipline section-gap">${svg('shield',14)} Seus compromissos e vínculos com tarefas continuam no armazenamento local e no backup. As notificações seguem as preferências de Ajustes, sem ativação automática.</div>`;
}
function agendaForm(id='',voice=false,transcript='',audioUrl='',prefill={}){const a=(data.appointments||[]).find(x=>x.id===id)||{title:'',date:dateKey(),time:'',notes:'',durationMinutes:0,source:voice?'voz':'manual',...prefill};const parsed=voice?parseVoiceAppointment(transcript):null;const title=voice?parsed.title:a.title,date=voice?(parsed.date||''):a.date,time=voice?parsed.time:a.time;const voiceHtml=voice?`<div class="voice-review"><div class="caps">GRAVAÇÃO TEMPORÁRIA</div>${audioUrl?`<audio controls src="${esc(audioUrl)}" aria-label="Ouvir gravação" style="width:100%"></audio>`:''}<p>Confira a transcrição e toque em “Interpretar novamente” se precisar ajustá-la.</p><textarea id="voice-transcript" rows="3" placeholder="Transcrição indisponível. Você pode digitar aqui o que disse.">${esc(transcript)}</textarea>${btn(`${svg('spark',15)} Interpretar novamente`,'parse-voice','outline')}</div>`:'';const html=`${voiceHtml}${field('Título do compromisso','title',title,'text','required maxlength="250" placeholder="Ex.: Reunião com fornecedor"')}<div class="form-grid">${field('Data','date',date,'date','required')}${field('Horário','time',time,'time','required')}</div>${selectField('Duração estimada (opcional)','durationMinutes',normalizeAgendaDuration(a.durationMinutes),[[0,'Não informar'],[15,'15 minutos'],[30,'30 minutos'],[45,'45 minutos'],[60,'1 hora'],[90,'1h30'],[120,'2 horas'],[180,'3 horas'],[240,'4 horas']])}<p class="agenda-availability-hint">A duração permite detectar conflitos. Compromissos antigos continuam sem duração presumida.</p>${selectField('Lembrete (opcional)','reminderMinutes',normalizeReminderMinutes(a.reminderMinutes),[[0,'Sem lembrete'],[10,'10 minutos antes'],[30,'30 minutos antes (padrão)'],[60,'1 hora antes']])}<p class="agenda-reminder-help">O horário é individual. Para receber avisos, ative “Compromissos da agenda” em Ajustes → Notificações. O servidor agenda avisos até 14 dias à frente quando o app sincroniza.</p>${textArea('Observações (opcional)','notes',voice?'':a.notes,'maxlength="3000" placeholder="Detalhes importantes"')}<div class="tipline">${voice?'A interpretação pode falhar. Confirme título, data e horário antes de salvar.':'A agenda salva somente após confirmar estes campos.'}</div>`;openModal(formWrap('MINHA AGENDA',id?'Editar compromisso':voice?'Revisar áudio':'Novo compromisso',html,'Salvar compromisso'),id?'edit-agenda':'create-agenda',id);}
function clearVoice(){if(!voiceSession)return;try{voiceSession.recognition?.abort();}catch{}try{voiceSession.stream?.getTracks().forEach(t=>t.stop());}catch{}if(voiceSession.audioUrl)URL.revokeObjectURL(voiceSession.audioUrl);voiceSession=null;}
function setVoiceStatus(text){const label=$('agenda-voice-status');if(label)label.textContent=text;}
async function startAgendaVoice(){if(voiceSession?.recording){stopAgendaVoice();return;}if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Gravação não disponível neste navegador. Use Novo compromisso.');agendaForm();return;}
 try {const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(page!=='agenda'){stream.getTracks().forEach(t=>t.stop());return;}let recorder;try{recorder=new MediaRecorder(stream);}catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
  const session={stream,recorder,recognition:null,chunks:[],transcript:'',recording:true,audioUrl:''};voiceSession=session;recorder.ondataavailable=event=>{if(event.data.size)session.chunks.push(event.data);};recorder.onstop=()=>{session.recording=false;session.stream.getTracks().forEach(t=>t.stop());if(voiceSession!==session)return;const blob=new Blob(session.chunks,{type:recorder.mimeType||'audio/webm'});if(blob.size)session.audioUrl=URL.createObjectURL(blob);setTimeout(()=>{if(voiceSession===session)agendaForm('',true,session.transcript,session.audioUrl);},350);};recorder.start();
  const Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;if(Recognizer){try{const recognition=new Recognizer();session.recognition=recognition;recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=true;recognition.onresult=event=>{session.transcript=Array.from(event.results).map(r=>r[0].transcript).join(' ').trim();setVoiceStatus(session.transcript?`Ouvindo: ${session.transcript}`:'Gravando...');};recognition.onerror=()=>setVoiceStatus('Áudio gravado. A transcrição automática não está disponível; preencha os campos na revisão.');recognition.start();}catch(e){console.warn('Reconhecimento indisponível:',e);}}
  const button=$('agenda-mic-button');if(button){button.dataset.action='voice-stop';button.innerHTML=`${svg('stop',17)} Parar e revisar`;}setVoiceStatus(Recognizer?'Gravando... fale seu compromisso e depois toque em “Parar e revisar”.':'Gravando áudio. Neste navegador, a transcrição poderá precisar ser digitada.');
 }catch(e){toast(e?.name==='NotAllowedError'?'Autorize o microfone para gravar.':'Não foi possível iniciar o microfone.');setVoiceStatus('Você pode cadastrar o compromisso manualmente.');}}
function stopAgendaVoice(){const session=voiceSession;if(!session?.recording)return;const button=$('agenda-mic-button');if(button){button.disabled=true;button.textContent='Preparando áudio...';}setVoiceStatus('Preparando gravação para revisão...');try{session.recognition?.stop();}catch{}try{session.recorder.stop();}catch{session.stream.getTracks().forEach(t=>t.stop());toast('Não foi possível finalizar a gravação.');}}
function history(){const sorted=[...data.events].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));return `${sectionHeader('O QUE SAIU DO PAPEL','Histórico de avanços','Decisões, tarefas concluídas e pequenos marcos merecem um registro.',btn(`${svg('plus')} Registrar movimento`,'new-entry','primary'))}<section class="panel"><div class="panel-head"><div class="panel-title">Linha do tempo</div><span class="muted small">${sorted.length} registros</span></div><div class="activity-list">${sorted.length?sorted.map(activityRow).join(''):empty('Sua história começa aqui','Registre uma decisão ou conclua uma tarefa para começar.','new-entry','Registrar avanço')}</div></section>`;}

function stationView(){return `${sectionHeader('MEUS NEGÓCIOS','REIZZOR STATION','Composição, repertório e guias privados.',btn('Voltar a Meus Negócios','back-to-business','outline'))}${renderStationContent(data,stationSongId,esc)}`;}
function stationSongForm(id=''){
  const song=(data.station?.songs||[]).find(x=>x.id===id)||{title:'',key:'',tuning:'',bpm:0,status:'ideia',lyrics:'',notes:''};
  const html=field('Nome da música','title',song.title,'text','required maxlength="140" placeholder="Ex.: Retina Azul"')
    +selectField('Etapa da música','status',song.status,Object.entries(STATION_STATUSES))
    +'<div class="form-grid">'+field('Tonalidade (opcional)','key',song.key,'text','maxlength="60"')+field('BPM (opcional)','bpm',song.bpm||'','number','min="0" max="300"')+'</div>'
    +field('Afinação (opcional)','tuning',song.tuning,'text','maxlength="100" placeholder="Ex.: Drop C"')
    +textArea('Letra / composição','lyrics',song.lyrics,'maxlength="12000" rows="9" placeholder="Registre seus versos, refrões e ideias..."')
    +textArea('Anotações de arranjo e ensaio','notes',song.notes,'maxlength="4000" rows="4" placeholder="Observações pessoais sobre a música..."');
  openModal(formWrap('REIZZOR STATION',id?'Editar música':'Nova música',html,'Salvar música'),id?'edit-song':'create-song',id);
}
function stationGuideForm(id){
  if(!data.station?.songs?.some(s=>s.id===id))return;
  const html=field('Identificação do guia','label','','text','required maxlength="100" placeholder="Ex.: Demo vocal V02"')
    +field('Link HTTPS do áudio','url','','url','required maxlength="1500" placeholder="https://..."')
    +'<div class="tipline">O arquivo continua no serviço original. Este aplicativo salva apenas o link, não faz upload ou sincronização.</div>';
  openModal(formWrap('REIZZOR STATION','Adicionar áudio-guia',html,'Salvar referência'),'create-guide',id);
}
function settings(){return `${sectionHeader('SEUS DADOS','Dados e ajustes','Controle simples, sem conta, assinatura ou servidor.')}<div class="settings-grid">${renderPushSettings()}<div class="setting-card">${svg('clock',22)}<h2>Atualização do aplicativo</h2><p>Versão instalada: <strong>${APP_VERSION}</strong>. O SÓCIO procura novas versões ao abrir ou retornar ao app com internet. Você também pode verificar e recarregar agora, sem excluir seus dados.</p>${btn(`${svg('clock',15)} Verificar e atualizar`,'update-app','primary')}</div><div class="setting-card">${svg('download',22)}<h2>Exportar backup</h2><p>Salve seus negócios, compromissos, músicas, letras, tarefas e histórico em um arquivo JSON. Recomendado especialmente antes de trocar de aparelho.</p>${btn(`${svg('download',15)} Baixar meus dados`,'export','primary')}</div><div class="setting-card">${svg('upload',22)}<h2>Importar backup</h2><p>Recupere os dados de um arquivo salvo anteriormente. A importação substitui os dados atuais deste dispositivo.</p>${btn(`${svg('upload',15)} Selecionar arquivo`,'import','outline')}<input type="file" accept=".json,application/json" id="import-file" hidden></div><div class="setting-card">${svg('shield',22)}<h2>Privacidade</h2><p>Na versão atual, todos os registros ficam no armazenamento local do navegador ou PWA. Não existe conta nem sincronização automática.</p><span class="soft-pill">Local · ${APP_VERSION}</span></div><div class="setting-card">${svg('layers',22)}<h2>Reiniciar demonstração</h2><p>Volte aos cinco negócios iniciais e às duas tarefas de exemplo. Esta ação apagará os dados locais atuais.</p>${btn(`${svg('delete',15)} Reiniciar dados`,'reset','outline')}</div></div><div class="settings-warning"><strong>Importante:</strong> apagar dados do site ou remover o aplicativo pode eliminar os registros locais. Mac e iPhone ainda não compartilham a mesma base. Use “Exportar backup” periodicamente. A versão publicada do site pode ser visitada por outras pessoas, mas os dados locais de um usuário não aparecem para outro.</div>`;}
function formWrap(kicker,title,content,submit='Salvar'){return `<div class="modal-top"><div><div class="caps">${kicker}</div><h2 id="modal-title">${title}</h2></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Fechar">×</button></div><form id="entry-form"><div class="form-stack">${content}</div><div class="modal-footer"><button type="button" class="btn-quiet" data-action="close-modal">Cancelar</button><button type="submit" class="btn-primary">${svg('check',15)} ${submit}</button></div></form>`;}
function field(label,name,value='',type='text',extra=''){return `<div class="form-field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;}
function textArea(label,name,value='',extra=''){return `<div class="form-field"><label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}" ${extra}>${esc(value)}</textarea></div>`;}
function selectField(label,name,value,items){return `<div class="form-field"><label for="f-${name}">${label}</label><select name="${name}" id="f-${name}">${items.map(([id,text])=>`<option value="${esc(id)}" ${String(value)===String(id)?'selected':''}>${esc(text)}</option>`).join('')}</select></div>`;}
function openModal(html,mode,recordId=''){$('modal-content').innerHTML=html;$('modal-backdrop').hidden=false;$('modal-content').dataset.mode=mode;$('modal-content').dataset.recordId=recordId;document.body.style.overflow='hidden';setTimeout(()=>$('modal-content').querySelector('input:not([type="hidden"]),select,textarea')?.focus(),0);}
function closeModal(){$('modal-backdrop').hidden=true;$('modal-content').innerHTML='';document.body.style.overflow='';clearVoice();queueMicrotask(applyDeferredUpdate);}
function businessForm(id=''){const b=business(id)||{name:'',status:'ativo',focus:3,color:BUSINESS_COLORS[0],objective:'',situation:''};const html=`${field('Nome do negócio','name',b.name,'text','required maxlength="120" placeholder="Ex.: SOUNDLINE"')}${textArea('Objetivo principal','objective',b.objective,'maxlength="2000" placeholder="Qual resultado você quer alcançar?"')}${textArea('Situação atual','situation',b.situation,'maxlength="2000" placeholder="Em que ponto está?"')}<div class="form-grid">${selectField('Momento do negócio','status',b.status,Object.entries(BUSINESS_STATES).map(([k,v])=>[k,v.label]))}${selectField('Nível de foco agora','focus',b.focus,[1,2,3,4,5].map(n=>[n,`${n} / 5`]))}</div>${selectField('Cor de identificação','color',b.color,BUSINESS_COLORS.map((c,i)=>[c,['Âmbar','Verde','Azul','Lavanda','Cinza','Coral'][i]]))}`;openModal(formWrap('MEUS NEGÓCIOS',id?'Editar negócio':'Novo negócio',html),id?'edit-business':'create-business',id);}
function taskForm(id='',selectedBusiness=''){const t=data.tasks.find(t=>t.id===id)||{title:'',businessId:selectedBusiness||data.businesses[0]?.id||'',notes:'',impact:3,urgency:3,effort:2,minutes:20,due:''};if(!data.businesses.length){toast('Cadastre um negócio primeiro.');businessForm();return;}const html=`${field('Ação concreta','title',t.title,'text','required maxlength="250" placeholder="Ex.: Publicar meu primeiro anúncio"')}${selectField('Negócio','businessId',t.businessId,data.businesses.map(b=>[b.id,b.name]))}${textArea('O menor próximo passo (opcional)','notes',t.notes,'maxlength="3000" placeholder="O que basta fazer para considerar concluído?"')}<div class="form-grid third">${selectField('Impacto','impact',t.impact,[1,2,3,4,5].map(n=>[n,`${n}/5`]))}${selectField('Urgência','urgency',t.urgency,[1,2,3,4,5].map(n=>[n,`${n}/5`]))}${selectField('Esforço','effort',t.effort,[1,2,3,4,5].map(n=>[n,`${n}/5`]))}</div><div class="form-grid">${field('Prazo (opcional)','due',t.due,'date')}${selectField('Duração estimada','minutes',t.minutes,[5,10,15,20,30,45,60,90,120].map(n=>[n,`${n} min`]))}</div><div class="tipline">O SÓCIO usa impacto, urgência, esforço, foco do negócio e prazo para recomendar a melhor ação disponível.</div>`;openModal(formWrap('AÇÃO PRÁTICA',id?'Editar tarefa':'Nova tarefa',html),id?'edit-task':'create-task',id);}
function entryForm(){const html=`${selectField('Tipo de registro','type','avanco',[['avanco','Avanço real'],['decisao','Decisão tomada']])}${field('O que aconteceu?','title','','text','required maxlength="250" placeholder="Ex.: Defini o preço de um cabo"')}${selectField('Negócio (opcional)','businessId','',[['','Geral / sem negócio'],...data.businesses.map(b=>[b.id,b.name])])}${textArea('Notas (opcional)','note','','maxlength="3000" placeholder="O que aprendeu ou decidiu?"')}`;openModal(formWrap('HISTÓRICO','Registrar um movimento',html,'Registrar'),'create-entry');}
function addEvent(type,title,businessId=null,taskId=null,note=''){data.events.unshift({id:newId('e'),businessId,taskId,type,title,note,createdAt:new Date().toISOString()});}
function completeTask(id){const t=data.tasks.find(x=>x.id===id);if(!t)return;if(t.status==='done'){t.status='open';t.completedAt=null;addEvent('reaberta',`Tarefa retomada: ${t.title}`,t.businessId,t.id);save();toast('Tarefa reaberta.');return;}t.status='done';t.completedAt=new Date().toISOString();addEvent('conclusao',`Tarefa concluída: ${t.title}`,t.businessId,t.id);save();toast('Avanço registrado. Muito bem!');}
function skipTask(id){const t=data.tasks.find(x=>x.id===id);if(!t||t.status==='done')return;if(data.skipped?.date!==dateKey())data.skipped={date:dateKey(),taskIds:[]};if(!data.skipped.taskIds.includes(id)){data.skipped.taskIds.push(id);addEvent('adiamento',`Ação adiada: ${t.title}`,t.businessId,t.id,'Retorna às recomendações amanhã.');}save();toast('Tudo bem. Essa ação volta amanhã.');}
function handleClick(event){const target=event.target.closest('[data-action],[data-nav]');if(!target)return;event.preventDefault();if(target.dataset.nav){navigate(target.dataset.nav);return;}const act=target.dataset.action,id=target.dataset.id||'';switch(act){
 case 'open-station':navigate('estacao');break;
 case 'back-to-business':navigate('negocios');break;
 case 'new-song':stationSongForm();break;
 case 'open-song':stationSongId=id;navigate('estacao');break;
 case 'edit-song':stationSongForm(id);break;
 case 'delete-song':{const song=data.station?.songs?.find(s=>s.id===id);if(song&&confirm('Excluir a música "'+song.title+'" e suas referências?')){data.station.songs=data.station.songs.filter(s=>s.id!==id);if(stationSongId===id)stationSongId='';save();toast('Música excluída.');}break;}
 case 'add-guide':stationGuideForm(id);break;
 case 'delete-guide':{const song=data.station?.songs?.find(s=>s.id===target.dataset.song);const guide=song?.guides?.find(g=>g.id===id);if(song&&guide&&confirm('Remover a referência "'+guide.label+'"? O áudio original não será apagado.')){song.guides=song.guides.filter(g=>g.id!==id);song.updatedAt=new Date().toISOString();save();toast('Referência removida.');}break;}
 case 'new-task':taskForm('',target.dataset.business||'');break;
 case 'edit-task':taskForm(id);break;
 case 'new-business':businessForm();break;
 case 'edit-business':businessForm(id);break;
 case 'new-entry':entryForm();break;
 case 'new-agenda':agendaForm();break;
 case 'agenda-period':agendaPeriod=target.dataset.period==='semana'?'semana':'hoje';render();break;
 case 'toggle-agenda-list':agendaAllOpen=!agendaAllOpen;render();break;
 case 'agenda-details':agendaDetails(id);break;
 case 'edit-agenda':agendaForm(id);break;
 case 'voice-start':startAgendaVoice();break;
 case 'voice-stop':stopAgendaVoice();break;
 case 'parse-voice':{const parsed=parseVoiceAppointment($('voice-transcript')?.value||'');for(const k of ['title','date','time']){const el=$(`f-${k}`);if(el)el.value=parsed[k]||'';}toast('Revise os campos interpretados antes de salvar.');break;}
 case 'toggle-agenda':{const a=data.appointments.find(x=>x.id===id);if(a){a.status=a.status==='done'?'open':'done';if(a.status==='done')addEvent('avanco',`Compromisso realizado: ${a.title}`);save();}break;}
 case 'delete-agenda':{const a=data.appointments.find(x=>x.id===id);if(a&&confirm(`Excluir o compromisso “${a.title}”?`)){data.appointments=data.appointments.filter(x=>x.id!==id);save();toast('Compromisso excluído.');}break;}
 case 'close-modal':closeModal();break;
 case 'start-execution':navigate('executar');break;
 case 'complete-task':completeTask(id);break;
 case 'toggle-task':completeTask(id);break;
 case 'skip-task':skipTask(id);break;
 case 'filter-task':taskFilter=target.dataset.filter||'all';render();break;
 case 'restore-skips':data.skipped={date:dateKey(),taskIds:[]};save();toast('Ações de hoje restauradas.');break;
 case 'delete-task':{const t=data.tasks.find(x=>x.id===id);if(t&&confirm(`Excluir a tarefa “${t.title}”? Os registros históricos permanecerão.`)){data.tasks=data.tasks.filter(x=>x.id!==id);for(const a of (data.appointments||[])){if(a.taskId===id)a.taskId='';}save();toast('Tarefa excluída.');}break;}
 case 'push-enable':void enablePush().then(ok=>{if(ok)render()});break;
 case 'push-disable':void disablePush().then(ok=>{if(ok)render()});break;
 case 'push-test':void testPush();break;
 case 'push-scheduled-test':void schedulePushDiagnostic();break;
 case 'push-save-preferences':void savePushPreferences();break;
 case 'push-time':void updatePushTime();break;
 case 'update-app':void checkForUpdates({manual:true});break;
 case 'export':downloadJson(data);toast('Backup preparado para download.');break;
 case 'import':$('import-file')?.click();break;
 case 'reset':if(confirm('Isso APAGARÁ seus dados locais e restaurará os exemplos iniciais. Faça um backup antes. Deseja continuar?')){data=seedData();writeData(data);render();toast('Exemplos restaurados.');}break;
 }}
function handleSubmit(event){if(event.target?.id!=='entry-form')return;event.preventDefault();const f=new FormData(event.target),mode=$('modal-content').dataset.mode,id=$('modal-content').dataset.recordId,now=new Date().toISOString();let message='Salvo.';
 if(mode==='create-business'||mode==='edit-business'){const payload={name:String(f.get('name')||'').trim(),objective:String(f.get('objective')||'').trim(),situation:String(f.get('situation')||'').trim(),status:String(f.get('status')),focus:Number(f.get('focus')),color:String(f.get('color'))};if(!payload.name){toast('Informe o nome do negócio.');return;}if(mode==='create-business'){data.businesses.push({id:newId('b'),...payload,createdAt:now});message='Negócio adicionado.';}else{const b=business(id);if(!b)return;Object.assign(b,payload);message='Negócio atualizado.';}}
 else if(mode==='create-task'||mode==='edit-task'){const payload={title:String(f.get('title')||'').trim(),businessId:String(f.get('businessId')||''),notes:String(f.get('notes')||'').trim(),impact:Number(f.get('impact')),urgency:Number(f.get('urgency')),effort:Number(f.get('effort')),minutes:Number(f.get('minutes')),due:String(f.get('due')||'')};if(!payload.title||!business(payload.businessId)){toast('Informe a ação e o negócio.');return;}if(mode==='create-task'){data.tasks.push({id:newId('t'),...payload,status:'open',createdAt:now,completedAt:null});message='Nova ação registrada.';}else{const t=data.tasks.find(x=>x.id===id);if(!t)return;Object.assign(t,payload);message='Ação atualizada.';}}
 else if(mode==='create-song'||mode==='edit-song'){
   const title=String(f.get('title')||'').trim();if(!title){toast('Informe o nome da música.');return;}
   const bpm=Number(f.get('bpm')||0);if(!Number.isInteger(bpm)||bpm<0||bpm>300){toast('Confira o BPM (0 a 300).');return;}
   const payload={title,status:String(f.get('status')||'ideia'),key:String(f.get('key')||'').trim(),tuning:String(f.get('tuning')||'').trim(),bpm,lyrics:String(f.get('lyrics')||''),notes:String(f.get('notes')||''),updatedAt:now};
   if(!data.station)data.station={songs:[]};
   if(mode==='create-song'){const song={id:newId('song'),...payload,guides:[],createdAt:now};data.station.songs.push(song);stationSongId=song.id;message='Música cadastrada.';}
   else{const song=data.station.songs.find(s=>s.id===id);if(!song)return;Object.assign(song,payload);stationSongId=id;message='Música atualizada.';}
 }
 else if(mode==='create-guide'){
   const song=data.station?.songs?.find(s=>s.id===id);if(!song)return;
   const label=String(f.get('label')||'').trim(),url=String(f.get('url')||'').trim();
   let parsed;try{parsed=new URL(url);}catch{toast('Insira um link HTTPS válido.');return;}
   if(!label||parsed.protocol!=='https:'){toast('Preencha a identificação e um link HTTPS válido.');return;}
   if((song.guides||[]).length>=12){toast('Limite de 12 referências por música.');return;}
   song.guides.push({id:newId('guide'),label,url:parsed.href});song.updatedAt=now;stationSongId=id;message='Áudio-guia vinculado.';
 }
 else if(mode==='create-agenda'||mode==='edit-agenda'){const title=String(f.get('title')||'').trim(),date=String(f.get('date')||''),time=String(f.get('time')||''),notes=String(f.get('notes')||'').trim(),reminderMinutes=normalizeReminderMinutes(f.get('reminderMinutes'));const [y,m,d]=date.split('-').map(Number),check=new Date(y,m-1,d);if(!title||check.getFullYear()!==y||check.getMonth()!==m-1||check.getDate()!==d||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){toast('Confira título, data e horário.');return;}if(mode==='create-agenda'){const source=Boolean($('voice-transcript'))?'voz':'manual';data.appointments.push({id:newId('a'),title,date,time,notes,reminderMinutes,source,status:'open',createdAt:now});addEvent('agenda',`Compromisso agendado: ${title}`,null,null,`${niceDate(date)} às ${time}`);message='Compromisso salvo na agenda.';}else{const appointment=data.appointments.find(a=>a.id===id);if(!appointment)return;Object.assign(appointment,{title,date,time,notes,reminderMinutes});message='Compromisso atualizado.';}}
 else if(mode==='link-agenda-task'){const a=data.appointments.find(x=>x.id===id);if(!a)return;const taskId=String(f.get('taskId')||'');if(taskId&&!data.tasks.some(t=>t.id===taskId)){toast('A tarefa selecionada não existe mais.');return;}a.taskId=taskId;a.reminderMinutes=normalizeReminderMinutes(f.get('reminderMinutes'));message='Preferências do compromisso salvas.';}
 else if(mode==='create-entry'){const title=String(f.get('title')||'').trim();if(!title){toast('Descreva o que aconteceu.');return;}const businessId=String(f.get('businessId')||'')||null;addEvent(String(f.get('type'))==='decisao'?'decisao':'avanco',title,businessId,null,String(f.get('note')||'').trim());message='Movimento registrado.';}
 else return;closeModal();save();toast(message);
}
async function importFile(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('O arquivo excede 10 MB.');const imported=validateData(JSON.parse(await file.text()));if(!confirm('Importar este backup substituirá todos os dados atuais deste dispositivo. Deseja continuar?'))return;data=imported;writeData(data);navigate('inicio');void syncPush(data);toast('Backup importado com sucesso.');}catch(err){toast(`Falha na importação: ${err.message}`);}finally{event.target.value='';}}
// Eventos de página
window.addEventListener('hashchange',()=>{const incoming=location.hash.slice(1);if(incoming&&incoming!==page){page=routes.some(([p])=>p===incoming)||incoming==='estacao'?incoming:'inicio';render();}});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){data=readData();render();}});
document.addEventListener('click',handleClick);
document.addEventListener('socio:push-synced',()=>{if(page==='agenda'&&$('modal-backdrop')?.hidden)render();});
document.addEventListener('submit',handleSubmit);
document.addEventListener('change',event=>{if(event.target?.id==='import-file')importFile(event);});
$('modal-backdrop').addEventListener('click',event=>{if(event.target===$('modal-backdrop'))closeModal();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('modal-backdrop').hidden)closeModal();});
page=routes.some(([id])=>id===location.hash.slice(1))||location.hash.slice(1)==='estacao'?location.hash.slice(1):'inicio';render();
initPush({notify:toast,data:()=>data});
initUpdates({notify:toast,isBusy:()=>$('modal-backdrop')?.hidden===false});
window.addEventListener('pageshow',()=>void syncPush(data));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void syncPush(data);});
