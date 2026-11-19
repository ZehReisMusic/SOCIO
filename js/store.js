import {seedData, BUSINESS_STATES, BUSINESS_COLORS, clamp, safeDate} from './logic.js';
export const STORAGE_KEY = 'socio.v001.data';
export function readData(){
  try { const raw=localStorage.getItem(STORAGE_KEY); if(!raw){const initial=seedData();writeData(initial);return initial;} return validateData(JSON.parse(raw)); }
  catch(err){ console.warn('Falha ao ler dados; iniciando sessão temporária.',err); return seedData(); }
}
export function writeData(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}catch(err){console.error('Armazenamento indisponível:',err);return false;}}
export function validateData(value){
  if(!value || typeof value !== 'object' || value.version!==1 || !Array.isArray(value.businesses)||!Array.isArray(value.tasks)||!Array.isArray(value.events)) throw new Error('Arquivo inválido ou incompatível com a V001.');
  if(value.businesses.length>1000||value.tasks.length>10000||value.events.length>50000) throw new Error('Arquivo muito grande.');
  const clean=(v,max=2000)=>String(v??'').slice(0,max);
  const b=value.businesses.map(v=>({id:clean(v.id,100),name:clean(v.name,120),status:BUSINESS_STATES[v.status]?v.status:'exploracao',focus:clamp(v.focus,1,5),color:BUSINESS_COLORS.includes(v.color)?v.color:BUSINESS_COLORS[0],objective:clean(v.objective),situation:clean(v.situation),createdAt:clean(v.createdAt,40)}));
  const ids=new Set(b.map(x=>x.id));
  const t=value.tasks.map(v=>({id:clean(v.id,100),businessId:ids.has(v.businessId)?v.businessId:'',title:clean(v.title,250),notes:clean(v.notes,3000),status:v.status==='done'?'done':'open',impact:clamp(v.impact,1,5),urgency:clamp(v.urgency,1,5),effort:clamp(v.effort,1,5),minutes:clamp(v.minutes||20,5,240),due:safeDate(v.due),createdAt:clean(v.createdAt,40),completedAt:v.completedAt?clean(v.completedAt,40):null}));
  const e=value.events.map(v=>({id:clean(v.id,100),businessId:ids.has(v.businessId)?v.businessId:null,taskId:v.taskId?clean(v.taskId,100):null,type:['sistema','decisao','avanco','conclusao','reaberta','agenda'].includes(v.type)?v.type:'sistema',title:clean(v.title,250),note:clean(v.note,3000),createdAt:clean(v.createdAt,40)}));
  const validAppointmentDate=d=>{if(!safeDate(d))return false;const [y,m,day]=d.split('-').map(Number);const check=new Date(y,m-1,day);return check.getFullYear()===y&&check.getMonth()===m-1&&check.getDate()===day;};
  const appointments=Array.isArray(value.appointments)?value.appointments.slice(0,5000).filter(v=>v&&validAppointmentDate(v.date)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.time||'')).map(v=>({id:clean(v.id,100),title:clean(v.title,250),date:v.date,time:v.time,notes:clean(v.notes,3000),source:v.source==='voz'?'voz':'manual',status:v.status==='done'?'done':'open',createdAt:clean(v.createdAt,40)})).filter(v=>v.title):[];
  const date=/^\d{4}-\d{2}-\d{2}$/.test(value.skipped?.date||'')?value.skipped.date:'';
  const taskIds=new Set(t.map(x=>x.id));
  return {version:1,businesses:b,tasks:t,events:e,appointments,skipped:{date,taskIds:Array.isArray(value.skipped?.taskIds)?value.skipped.taskIds.filter(v=>taskIds.has(v)).slice(0,10000):[]}};
}
export function downloadJson(data){const str=JSON.stringify(data,null,2);const blob=new Blob([str],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`socio-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
