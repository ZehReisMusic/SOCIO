import { buildPushPayload } from '@block65/webcrypto-web-push';
const ORIGIN='https://zehreismusic.github.io';
const APP_URL='https://zehreismusic.github.io/SOCIO/#executar';
const headers={ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'};
const json=(body,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{...headers,...(origin===ORIGIN?{'access-control-allow-origin':ORIGIN,'vary':'Origin'}:{})}});
const error=(message,status,origin)=>json({ok:false,error:message},status,origin);
const stamp=()=>Math.floor(Date.now()/1000);
async function parse(req){const data=await req.text();if(data.length>16000)throw Error('Body too large');return JSON.parse(data);}
const base64=buffer=>btoa(String.fromCharCode(...buffer)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hash(str){return base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str))));}
function checkSub(value){
  if(!value || typeof value.endpoint!=='string'||!value.keys)return null;
  let url;try{url=new URL(value.endpoint);}catch{return null;}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.port||url.username||url.password||
    !(host==='web.push.apple.com'||host.endsWith('.push.apple.com')||
    host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'))return null;
  const keys=value.keys;
  if(!/^[\w-]{40,150}$/.test(keys.p256dh||'')||!/^[\w-]{12,40}$/.test(keys.auth||''))return null;
  return {endpoint:url.href,expirationTime:null,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
async function deviceOf(req,env){
  const found=/^Bearer ([\w-]{30,100})$/.exec(req.headers.get('authorization')||'');
  if(!found)return null;
  return env.DB.prepare('SELECT * FROM devices WHERE token_hash=? AND enabled=1').bind(await hash(found[1])).first();
}
async function deliver(env,sub,data){
  const subscription=JSON.parse(sub);
  const packet=await buildPushPayload({data:JSON.stringify({...data,title:'MEU SÓCIO',url:APP_URL}),options:{ttl:3600}},subscription,{
    subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY
  });
  return (await fetch(subscription.endpoint,packet)).status;
}
async function register(req,env,origin){
  if(!env.DB||!env.SETUP_SECRET||env.SETUP_SECRET.length<24||!env.VAPID_PRIVATE_KEY||!env.VAPID_PUBLIC_KEY)
    return error('Serviço ainda não configurado.',503,origin);
  const data=await parse(req);
  if(typeof data.passphrase!=='string'||data.passphrase!==env.SETUP_SECRET)return error('Código de ativação inválido.',403,origin);
  const sub=checkSub(data.subscription);
  if(!sub)return error('Inscrição inválida.',400,origin);
  const total=await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first();
  if(total.n>=5)return error('Limite pessoal de dispositivos atingido.',429,origin);
  const token=base64(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO devices (id,token_hash,subscription,enabled,created_at) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(),await hash(token),JSON.stringify(sub),1,stamp()).run();
  return json({ok:true,token},201,origin);
}
async function sync(req,env,origin,device){
  const data=await parse(req);
  if(!Array.isArray(data.reminders)||data.reminders.length>20)return error('Lembretes inválidos.',400,origin);
  const items=[];
  for(const value of data.reminders){
    if(!value||typeof value.id!=='string'||!/^[\w-]{1,100}$/.test(value.id)||
       typeof value.title!=='string'||value.title.length>120||!value.title.trim()||
       typeof value.dueAt!=='string')return error('Lembrete inválido.',400,origin);
    const due=Date.parse(value.dueAt);
    if(!Number.isFinite(due)||due<Date.now()-600000||due>Date.now()+14*86400000)continue;
    if(items.some(r=>r.id===value.id))return error('Lembrete duplicado.',400,origin);
    items.push({id:value.id,title:value.title.trim(),due:Math.floor(due/1000)});
  }
  const jobs=[];
  for(const item of items){
    const sql='INSERT INTO reminders(id,device_id,title,due_at,attempts,sent_at) VALUES (?,?,?,?,0,NULL) '+
      'ON CONFLICT(id) DO UPDATE SET title=excluded.title,due_at=excluded.due_at,'+
      'attempts=CASE WHEN reminders.due_at=excluded.due_at THEN reminders.attempts ELSE 0 END,'+
      'sent_at=CASE WHEN reminders.due_at=excluded.due_at THEN reminders.sent_at ELSE NULL END '+
      'WHERE reminders.device_id=excluded.device_id';
    jobs.push(env.DB.prepare(sql).bind(device.id+':'+item.id,device.id,item.title,item.due));
  }
  if(items.length){
    const ids=items.map(v=>device.id+':'+v.id);
    jobs.push(env.DB.prepare('DELETE FROM reminders WHERE device_id=? AND id NOT IN ('+ids.map(()=>'?').join(',')+')').bind(device.id,...ids));
  }else jobs.push(env.DB.prepare('DELETE FROM reminders WHERE device_id=?').bind(device.id));
  if(data.subscription){
    const sub=checkSub(data.subscription);if(!sub)return error('Inscrição inválida.',400,origin);
    jobs.unshift(env.DB.prepare('UPDATE devices SET subscription=? WHERE id=?').bind(JSON.stringify(sub),device.id));
  }
  await env.DB.batch(jobs);
  return json({ok:true,count:items.length},200,origin);
}
async function test(env,origin,device){
  const now=stamp(),day=new Date().toISOString().slice(0,10);
  if(now-device.last_test_at<45)return error('Aguarde 45 segundos.',429,origin);
  if(device.test_day===day&&device.tests_today>=3)return error('Máximo de 3 testes por dia.',429,origin);
  await env.DB.prepare('UPDATE devices SET last_test_at=?,test_day=?,tests_today=? WHERE id=?')
    .bind(now,day,device.test_day===day?device.tests_today+1:1,device.id).run();
  const status=await deliver(env,device.subscription,{body:'Teste recebido! As notificações estão conectadas.',tag:'socio-test'});
  if(status===404||status===410){await env.DB.prepare('UPDATE devices SET enabled=0 WHERE id=?').bind(device.id).run();return error('Inscrição expirada.',410,origin);}
  if(status<200||status>=300)return error('Serviço de push: '+status,502,origin);
  return json({ok:true,accepted:true},200,origin);
}
async function scheduled(env){
  if(!env.DB||!env.VAPID_PRIVATE_KEY)return;
  const now=stamp();
  const result=await env.DB.prepare('SELECT r.id,r.device_id,r.title,d.subscription FROM reminders r JOIN devices d ON d.id=r.device_id '+
    'WHERE r.sent_at IS NULL AND r.due_at<=? AND r.due_at>? AND r.attempts<3 AND d.enabled=1 ORDER BY r.due_at LIMIT 40')
    .bind(now,now-7200).all();
  const groups=new Map();
  for(const row of result.results||[]){if(!groups.has(row.device_id))groups.set(row.device_id,[]);groups.get(row.device_id).push(row);}
  for(const group of groups.values()){
    const claimed=[];
    for(const row of group){
      const res=await env.DB.prepare('UPDATE reminders SET sent_at=?,attempts=attempts+1 WHERE id=? AND sent_at IS NULL').bind(now,row.id).run();
      if(res.meta?.changes)claimed.push(row.id);
    }
    if(!claimed.length)continue;
    const body=claimed.length===1?'Uma prioridade ficou pendente: '+group[0].title:'Você tem '+claimed.length+' prioridades adiadas. Uma coisa de cada vez.';
    try{
      const status=await deliver(env,group[0].subscription,{body,tag:'socio-priority'});
      if(status===404||status===410)await env.DB.prepare('UPDATE devices SET enabled=0 WHERE id=?').bind(group[0].device_id).run();
      else if(status<200||status>=300)for(const id of claimed)await env.DB.prepare('UPDATE reminders SET sent_at=NULL WHERE id=?').bind(id).run();
    }catch(err){
      console.error('Push falhou',String(err));
      for(const id of claimed)await env.DB.prepare('UPDATE reminders SET sent_at=NULL WHERE id=?').bind(id).run();
    }
  }
}
export default {
  async fetch(req,env){
    const origin=req.headers.get('origin')||'';
    if(req.method==='OPTIONS')return origin===ORIGIN?new Response(null,{status:204,headers:{
      'access-control-allow-origin':ORIGIN,'access-control-allow-headers':'Content-Type,Authorization',
      'access-control-allow-methods':'GET,POST,OPTIONS','access-control-max-age':'600'}}):new Response(null,{status:403});
    const path=new URL(req.url).pathname;
    if(path==='/health')return json({ok:true,service:'meu-socio-push'},200,origin);
    if(origin&&origin!==ORIGIN)return error('Origem não permitida.',403,origin);
    if(path==='/config'&&req.method==='GET')return env.VAPID_PUBLIC_KEY?json({ok:true,publicKey:env.VAPID_PUBLIC_KEY},200,origin):error('Serviço indisponível.',503,origin);
    if(req.method!=='POST')return error('Rota não encontrada.',404,origin);
    if(origin!==ORIGIN)return error('Origem não permitida.',403,origin);
    try{
      if(path==='/register')return await register(req,env,origin);
      const device=await deviceOf(req,env);
      if(!device)return error('Dispositivo não autorizado.',401,origin);
      if(path==='/sync')return await sync(req,env,origin,device);
      if(path==='/test')return await test(env,origin,device);
      if(path==='/disable'){
        await env.DB.batch([env.DB.prepare('DELETE FROM reminders WHERE device_id=?').bind(device.id),
          env.DB.prepare('DELETE FROM devices WHERE id=?').bind(device.id)]);
        return json({ok:true},200,origin);
      }
      return error('Rota não encontrada.',404,origin);
    }catch(err){console.error(String(err));return error('Falha ao processar a solicitação.',400,origin);}
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(scheduled(env));}
};