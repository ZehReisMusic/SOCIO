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
  // Migração única dos backups anteriores: acrescenta a Estação sem apagar dados existentes.
  const hadStation=Object.prototype.hasOwnProperty.call(value,'station');
  if(!hadStation && !b.some(x=>x.id==='b-reizzor')) b.push({id:'b-reizzor',name:'REIZZOR STATION',status:'manutencao',focus:1,color:BUSINESS_COLORS[2],objective:'Composição, repertório e guias privados.',situation:'Estação criativa pessoal, sem tarefas coletivas.',createdAt:new Date().toISOString()});
  const ids=new Set(b.map(x=>x.id));
  const stationSongs=Array.isArray(value.station?.songs)?value.station.songs.slice(0,150).map(v=>{
    const guides=Array.isArray(v?.guides)?v.guides.slice(0,12).map(g=>({id:clean(g?.id,100),label:clean(g?.label,100),url:clean(g?.url,1500).trim()})).filter(g=>g.label&&/^https:\/\/[^\s]+$/i.test(g.url)):[];
    return {id:clean(v?.id,100),title:clean(v?.title,140),key:clean(v?.key,60),tuning:clean(v?.tuning,100),bpm:Math.min(300,Math.max(0,Math.round(Number(v?.bpm)||0))),status:['ideia','desenvolvimento','repertorio','concluida'].includes(v?.status)?v.status:'ideia',lyrics:clean(v?.lyrics,12000),notes:clean(v?.notes,4000),guides,createdAt:clean(v?.createdAt,40),updatedAt:clean(v?.updatedAt,40)};
  }).filter(s=>s.id&&s.title):[];
  const station={songs:stationSongs};
  const t=value.tasks.map(v=>({id:clean(v.id,100),businessId:ids.has(v.businessId)?v.businessId:'',title:clean(v.title,250),notes:clean(v.notes,3000),status:v.status==='done'?'done':'open',impact:clamp(v.impact,1,5),urgency:clamp(v.urgency,1,5),effort:clamp(v.effort,1,5),minutes:clamp(v.minutes||20,5,240),due:safeDate(v.due),createdAt:clean(v.createdAt,40),completedAt:v.completedAt?clean(v.completedAt,40):null}));
  const e=value.events.map(v=>({id:clean(v.id,100),businessId:ids.has(v.businessId)?v.businessId:null,taskId:v.taskId?clean(v.taskId,100):null,type:['sistema','decisao','avanco','conclusao','reaberta','agenda','adiamento'].includes(v.type)?v.type:'sistema',title:clean(v.title,250),note:clean(v.note,3000),createdAt:clean(v.createdAt,40)}));
  const validAppointmentDate=d=>{if(!safeDate(d))return false;const [y,m,day]=d.split('-').map(Number);const check=new Date(y,m-1,day);return check.getFullYear()===y&&check.getMonth()===m-1&&check.getDate()===day;};
  const appointments=Array.isArray(value.appointments)?value.appointments.slice(0,5000).filter(v=>v&&validAppointmentDate(v.date)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.time||'')).map(v=>({id:clean(v.id,100),title:clean(v.title,250),date:v.date,time:v.time,notes:clean(v.notes,3000),source:v.source==='voz'?'voz':'manual',status:v.status==='done'?'done':'open',createdAt:clean(v.createdAt,40)})).filter(v=>v.title):[];
  const date=/^\d{4}-\d{2}-\d{2}$/.test(value.skipped?.date||'')?value.skipped.date:'';
  const taskIds=new Set(t.map(x=>x.id));
  return {version:1,businesses:b,tasks:t,events:e,appointments,station,skipped:{date,taskIds:Array.isArray(value.skipped?.taskIds)?value.skipped.taskIds.filter(v=>taskIds.has(v)).slice(0,10000):[]}};
}
export function downloadJson(data){const str=JSON.stringify(data,null,2);const blob=new Blob([str],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`socio-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
