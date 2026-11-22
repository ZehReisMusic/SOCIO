/** SOUNDLINE — PDF A4 local, sem rede ou dependências. Somente dados comerciais. */
import {calculateQuote,money,DELIVERY_MODES} from './soundline-core.js';
const W=595.28,H=841.89,INK='#142936',MUTED='#536c7b',AMBER='#e5b878',BLUE='#163647';
const cp1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,
'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,
'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
const encoded=(value)=>Array.from(String(value??'')).map(c=>{
 const point=c.codePointAt(0);
 return point<=255?String.fromCharCode(point):String.fromCharCode(cp1252[c]??63);
}).join('');
const pdfString=v=>encoded(String(v??'').replace(/[\r\n\t]+/g,' ')).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n.toFixed(3)).join(' ');
const px=n=>Number(n).toFixed(2);
const fmtDate=iso=>{
 const d=new Date(iso||Date.now());
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d):'';
};
function wrap(value,max=89){
 const words=String(value||'').replace(/\s+/g,' ').trim().split(' ');
 const lines=[];let line='';
 for(let word of words){
  while(word.length>max){if(line){lines.push(line);line='';}lines.push(word.slice(0,max));word=word.slice(max);}
  if(!word)continue;
  if((line+' '+word).trim().length>max){lines.push(line);line=word;}else line=(line+' '+word).trim();
 }
 if(line)lines.push(line);
 return lines.length?lines:[''];
}
const commands=[];
let pages=[],y=0;
const text=(value,x,baseline,size=10,font='F1',color=INK)=>{
 commands.push(rgb(color)+' rg BT /'+font+' '+px(size)+' Tf 1 0 0 1 '+px(x)+' '+px(baseline)+' Tm ('+pdfString(value)+') Tj ET');
};
const rect=(x,baseline,width,height,color)=>{
 commands.push(rgb(color)+' rg '+px(x)+' '+px(baseline)+' '+px(width)+' '+px(height)+' re f');
};
const line=(x,baseline,toX,color='#dce5e8')=>{
 rect(x,baseline,toX-x,0.8,color);
};
function startPage(quote,settings,continuation=false){
 commands.length=0;y=710;
 rect(0,H-134,W,134,BLUE);
 rect(0,H-138,W,4,AMBER);
 text((settings.companyName||'SOUNDLINE').toUpperCase(),43,H-74,27,'F2','#ffffff');
 text(settings.tagline||'Conectando qualidade ao seu som.',44,H-96,9,'F1','#c0d8df');
 text('ORÇAMENTO COMERCIAL',367,H-72,11,'F2','#f6e3c7');
 text(quote.number||'SOUNDLINE',367,H-92,9,'F1','#f5e9d5');
 if(continuation)text('Continuação',44,y,10,'F2',INK);
}
function finishPage(){pages.push(commands.join('\n')+'\n');}
function ensureSpace(height,quote,settings){
 if(y-height<85){finishPage();startPage(quote,settings,true);y=670;}
}
const row=(label,value,large=false)=>{
 const size=large?15:10;
 text(label,44,y,size,large?'F2':'F1',INK);
 text(value,410,y,large?16:11,'F2',INK);y-=large?30:23;
};
export function renderQuotePdf(quote,settings={}){
 if(!quote||!Array.isArray(quote.items)||!quote.items.length)throw new Error('O orçamento precisa ter pelo menos um cabo.');
 const total=calculateQuote(quote);
 if(total.marketplaceMissingConfig)throw new Error('Configure as taxas do Mercado Livre antes de emitir o PDF.');
 pages=[];startPage(quote,settings);
 const date=fmtDate(quote.createdAt);
 const valid=new Date(quote.createdAt||Date.now());
 valid.setDate(valid.getDate()+Number(quote.validityDays??7));
 text('CLIENTE',44,668,9,'F2',MUTED);
 text(quote.clientName||'Cliente',44,645,17,'F2',INK);
 if(quote.clientContact)text(quote.clientContact,44,625,10,'F1',MUTED);
 text('EMISSÃO',379,668,9,'F2',MUTED);
 text(date,379,648,11,'F1',INK);
 text('VALIDADE',473,668,9,'F2',MUTED);
 text(Number(quote.validityDays)>0?fmtDate(valid.toISOString()):'Sob consulta',473,648,10,'F1',INK);
 line(44,605,551);
 text('DESCRIÇÃO DO PRODUTO',44,583,9,'F2',MUTED);
 text('QTD',505,583,9,'F2',MUTED);
 line(44,572,551);
 y=552;
 for(const item of quote.items){
  const desc=wrap(item.description,79);
  const notes=item.notes?wrap(item.notes,88):[];
  ensureSpace(desc.length*14+notes.length*13+22,quote,settings);
  text(String(item.quantity)+'x',507,y,10,'F2',INK);
  for(let j=0;j<desc.length;j++){
   text(desc[j],44,y,10,j===0?'F2':'F1',INK);
   y-=14;
  }
  for(const n of notes){text(n,44,y,9,'F1',MUTED);y-=13;}
  y-=9;line(44,y,551);y-=18;
 }
 ensureSpace(190,quote,settings);
 y-=4;text('RESUMO COMERCIAL',44,y,10,'F2',MUTED);y-=24;
 row('Produtos SOUNDLINE',money(total.productCents));
 const delivery=quote.delivery||{mode:'retirada'};
 if(delivery.mode==='repasse'){
  row('Entrega por aplicativo',delivery.quotedCents===null?'A confirmar':money(total.deliveryChargeCents));
 }else if(delivery.mode==='cliente_paga'){
  row('Entrega paga diretamente pelo cliente',delivery.quotedCents===null?'A confirmar':money(delivery.quotedCents)+'*');
 }else if(delivery.mode==='cortesia')row('Entrega', 'Cortesia');
 else row('Entrega','Retirada pelo cliente');
 line(44,y+4,551,AMBER);y-=13;
 row('TOTAL PARA A SOUNDLINE',money(total.totalCents),true);
 if(delivery.mode==='cliente_paga'&&delivery.quotedCents!==null){text('* Custo de entrega à parte, pago ao entregador.',44,y+2,8,'F1',MUTED);y-=17;}
 if(delivery.mode==='repasse'&&delivery.quotedCents===null){text('Entrega a confirmar antes de fechar o pedido; total não inclui frete.',44,y+2,8,'F1',MUTED);y-=17;}
 ensureSpace(126,quote,settings);
 y-=8;text('CONDIÇÕES',44,y,10,'F2',MUTED);y-=22;
 const terms=[
  'Pagamento: '+(quote.paymentTerms||settings.paymentTerms||'A combinar'),
  'Produção: '+(quote.productionTerms||settings.productionTerms||'A combinar')
 ];
 if(delivery.destination)terms.push('Destino de entrega: '+delivery.destination);
 if(quote.notes)terms.push('Observações: '+quote.notes);
 for(const t of terms){for(const ln of wrap(t,94)){ensureSpace(14,quote,settings);text(ln,44,y,9,'F1',MUTED);y-=14;}}
 if(quote.channel==='mercado_livre'){ensureSpace(14,quote,settings);text('Canal: Mercado Livre. Encargos/frete finais sujeitos à plataforma.',44,y,8,'F1',MUTED);y-=14;}
 ensureSpace(28,quote,settings);
 line(44,y-7,551);y-=28;
 text('SOUNDLINE  |  '+(settings.contact||'Proposta comercial personalizada'),44,y,9,'F1',MUTED);
 finishPage();
 const count=pages.length;
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids ['+pages.map((_,i)=>(5+i*2)+' 0 R').join(' ')+'] /Count '+count+' >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
 ];
 for(let i=0;i<count;i++){
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+px(W)+' '+px(H)+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(6+2*i)+' 0 R >>');
  const stream=pages[i];
  objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
 }
 let output='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(output.length);
  output+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const pos=output.length;
 output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<offsets.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 output+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+pos+'\n%%EOF\n';
 const bytes=Uint8Array.from(output,c=>c.charCodeAt(0)&255);
 return bytes;
}
export function quoteFileName(quote){
 const number=String(quote?.number||'SOUNDLINE').replace(/[^a-zA-Z0-9-]/g,'');
 const client=String(quote?.clientName||'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,35);
 return 'SOUNDLINE-Orcamento-'+number+'-'+client+'.pdf';
}
