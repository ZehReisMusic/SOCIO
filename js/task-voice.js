/** Cadastro de Tarefas por Voz: interpretação local e revisável, nunca salva automaticamente. */
import {dateKey} from './logic.js';
const normalize=s=>String(s||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const pad=n=>String(n).padStart(2,'0');
const validDate=(y,m,d)=>{const date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;};
const dayKey=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;

export function parseVoiceTask(transcript,businesses=[],now=new Date()){
 const raw=String(transcript??'').trim().slice(0,1500);
 let simplified=normalize(raw),title=raw,date='',minutes=null,businessId='',dateIndex=-1;
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 let dateSpan='';
 const absolute=simplified.match(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
 if(absolute){
   const d=Number(absolute[1]),m=Number(absolute[2]);
   let y=absolute[3]?Number(absolute[3]):now.getFullYear();
   if(!absolute[3]&&validDate(y,m,d)&&dayKey(y,m,d)<dateKey(today))y++;
   if(validDate(y,m,d)){date=dayKey(y,m,d);dateSpan=absolute[0];dateIndex=absolute.index;}
 }
 if(!date){
   const relative=simplified.match(/\b(depois\s+de\s+amanha|amanha|hoje)\b/);
   if(relative){const offset=relative[1]==='hoje'?0:relative[1]==='amanha'?1:2;
     const target=new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset);
     date=dateKey(target);dateSpan=relative[0];dateIndex=relative.index;
   }
 }
 // Duração só com indicação explícita: não confundir horário com esforço.
 let durationSpan='',durationIndex=-1;
 const duration=simplified.match(/\b(?:duracao(?:\s+estimada)?|tempo(?:\s+estimado)?|leva(?:r)?(?:\s+cerca\s+de)?|demora(?:r)?)\s*(?:de\s+)?(\d{1,3}|uma?|meia)\s*(minutos?|mins?|horas?|h)\b/);
 if(duration){
   const quantity=duration[1]==='meia'?0.5:duration[1]==='uma'||duration[1]==='um'?1:Number(duration[1]);
   const n=Math.round(quantity*(/^(?:h|hora)/.test(duration[2])?60:1));
   if([5,10,15,20,30,45,60,90,120].includes(n)){minutes=n;durationSpan=duration[0];durationIndex=duration.index;}
 }
 const names=(Array.isArray(businesses)?businesses:[]).filter(b=>b&&b.id&&b.name)
   .map(b=>({...b,lookup:normalize(b.name)})).sort((a,b)=>b.lookup.length-a.lookup.length);
 const related=names.find(b=>b.lookup.length>=3&&simplified.includes(b.lookup));
 if(related)businessId=related.id;
 // Remoção por índice preserva os acentos e as palavras da fala original.
 const erase=(index,span)=>{if(index>=0&&span)title=title.slice(0,index)+' '.repeat(span.length)+title.slice(index+span.length);};
 erase(dateIndex,dateSpan);erase(durationIndex,durationSpan);
 title=title.replace(/^\s*(?:criar|crie|cadastrar|cadastre|adicionar|adicione|anotar|anote|registrar|registre|nova tarefa|preciso|tenho que|tarefa)\s*(?:uma?\s+tarefa\s*)?(?:de\s+)?/i,'');
 title=title.replace(/\s+(?:ate|para|no|na|em|de)\s*$/i,'').replace(/\s+/g,' ').trim();
 // Preserva a redação original de quem falou no formulário revisável.
 const human=title?title.charAt(0).toLocaleUpperCase('pt-BR')+title.slice(1):'';
 return {title:human.slice(0,250),due:date,minutes,businessId,transcript:raw};
}
