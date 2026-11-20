// MEU SÓCIO — push apenas com consentimento e serviço configurado.
const KEY='socio.v003.push';
let notify=()=>{},readData=()=>null;
const get=()=>{try{return {url:'',token:'',hour:'10:00',...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return {url:'',token:'',hour:'10:00'};}};
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
export function renderPushSettings(){
  const c=get(),state=pushState();
  const escape=s=>String(s||'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));
  let content='<p>Receba lembretes de tarefas adiadas na tela bloqueada, com seu consentimento.</p>';
  content+='<span class="soft-pill">'+(state.enabled&&state.granted?'Conectado · Web Push':'Aguardando ativação')+'</span>';
  if(state.enabled){
    content+='<div class="form-field"><label for="push-time">Horário dos lembretes</label><input id="push-time" type="time" value="'+escape(c.hour)+'"></div>';
    content+='<button type="button" class="btn-primary" data-action="push-time">Salvar horário</button>';
    content+='<button type="button" class="btn-quiet" data-action="push-test">Enviar teste</button>';
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
    await api(c.url,'/sync',{subscription:sub.toJSON(),reminders:pendingReminders(data,c.hour)},c.token);
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
