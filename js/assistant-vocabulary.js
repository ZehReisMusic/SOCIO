/** Vocabulário local do SÓCIO: correções aprovadas de transcrição.
 * Nenhuma chamada externa; regras exatas de palavra/frase curta, sem alteração de áudios. */
export const MAX_VOCABULARY=100;
const WORD=/[\p{L}\p{N}]+/gu;
const terms=s=>[...String(s??'').matchAll(WORD)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));
const norm=s=>String(s??'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const key=s=>norm(s).trim().replace(/\s+/g,' ');
const safePhrase=s=>String(s??'').trim().replace(/\s+/g,' ').slice(0,40);
const valid=s=>/^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+){0,3}$/u.test(s)&&key(s).length>=2&&s.length<=40;
const stopwords=new Set(['a','o','as','os','de','da','do','das','dos','em','no','na','um','uma','que','qual','hoje','amanha','por','para','com','sem','sim','nao','se','eu','meu','minha','seu','sua','voce','tarefa','agenda','horario','horarios']);
export function normalizeVocabulary(raw){
 const output=[],seen=new Set();
 for(const item of Array.isArray(raw)?raw:[]){
  if(output.length>=MAX_VOCABULARY)break;
  const heard=safePhrase(item?.heard),correct=safePhrase(item?.correct),k=key(heard);
  if(!valid(heard)||!valid(correct)||k===key(correct)||seen.has(k))continue;
  seen.add(k);output.push({heard,correct});
 }
 return output;
}
export function addVocabulary(raw,heardInput,correctInput){
 const heard=safePhrase(heardInput),correct=safePhrase(correctInput);
 if(!valid(heard)||!valid(correct))return {ok:false,reason:'Use palavras ou expressões de até quatro termos (máximo 40 caracteres cada).'};
 if(key(heard)===key(correct))return {ok:false,reason:'A correção precisa ser diferente do que foi reconhecido.'};
 const entries=normalizeVocabulary(raw),existing=entries.findIndex(e=>key(e.heard)===key(heard));
 if(existing>=0){
  if(key(entries[existing].correct)===key(correct))return {ok:false,reason:'Esta correção já está cadastrada.'};
  return {ok:false,reason:'Esta expressão já possui uma correção. Exclua a anterior para substituí-la.'};
 }
 if(entries.length>=MAX_VOCABULARY)return {ok:false,reason:'O vocabulário atingiu o limite de 100 correções.'};
 return {ok:true,entries:[...entries,{heard,correct}],entry:{heard,correct}};
}
export function removeVocabulary(raw,heard){
 return normalizeVocabulary(raw).filter(e=>key(e.heard)!==key(heard));
}
/** Troca termos inteiros, tolera maiúsculas/acentos, respeita pontuação externa.
 * Não faz substituições em cascata, nem dentro de outras palavras. */
export function applyVocabulary(text,raw){
 const input=String(text??''),entries=normalizeVocabulary(raw);
 if(!entries.length||!input)return input;
 const words=terms(input),options=entries.map(e=>({...e,words:terms(e.heard).map(x=>key(x.text))}))
  .sort((a,b)=>b.words.length-a.words.length||b.heard.length-a.heard.length);
 let output='',offset=0,index=0;
 while(index<words.length){
  let selected=null;
  for(const entry of options){
   if(index+entry.words.length>words.length)continue;
   let match=true;
   for(let k=0;k<entry.words.length;k++){
    const item=words[index+k];
    if(key(item.text)!==entry.words[k]){match=false;break;}
    if(k>0&&!/^\s+$/u.test(input.slice(words[index+k-1].end,item.start))){match=false;break;}
   }
   if(match){selected=entry;break;}
  }
  if(!selected){index++;continue;}
  const start=words[index].start,end=words[index+selected.words.length-1].end;
  output+=input.slice(offset,start)+selected.correct;
  offset=end;index+=selected.words.length;
 }
 return output+input.slice(offset);
}
/** Considera aprendizado somente após edição MANUAL da mesma frase.
 * Deve haver contexto preservado e apenas uma palavra/expressão trocada. */
export function proposeVoiceCorrection(before,after){
 const a=terms(String(before||'').slice(0,350)),b=terms(String(after||'').slice(0,350));
 if(a.length<4||b.length<4)return null;
 let prefix=0;
 while(prefix<a.length&&prefix<b.length&&key(a[prefix].text)===key(b[prefix].text))prefix++;
 let suffix=0;
 while(suffix<a.length-prefix&&suffix<b.length-prefix&&key(a[a.length-1-suffix].text)===key(b[b.length-1-suffix].text))suffix++;
 const left=a.slice(prefix,a.length-suffix),right=b.slice(prefix,b.length-suffix);
 if(prefix+suffix<3||!left.length||!right.length||left.length>3||right.length>3)return null;
 const heard=left.map(x=>x.text).join(' '),correct=right.map(x=>x.text).join(' ');
 if(!valid(heard)||!valid(correct)||key(heard)===key(correct))return null;
 if(left.every(w=>stopwords.has(key(w.text)))||right.every(w=>stopwords.has(key(w.text))))return null;
 if(/^\d+$/.test(heard)||/^\d+$/.test(correct))return null;
 return {heard,correct};
}
