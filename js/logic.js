/** Motor de recomendações determinístico e auditável (sem IA ou chamadas externas). */
export const BUSINESS_STATES = {
  ativo: {label:'Em movimento', short:'Ativo'},
  desenvolvimento: {label:'Em desenvolvimento', short:'Desenvolvimento'},
  manutencao: {label:'Em manutenção', short:'Manutenção'},
  espera: {label:'Em espera', short:'Em espera'},
  exploracao: {label:'Em avaliação', short:'Avaliação'}
};
export const BUSINESS_COLORS = ['#DEB678','#74B4A8','#819BD1','#B998C8','#A6B6C2','#DB947B'];
export const newId = (prefix='id') => `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
export const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const safeDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
export const niceDate = (v) => { if (!safeDate(v)) return 'Sem prazo'; const [y,m,d] = v.split('-'); return `${d}/${m}/${y}`; };
export const formatShortDate = (v) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit', month:'short'}).format(new Date(`${v}T12:00:00`));
export const todayFull = (date=new Date()) => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(date);
export const htmlEscape = (v='') => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function dueMeta(due, now=new Date()) {
  if (!safeDate(due)) return {bonus:0,label:'Sem prazo',kind:'none'};
  const [y,m,d] = due.split('-').map(Number);
  const date = Date.UTC(y,m-1,d), today = Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const days = Math.round((date-today)/86400000);
  if (days < 0) return {bonus:12,label:`${Math.abs(days)} dia${days===-1?'':'s'} de atraso`,kind:'late'};
  if (days===0) return {bonus:10,label:'Prazo hoje',kind:'today'};
  if (days===1) return {bonus:8,label:'Prazo amanhã',kind:'soon'};
  if (days<=3) return {bonus:5,label:`Em ${days} dias`,kind:'soon'};
  if (days<=7) return {bonus:2,label:`Em ${days} dias`,kind:'future'};
  return {bonus:0,label:niceDate(due),kind:'future'};
}
export function scoreTask(task, business, now = new Date()) {
  const impact = clamp(task.impact,1,5), urgency=clamp(task.urgency,1,5), effort=clamp(task.effort,1,5), focus=clamp(business?.focus || 1,1,5);
  const adjustment = business?.status === 'espera' ? -9 : business?.status === 'manutencao' ? -2 : business?.status === 'exploracao' ? -3 : business?.status === 'ativo' ? 3 : 0;
  return impact*4 + urgency*3 + (6-effort)*2 + focus + dueMeta(task.due, now).bonus + adjustment;
}
export function clamp(value, min, max) { const n=Number(value); return Number.isFinite(n) ? Math.min(max,Math.max(min,Math.round(n))) : min; }
export function rankTasks(data, now = new Date(), excludedToday=true) {
  const businesses=new Map(data.businesses.map(b=>[b.id,b]));
  const skipped = excludedToday && data.skipped?.date === dateKey(now) ? new Set(data.skipped.taskIds || []) : new Set();
  return data.tasks.filter(t=>t.status!=='done' && !skipped.has(t.id)).map(t=>({...t,score:scoreTask(t,businesses.get(t.businessId),now)}))
    .sort((a,b)=>b.score-a.score || (a.createdAt || '').localeCompare(b.createdAt || ''));
}
export function recommend(data,now = new Date()) {return rankTasks(data,now)[0] || null;}
export function reasonFor(task,business,now=new Date()) {
  if (!task) return 'Uma ação aparece aqui assim que você cadastrar uma tarefa.';
  const parts=[];
  if (task.impact>=4) parts.push('tem alto potencial de impacto no negócio');
  if (business?.status==='ativo' && business?.focus>=4) parts.push(`está conectada ao foco atual: ${business.name}`);
  const due=dueMeta(task.due,now);
  if (due.kind==='late'||due.kind==='today'||due.kind==='soon') parts.push(`tem um prazo próximo (${due.label.toLowerCase()})`);
  if (task.effort<=2) parts.push('é uma ação relativamente simples de tirar do papel');
  if (!parts.length) parts.push('é a melhor combinação de impacto, urgência e esforço entre as tarefas abertas');
  return `Essa ação ${parts.join('; ')}.`;
}
export function seedData(now=new Date()) {
  const stamp=now.toISOString();
  return {
    version:1,
    businesses:[
      {id:'b-soundline',name:'SOUNDLINE',status:'ativo',focus:5,color:BUSINESS_COLORS[0],objective:'Publicar o primeiro anúncio no Mercado Livre e validar a demanda pelos cabos prontos.',situation:'Estoque pronto para entrega. Primeiro anúncio comercial em preparação.',createdAt:stamp},
      {id:'b-voz',name:'VOZ PRONTA',status:'desenvolvimento',focus:2,color:BUSINESS_COLORS[1],objective:'Validar um aplicativo de aquecimento vocal simples e eficaz.',situation:'Projeto de médio prazo; evoluir por versões funcionais.',createdAt:stamp},
      {id:'b-estudio',name:'Estúdio',status:'manutencao',focus:2,color:BUSINESS_COLORS[2],objective:'Manter a operação estável sem depender de intervenção diária excessiva.',situation:'Operação existente; acompanhar apenas o essencial.',createdAt:stamp},
      {id:'b-locacao',name:'Locação de som',status:'espera',focus:1,color:BUSINESS_COLORS[3],objective:'Analisar a viabilidade técnica e financeira antes de iniciar.',situation:'Aguardar condições técnicas e financeiras adequadas.',createdAt:stamp},
      {id:'b-oportunidades',name:'Novas oportunidades',status:'exploracao',focus:1,color:BUSINESS_COLORS[4],objective:'Testar ideias de receita com pouco investimento e baixa demanda de tempo.',situation:'Banco de oportunidades a avaliar sem desviar do foco comercial atual.',createdAt:stamp},
      {id:'b-reizzor',name:'REIZZOR STATION',status:'manutencao',focus:1,color:BUSINESS_COLORS[2],objective:'Guardar composições, letras, repertório e áudios-guia em uma estação criativa privada.',situation:'Organização criativa pessoal. Não assumir tarefas coletivas da banda.',createdAt:stamp}
    ],
    appointments:[],
    station:{songs:[]},
    tasks:[
      {id:'t-mercadolivre',businessId:'b-soundline',title:'Publicar o primeiro anúncio no Mercado Livre',notes:'Escolha um cabo pronto, faça fotos reais e suficientes. Publique a primeira versão sem esperar a apresentação perfeita.',status:'open',impact:5,urgency:5,effort:2,minutes:30,due:'',createdAt:stamp,completedAt:null},
      {id:'t-estoque',businessId:'b-soundline',title:'Conferir preço e estoque do primeiro modelo',notes:'Use os dados que já tem. Não transforme a tarefa em uma pesquisa interminável.',status:'open',impact:3,urgency:3,effort:1,minutes:15,due:'',createdAt:stamp,completedAt:null}
    ],
    events:[{id:'e-start',businessId:null,taskId:null,type:'sistema',title:'SÓCIO V001 preparado',note:'Negócios iniciais cadastrados. O primeiro avanço real será registrado quando uma ação for concluída.',createdAt:stamp}],
    skipped:{date:dateKey(now),taskIds:[]}
  };
}
export function stats(data,now=new Date()) {
  const done=data.tasks.filter(t=>t.status==='done');
  const today=dateKey(now);
  return {businesses:data.businesses.length,open:data.tasks.filter(t=>t.status!=='done').length,done:done.length,doneToday:done.filter(t=>t.completedAt && dateKey(new Date(t.completedAt))===today).length,decisions:data.events.filter(e=>e.type==='decisao').length,progress:data.events.filter(e=>['conclusao','avanco'].includes(e.type)).length};
}
