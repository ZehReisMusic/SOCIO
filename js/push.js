import {appointmentReminderEntry,appointmentReminderStatus} from './appointment-reminders.js';
// MEU SÓCIO — push apenas com consentimento e serviço configurado.
const KEY='socio.v003.push';
let notify=()=>{},readData=()=>null;
const get=()=>{try{return {url:'',token:'',hour:'10:00',agendaAlerts:false,deadlineAlerts:false,diagnostic:null,lastSync:null,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return {url:'',token:'',hour:'10:00',agendaAlerts:false,deadlineAlerts:false,diagnostic:null,lastSync:null};}};
const put=c=>localStorage.setItem(KEY,JSON.stringify(c));
const element=id=>document.getElementById(id);
const supported=()=>('Notification' in window)&&('PushManager' in window)&&('serviceWorker' in navigator);
function baseUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password?u.origin:'';}catch{return '';}}
function from64(s){const str=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(str,c=>c.charCodeAt(0));}
async function api(url,path,body,token){
  const response=await fetch(url+path,{method:body===undefined?'GET':'POST',cache:'no-store',
    headers:{'content-type':'application/json',...(token?{'authorization':'Bearer '+token}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||!json.ok)throw Error(json.error||'Serviço indisponível.');
  return json;
}
export function pushState(){const c=get();return {enabled:!!c.token,compatible:supported(),granted:supported()&&Notification.permission==='granted',url:c.url,hour:c.hour};}
export function pendingReminders(data,hour='10:00'){
  if(!data?.events||!data?.tasks)return [];
  const [h,m]=hour.split(':').map(Number),open=new Map(data.tasks.filter(t=>t.status==='open').map(t=>[t.id,t]));
  const found=new Map();
  for(const event of data.events){
    if(event.type!=='adiamento'||!open.has(event.taskId)||!event.createdAt)continue;
    const from=new Date(event.createdAt);
    if(Number.isNaN(from.getTime()))continue;
    const due=new Date(from.getFullYear(),from.getMonth(),from.getDate()+1,h,m).getTime();
    if(due<Date.now()-600000||due>Date.now()+14*86400000)continue;
    if(!found.has(event.taskId)||found.get(event.taskId)<due)found.set(event.taskId,due);
  }
  return [...found].slice(0,20).map(([id,due])=>({id,title:String(open.get(id).title).slice(0,110),dueAt:new Date(due).toISOString()}));
}

// Lembretes de agenda e prazo só entram no servidor quando o usuário ativa cada categoria.
// O teste agendado usa a MESMA rota /sync e o MESMO cron Cloudflare dos avisos reais.
const validWindow=(due,now)=>Number.isFinite(due)&&due>=now-600000&&due<=now+14*86400000;
const serverId=(prefix,id)=>{
  const suffix=String(id||'').replace(/[^\w-]/g,'').slice(0,80);
  return suffix?prefix+'-'+suffix:'';
};
export function smartReminders(data,settings={},now=new Date()){
  if(!data)return [];
  const c={hour:'10:00',agendaAlerts:false,deadlineAlerts:false,diagnostic:null,...settings};
  const clock=now.getTime(),items=[];
  const d=c.diagnostic;
  if(d&&/^diagnostic-\d+$/.test(String(d.id))&&validWindow(Date.parse(d.dueAt),clock)){
    items.push({id:d.id,title:'TESTE AGENDADO — o lembrete automático chegou!',dueAt:d.dueAt});
  }
  // Preserve os avisos de tarefas adiadas, que já são parte do comportamento V003.
  items.push(...pendingReminders(data,c.hour));
  if(c.agendaAlerts&&Array.isArray(data.appointments)){
    for(const appointment of data.appointments){
      if(appointment.status==='done'||!/^\d{4}-\d\d-\d\d$/.test(appointment.date||'')||
         !/^\d\d:\d\d$/.test(appointment.time||''))continue;
      const entry=appointmentReminderEntry(appointment);
      if(!entry||!validWindow(Date.parse(entry.dueAt),clock))continue;
      items.push({id:entry.id,title:entry.title,dueAt:entry.dueAt});
    }
  }
  if(c.deadlineAlerts&&Array.isArray(data.tasks)&&/^\d\d:\d\d$/.test(c.hour)){
    for(const task of data.tasks){
      if(task.status==='done'||!/^\d{4}-\d\d-\d\d$/.test(task.due||''))continue;
      const id=serverId('prazo',task.id);
      const due=new Date(task.due+'T'+c.hour+':00').getTime();
      if(!id||!validWindow(due,clock))continue;
      items.push({id,title:'Prazo de hoje: '+String(task.title||'Tarefa').slice(0,90),dueAt:new Date(due).toISOString()});
    }
  }
  // Limite de 20 registros do Worker: priorize os avisos que vencem primeiro.
  return items.sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt)).slice(0,20);
}

export function agendaReminderStatus(appointment,now=new Date()){
  const c=get();
  const state=pushState();
  return appointmentReminderStatus(appointment,{
    enabled:state.enabled&&state.granted,agendaAlerts:c.agendaAlerts,
    syncedReminders:c.lastSync?.reminders||[]
  },now);
}

export function renderPushSettings(){
  const c=get(),state=pushState();
  const escape=s=>String(s||'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
  let content='<p>Receba lembretes de tarefas adiadas na tela bloqueada, com seu consentimento.</p>';
  content+='<span class="soft-pill">'+(state.enabled&&state.granted?'Conectado · Web Push':'Aguardando ativação')+'</span>';
  if(state.enabled){
    content+='<div class="form-field"><label for="push-time">Horário dos lembretes</label><input id="push-time" type="time" value="'+escape(c.hour)+'"></div>';
    content+='<button type="button" class="btn-primary" data-action="push-time">Salvar horário</button>';
    content+='<button type="button" class="btn-quiet" data-action="push-test">Enviar teste</button>';
    content+='<button type="button" class="btn-quiet" data-action="push-scheduled-test">⏱ Testar lembrete agendado</button>';
    const futureTest=c.diagnostic?.dueAt&&Date.parse(c.diagnostic.dueAt)>Date.now()-600000;
    if(futureTest){
      const when=new Date(c.diagnostic.dueAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      content+='<p class="push-diagnostic-note">Teste real enviado ao agendamento para '+escape(when)+'. O Cloudflare verifica os avisos a cada cinco minutos. Confira a tela bloqueada; este indicador não confirma a entrega.</p>';
    }
    content+='<div class="push-preferences"><strong>Lembretes inteligentes (opcionais)</strong>';
    content+='<label class="push-check"><input type="checkbox" id="push-agenda-alerts" '+(c.agendaAlerts?'checked':'')+'> Compromissos da agenda (avisos individuais: 10, 30 ou 60 min antes)</label>';
    content+='<label class="push-check"><input type="checkbox" id="push-deadline-alerts" '+(c.deadlineAlerts?'checked':'')+'> Tarefas com prazo (no horário acima)</label>';
    content+='<button type="button" class="btn-quiet" data-action="push-save-preferences">Salvar lembretes inteligentes</button>';
    content+='<p>Desativados por padrão. Seus avisos só são agendados quando o aplicativo sincroniza; horizonte de até 14 dias.</p></div>';
    content+='<button type="button" class="btn-quiet" data-action="push-disable">Desativar</button>';
  }else{
    content+='<p style="font-size:12px">É necessário conectar o serviço privado de notificações antes de ativar.</p>';
    content+='<div class="form-field"><label for="push-url">Endereço do serviço Cloudflare</label><input id="push-url" type="url" placeholder="https://seu-servico.workers.dev" value="'+escape(c.url)+'"></div>';
    content+='<div class="form-field"><label for="push-pin">Chave privada de ativação</label><input id="push-pin" type="password" autocomplete="off" placeholder="Somente neste aplicativo"></div>';
    content+='<button type="button" class="btn-primary" data-action="push-enable" '+(state.compatible?'':'disabled')+'>Ativar notificações</button>';
    content+='<p style="font-size:12px">A chave não é armazenada. Nenhum aviso é enviado antes da ativação.</p>';
  }
  return '<div class="setting-card"><h2>🔔 Notificações · MEU SÓCIO</h2>'+content+'</div>';
}
export async function enablePush(){
  if(!supported())return notify('Abra pelo aplicativo instalado na tela inicial do iPhone.');
  const url=baseUrl(element('push-url')?.value||''),passphrase=element('push-pin')?.value||'';
  if(!url)return notify('Informe o endereço HTTPS do serviço.');
  if(passphrase.length<24)return notify('Informe a chave de ativação do Cloudflare.');
  // Solicitação direta após toque: exigência do iOS.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')return notify('Permissão de notificações negada.');
  try{
    const config=await api(url,'/config');
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:from64(config.publicKey)});
    const registered=await api(url,'/register',{passphrase,subscription:sub.toJSON()});
    put({url,token:registered.token,hour:'10:00'});
    if(element('push-pin'))element('push-pin').value='';
    await syncPush(readData(),true);
    notify('Notificações ativadas. Faça um teste em Ajustes.');return true;
  }catch(err){notify('Falha na ativação: '+err.message);return false;}
}
export async function syncPush(data,force=false){
  const c=get();
  if(!c.token||!c.url||!data||Notification.permission!=='granted')return false;
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(!sub)return false;
    const reminders=smartReminders(data,c);
    await api(c.url,'/sync',{subscription:sub.toJSON(),reminders},c.token);
    // Só afirmamos "sincronizado" depois da confirmação da API, nunca só por salvar localmente.
    const current=get();
    if(current.url===c.url&&current.token===c.token){
      put({...current,lastSync:{at:Date.now(),reminders:reminders.map(({id,dueAt})=>({id,dueAt}))}});
      document.dispatchEvent(new Event('socio:push-synced'));
    }
    return true;
  }catch(err){console.warn('SÓCIO: sincronização de lembretes pendente',err);return false;}
}
export async function updatePushTime(){
  const c=get(),hour=element('push-time')?.value||'';
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))return notify('Horário inválido.');
  put({...c,hour});
  const ok=await syncPush(readData(),true);
  notify(ok?'Horário alterado e sincronizado.':'Horário salvo no iPhone; sincronização pendente.');
  return ok;
}

export async function schedulePushDiagnostic(){
  const c=get();
  if(!c.token||!c.url)return notify('Ative o Web Push neste atalho antes de agendar.');
  if(c.diagnostic&&Date.parse(c.diagnostic.dueAt)>Date.now()-7*60000){
    return notify('Um teste recente ainda pode chegar. Aguarde até sete minutos após o horário agendado.');
  }
  const dueAt=new Date(Date.now()+90000).toISOString();
  const diagnostic={id:'diagnostic-'+Date.now(),dueAt};
  put({...c,diagnostic});
  const ok=await syncPush(readData(),true);
  if(!ok){put(c);notify('Teste não agendado: sincronização com o servidor falhou.');return false;}
  const at=new Date(dueAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  notify('Teste real agendado para '+at+'. A entrega pode ocorrer nos cinco minutos seguintes.');
  return true;
}
export async function savePushPreferences(){
  const c=get();
  if(!c.token)return notify('Ative as notificações para escolher os lembretes.');
  const agendaAlerts=!!element('push-agenda-alerts')?.checked;
  const deadlineAlerts=!!element('push-deadline-alerts')?.checked;
  put({...c,agendaAlerts,deadlineAlerts});
  const ok=await syncPush(readData(),true);
  if(!ok){put(c);notify('Não foi possível confirmar no servidor; preferências anteriores mantidas.');return false;}
  notify('Preferências sincronizadas. Compromissos e prazos são opcionais.');
  return true;
}

export async function testPush(){
  const c=get();
  if(!c.token)return notify('Ative as notificações primeiro.');
  try{await api(c.url,'/test',{},c.token);notify('Teste enviado. Confira o iPhone.');}
  catch(err){notify('Falha ao enviar o teste: '+err.message);}
}
export async function disablePush(){
  const c=get();
  if(!c.token)return true;
  try{
    await api(c.url,'/disable',{},c.token);
    const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if(sub)await sub.unsubscribe();
    put({url:c.url,hour:c.hour,token:''});notify('Notificações desativadas.');return true;
  }catch(err){notify('Não foi possível desativar no servidor. Tente com internet.');return false;}
}
export function initPush(options){notify=options.notify;readData=options.data;}
