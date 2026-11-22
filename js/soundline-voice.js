/** Interpretador conservador de orçamento falado: nunca salva ou inventa preços. */
const normalize=s=>String(s||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const numberWords={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,meio:0.5,meia:0.5};
const num=s=>s in numberWords?numberWords[s]:Number(String(s).replace(',','.'));
const token='(?:\\d+(?:[,.]\\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)';
const containsName=(speech,name)=>{
 const nameWords=normalize(name).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
 // O usuário pode omitir o termo genérico "malha"/"cabo"/"conector".
 return nameWords.length>0&&nameWords.filter(w=>!['malha','cabo','conector','plug','identificacao','trancada','modelo'].includes(w))
  .every(w=>speech.includes(w));
};
export function parseSoundlineVoice(transcript,supplies=[]){
 const raw=String(transcript||'').trim().slice(0,1200);
 const norm=normalize(raw);
 const quantityMatch=norm.match(new RegExp('\\b('+token+')\\s+(?:cabos?|unidades?)\\b'));
 const lenMatch=norm.match(new RegExp('\\b('+token+')\\s*(?:metros?|m)\\b'));
 const quantity=quantityMatch?num(quantityMatch[1]):1;
 const lengthMeters=lenMatch?num(lenMatch[1]):null;
 // Não confundir "para um cliente" com "para João": exigir marcador de orçamento/cliente.
 const customerMatch=raw.match(/(?:orçamento\s+para\s+(?:o\s+cliente\s+)?|orcamento\s+para\s+(?:o\s+cliente\s+)?|(?:cliente|para\s+o\s+cliente)\s+)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,80}?)(?=\s*[,.;]|\s+(?:\d+|um|uma|dois|duas|três|tres|quatro|cinco|cabo|cabos)\b|$)/i);
 const clientName=customerMatch?customerMatch[1].trim():'';
 const byCategory=category=>(supplies||[]).filter(s=>s.category===category&&s.active!==false);
 const matched=(category)=>{
  const candidates=byCategory(category).filter(s=>containsName(norm,s.name));
  // Sem uma correspondência única suficientemente clara, exigir escolha manual.
  return candidates.length===1?candidates[0].id:'';
 };
 const connectorId=matched('conector'),cableId=matched('cabo'),sleeveId=matched('malha');let labelId=matched('identificacao');
 const hasIdentification=/\bidentificac(?:ao|oes)\b|\betiquet(?:a|as)\b/.test(norm);
 if(hasIdentification&&!labelId&&byCategory('identificacao').length===1)labelId=byCategory('identificacao')[0].id;
 const twoEnds=/\b(?:duas|2|ambas)\s+pontas\b|\b(?:nos|nas)\s+dois\s+lados\b/.test(norm);
 const labelQty=hasIdentification&&twoEnds?2:hasIdentification?1:0;
 const channel=/mercado\s*livre/.test(norm)?'mercado_livre':'direto';
 const deliveryMode=/\b(?:uber|entregador|motoboy|entrega\s+por\s+aplicativo)\b/.test(norm)?'repasse':'retirada';
 const warnings=[];
 if(!clientName)warnings.push('Confira o nome do cliente.');
 if(!lengthMeters)warnings.push('Informe o comprimento do cabo.');
 if(!cableId)warnings.push('Escolha o tipo de cabo do catálogo.');
 if(!connectorId)warnings.push('Escolha os conectores do catálogo.');
 if(/malha/.test(norm)&&!sleeveId)warnings.push('Confira a malha escolhida.');
 if(hasIdentification&&!labelId)warnings.push('Escolha o insumo de identificação.');
 if(deliveryMode==='repasse')warnings.push('Confirme quem paga o entregador e o valor da entrega.');
 return {clientName,quantity:Number.isFinite(quantity)&&quantity>=1?quantity:1,lengthMeters,
  cableId,connectorId,connectorQty:2,sleeveId,labelId,labelQty,channel,deliveryMode,warnings,raw};
}
