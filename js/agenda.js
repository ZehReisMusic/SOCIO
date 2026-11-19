/** Conversão simples de fala em compromisso. Sempre exige revisão antes de salvar. */
import {dateKey} from './logic.js';

const words={zero:0,uma:1,um:1,duas:2,dois:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,vinteum:21,vinteedois:22,vinteetres:23};
const months={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
const weekdays={domingo:0,segunda:1,terca:2,quarta:3,quinta:4,sexta:5,sabado:6};
const unaccent=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const pad=n=>String(n).padStart(2,'0');
function localDate(year,month,day){const d=new Date(year,month-1,day);return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?dateKey(d):'';}
function addDays(today,days){const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+days);return dateKey(d);}
function nextDayOfMonth(today,day,month,year){const baseMonth=month||today.getMonth()+1,baseYear=year||today.getFullYear();let date=localDate(baseYear,baseMonth,day);if(!date)return '';if(!year&&month&&date<dateKey(today))date=localDate(baseYear+1,baseMonth,day);if(!year&&!month&&date<dateKey(today)){const next=new Date(today.getFullYear(),today.getMonth()+1,day);date=next.getDate()===day?dateKey(next):'';}return date;}
function wordNumber(str){let s=unaccent(str).trim().replace(/\s+/g,'');return /^\d+$/.test(s)?Number(s):words[s];}
function pickTime(sentence){let match=sentence.match(/\b(?:as|pelas|para as)\s+(\d{1,2})(?:\s*(?:h|horas?)(?:\s*(\d{1,2}))?|:(\d{2}))?\b/)||sentence.match(/\b(\d{1,2})\s*(?:h|horas?)(?:\s*(\d{1,2}))?\b/);
 let hour,minute=0,span='';
 if(match){hour=Number(match[1]);minute=Number(match[2]||match[3]||0);span=match[0];}
 else {match=sentence.match(/\b(?:as|pelas)\s+(vinte e (?:um|dois|tres)|vinte|dezesseis|dezessete|dezoito|dezenove|quinze|quatorze|catorze|treze|doze|onze|dez|nove|oito|sete|seis|cinco|quatro|tres|duas|dois|uma|um)(?:\s+horas?)?(?:\s+e\s+(meia|\d{1,2}))?\b/);if(match){hour=wordNumber(match[1]);minute=match[2]==='meia'?30:match[2]?Number(match[2]):0;span=match[0];}}
 if(hour===undefined||hour>23||minute>59)return {time:'',span:''};
 const portion=sentence.slice(match.index+span.length).match(/^\s*(?:da\s+(manha|tarde|noite)|de\s+madrugada)\b/);
 if(portion){span+=portion[0];if(portion[1]==='tarde'&&hour<12)hour+=12;if(portion[1]==='noite'&&hour<12)hour=(hour+12)%24;}
 return {time:`${pad(hour)}:${pad(minute)}`,span};
}
export function parseVoiceAppointment(transcript,now=new Date()){
 const raw=String(transcript||'').trim();const sentence=unaccent(raw).replace(/[.,!?]/g,' ');let date='',dateSpan='';
 // Datas explícitas (DD/MM ou DD/MM/AAAA).
 let m=sentence.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
 if(m){date=nextDayOfMonth(now,Number(m[1]),Number(m[2]),m[3]?Number(m[3]):undefined);dateSpan=m[0];}
 if(!date){m=sentence.match(/\bdia\s+(\d{1,2})(?:\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))?(?:\s+de\s+(\d{4}))?\b/);if(m){date=nextDayOfMonth(now,Number(m[1]),months[m[2]],m[3]?Number(m[3]):undefined);dateSpan=m[0];}}
 if(!date){m=sentence.match(/\b(depois de amanha|amanha|hoje)\b/);if(m){date=addDays(now,m[1]==='hoje'?0:m[1]==='amanha'?1:2);dateSpan=m[0];}}
 if(!date){m=sentence.match(/\b(?:(proxima|proximo|na|no|nesta|neste)\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?\b/);if(m){const distance=(weekdays[m[2]]-now.getDay()+7)%7;date=addDays(now,distance+(m[1]==='proxima'||m[1]==='proximo'?7:0));dateSpan=m[0];}}
 const {time,span:timeSpan}=pickTime(sentence);
 let title=raw.replace(/[.,!?]/g,' ');
 // A normalização retira apenas acentos, sem mudar a posição dos caracteres em português comum.
 const blank=(piece)=>{const i=sentence.indexOf(piece);if(i>=0)title=title.slice(0,i)+' '.repeat(piece.length)+title.slice(i+piece.length);};
 if(dateSpan)blank(dateSpan);
 if(timeSpan)blank(timeSpan);
 title=title.replace(/^\s*(?:agendar|agenda|marcar|marca|colocar na agenda|me lembra de|me lembre de|lembre-me de|preciso|eu tenho|tenho|compromisso(?: de| com)?|uma reunião de)\b\s*/i,'').replace(/\b(?:para|no|na)\s*$/i,'').replace(/\s+/g,' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g,'');

 return {title:title.charAt(0).toLocaleUpperCase('pt-BR')+title.slice(1),date,time,recognized:{date:Boolean(date),time:Boolean(time)},transcript:raw};
}

export function appointmentDateTime(a){return new Date(`${a.date}T${a.time||'00:00'}:00`);}
export function sortAppointments(list){return [...list].sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));}
