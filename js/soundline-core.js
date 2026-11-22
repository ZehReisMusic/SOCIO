/** SOUNDLINE V001 — catálogo, orçamento e cálculos em centavos; 100% locais. */
export const SUPPLY_CATEGORIES = [
  ['cabo','Cabo por metro','m'],
  ['conector','Conector por unidade','un'],
  ['malha','Malha por metro','m'],
  ['identificacao','Identificação por ponta','un'],
  ['extra','Acessório por unidade','un']
];
export const QUOTE_STATUSES = [
  ['rascunho','Rascunho'],['enviado','Enviado'],['aprovado','Aprovado'],['recusado','Não aprovado']
];
export const DELIVERY_MODES = [
  ['retirada','Retirada pelo cliente'],
  ['cliente_paga','Cliente paga entregador diretamente'],
  ['repasse','SOUNDLINE contrata e repassa a entrega'],
  ['cortesia','Entrega por conta da SOUNDLINE']
];
export const DEFAULT_SETTINGS = Object.freeze({
  minMarkupPct:100,defaultMarkupPct:100,
  assemblyCents:0,consumablesCents:0,overheadCents:0,directPackagingCents:0,
  marketplaceFeePct:0,marketplaceFixedFeeCents:0,marketplacePackagingCents:0,marketplaceConfigured:false,
  validityDays:7,paymentTerms:'A combinar',productionTerms:'A combinar',
  contact:'',companyName:'SOUNDLINE',tagline:'Conectando qualidade ao seu som.'
});
const text=(v,max=250)=>String(v??'').trim().slice(0,max);
const cap=(n,max=1000000000)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Math.round(Number(n)))):0;
const decimal=(n,max=1000)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Number(n))):0;
const oneOf=(value,options,fallback)=>options.includes(value)?value:fallback;
const categories=new Set(SUPPLY_CATEGORIES.map(x=>x[0]));
const statuses=QUOTE_STATUSES.map(x=>x[0]);
const modes=DELIVERY_MODES.map(x=>x[0]);
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function money(cents){const value=Number(cents)||0;return (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
export function fromMoney(input){
  const raw=String(input??'').replace(/[R$\s]/g,'').trim();
  if(raw==='')return null;
  const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
  if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))return null;
  const value=Math.round(Number(normalized)*100);
  return Number.isSafeInteger(value)&&value<=1000000000?value:null;
}
export function createSoundlineState(){return {settings:{...DEFAULT_SETTINGS},supplies:[],quotes:[],sequence:0};}
export function normalizeSoundline(input){
 const raw=input&&typeof input==='object'?input:{};
 const cfg=raw.settings&&typeof raw.settings==='object'?raw.settings:{};
 const settings={
  ...DEFAULT_SETTINGS,
  minMarkupPct:Math.max(100,cap(cfg.minMarkupPct??100,400)),
  defaultMarkupPct:Math.max(100,cap(cfg.defaultMarkupPct??100,400)),
  assemblyCents:cap(cfg.assemblyCents),
  consumablesCents:cap(cfg.consumablesCents),
  overheadCents:cap(cfg.overheadCents),
  directPackagingCents:cap(cfg.directPackagingCents),
  marketplaceFeePct:decimal(cfg.marketplaceFeePct,90),
  marketplaceFixedFeeCents:cap(cfg.marketplaceFixedFeeCents),
  marketplacePackagingCents:cap(cfg.marketplacePackagingCents),
  marketplaceConfigured:cfg.marketplaceConfigured===true,
  validityDays:cap(cfg.validityDays??7,90),
  paymentTerms:text(cfg.paymentTerms??DEFAULT_SETTINGS.paymentTerms,300),
  productionTerms:text(cfg.productionTerms??DEFAULT_SETTINGS.productionTerms,300),
  contact:text(cfg.contact,200),
  companyName:text(cfg.companyName||'SOUNDLINE',100),
  tagline:text(cfg.tagline||DEFAULT_SETTINGS.tagline,200)
 };
 const supplies=(Array.isArray(raw.supplies)?raw.supplies:[]).slice(0,600).filter(Boolean).map(s=>({
  id:text(s.id,100),name:text(s.name,150),category:categories.has(s.category)?s.category:'extra',
  costCents:cap(s.costCents),notes:text(s.notes,500),active:s.active!==false,
  createdAt:text(s.createdAt,40)
 })).filter(s=>s.id&&s.name);
 const quotes=(Array.isArray(raw.quotes)?raw.quotes:[]).slice(0,1500).filter(Boolean).map(q=>{
  const p=q.pricing&&typeof q.pricing==='object'?q.pricing:{};
  const d=q.delivery&&typeof q.delivery==='object'?q.delivery:{};
  const items=(Array.isArray(q.items)?q.items:[]).slice(0,40).filter(Boolean).map(i=>({
   id:text(i.id,100),description:text(i.description,500),
   quantity:cap(i.quantity,100)||1,lengthMeters:decimal(i.lengthMeters,500),
   unitCostCents:cap(i.unitCostCents),
   components:(Array.isArray(i.components)?i.components:[]).slice(0,16).filter(Boolean).map(c=>({
    name:text(c.name,180),unit:text(c.unit,15),quantity:decimal(c.quantity,10000),
    unitCostCents:cap(c.unitCostCents),totalCents:cap(c.totalCents)
   })),notes:text(i.notes,800)
  })).filter(i=>i.id&&i.description);
  return {
   id:text(q.id,100),number:text(q.number,40),clientName:text(q.clientName,150),
   clientContact:text(q.clientContact,150),channel:q.channel==='mercado_livre'?'mercado_livre':'direto',
   status:oneOf(q.status,statuses,'rascunho'),items,
   productPriceCents:q.productPriceCents===null||q.productPriceCents===undefined?null:cap(q.productPriceCents),
   pricing:{markupPct:Math.max(100,cap(p.markupPct??100,400)),minMarkupPct:Math.max(100,cap(p.minMarkupPct??100,400)),
     marketplaceFeePct:decimal(p.marketplaceFeePct,90),
     marketplaceFixedFeeCents:cap(p.marketplaceFixedFeeCents),
     marketplacePackagingCents:cap(p.marketplacePackagingCents),
     marketplaceConfigured:p.marketplaceConfigured===true},
   delivery:{mode:oneOf(d.mode,modes,'retirada'),quotedCents:d.quotedCents===null||d.quotedCents===undefined?null:cap(d.quotedCents),
     actualCents:d.actualCents===null||d.actualCents===undefined?null:cap(d.actualCents),
     destination:text(d.destination,200)},
   validityDays:cap(q.validityDays??7,90),paymentTerms:text(q.paymentTerms,300),
   productionTerms:text(q.productionTerms,300),notes:text(q.notes,1500),
   createdAt:text(q.createdAt,40),updatedAt:text(q.updatedAt,40),sentAt:text(q.sentAt,40)
  };
 }).filter(q=>q.id&&q.clientName);
 return {settings,supplies,quotes,sequence:cap(raw.sequence,999999)};
}
export function quotePricingSnapshot(settings=DEFAULT_SETTINGS,markup=100){
 return {markupPct:Math.max(100,cap(markup,400)),minMarkupPct:Math.max(100,cap(settings.minMarkupPct??100,400)),
  marketplaceFeePct:decimal(settings.marketplaceFeePct,90),
  marketplaceFixedFeeCents:cap(settings.marketplaceFixedFeeCents),
  marketplacePackagingCents:cap(settings.marketplacePackagingCents),
  marketplaceConfigured:settings.marketplaceConfigured===true};
}
export function buildCableLine(input,supplies,settings=DEFAULT_SETTINGS,id=''){
 const quantity=Number(input.quantity),length=Number(input.lengthMeters);
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw new Error('Informe a quantidade de cabos (1 a 100).');
 if(!Number.isFinite(length)||length<0.1||length>200)throw new Error('Confira o comprimento em metros (0,1 a 200).');
 const find=(supplyId,cat,required=false)=>{
  if(!supplyId){if(required)throw new Error('Cadastre e escolha '+(cat==='cabo'?'um cabo':'um conector')+'.');return null;}
  const s=(supplies||[]).find(x=>x.id===supplyId&&x.category===cat&&x.active!==false);
  if(!s)throw new Error('Insumo não encontrado ou inativo: '+cat+'. Confira o catálogo.');
  return s;
 };
 const cable=find(input.cableId,'cabo',true),connector=find(input.connectorId,'conector',true);
 const sleeve=find(input.sleeveId,'malha'),label=find(input.labelId,'identificacao'),extra=find(input.extraId,'extra');
 const connectorQty=Number(input.connectorQty),labelQty=Number(input.labelQty??0),extraQty=Number(input.extraQty??1);
 if(!Number.isInteger(connectorQty)||connectorQty<1||connectorQty>8)throw new Error('Informe os conectores por cabo (1 a 8).');
 if(!Number.isInteger(labelQty)||labelQty<0||labelQty>8)throw new Error('Confira a quantidade de identificações.');
 if(labelQty&&!label)throw new Error('Escolha o insumo de identificação para as pontas.');
 if(extra&&(!Number.isInteger(extraQty)||extraQty<1||extraQty>50))throw new Error('Confira os acessórios por cabo.');
 const sleeveLen=sleeve?Number(input.sleeveMeters||length):0;
 if(sleeve&&(!Number.isFinite(sleeveLen)||sleeveLen<0.1||sleeveLen>250))throw new Error('Confira os metros de malha.');
 const components=[];
 const add=(name,unit,count,cost)=>{
  const total=Math.round(count*cost);
  components.push({name,unit,quantity:r2(count),unitCostCents:cap(cost),totalCents:total});
 };
 add(cable.name,'m',length,cable.costCents);
 add(connector.name,'un',connectorQty,connector.costCents);
 if(sleeve)add(sleeve.name,'m',sleeveLen,sleeve.costCents);
 if(labelQty)add(label.name,'un',labelQty,label.costCents);
 if(extra)add(extra.name,'un',extraQty,extra.costCents);
 for(const [name,cost] of [
  ['Montagem e testes',settings.assemblyCents],
  ['Consumíveis',settings.consumablesCents],
  ['Custos indiretos',settings.overheadCents],
  ['Embalagem direta',settings.directPackagingCents]
 ])if(cap(cost)>0)add(name,'un',1,cap(cost));
 const unitCostCents=components.reduce((sum,c)=>sum+c.totalCents,0);
 if(unitCostCents<=0)throw new Error('Cadastre custos reais para os insumos antes de orçar este cabo.');
 const description=text(input.description||'Cabo SOUNDLINE',220)+' · '+r2(length)+' m · '+connector.name+
  ' ('+connectorQty+' '+(connectorQty===1?'ponta':'pontas')+')'+
  (sleeve?' · Malha '+sleeve.name:'')+(labelQty?' · Identificação em '+labelQty+' ponta(s)':'')+
  (extra?' · '+extra.name:'');
 return {id:id||'item-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
   description,quantity,lengthMeters:r2(length),unitCostCents,components,notes:text(input.notes,800)};
}
export function calculateQuote(quote){
 const items=Array.isArray(quote?.items)?quote.items:[];
 const costCents=items.reduce((n,i)=>n+cap(i.unitCostCents)*cap(i.quantity,100),0);
 const p=quote?.pricing||quotePricingSnapshot();
 const marketplace=quote?.channel==='mercado_livre';
 const feePct=marketplace?decimal(p.marketplaceFeePct,90):0;
 const fixed=marketplace?cap(p.marketplaceFixedFeeCents):0;
 const packaging=marketplace?cap(p.marketplacePackagingCents):0;
 const target=(markup)=>Math.ceil((costCents*(1+cap(markup,400)/100)+fixed+packaging)/(1-feePct/100));
 const recommendedCents=target(p.markupPct??100);
 const minimumCents=target(p.minMarkupPct??100);
 const productCents=quote?.productPriceCents===null||quote?.productPriceCents===undefined
   ?recommendedCents:cap(quote.productPriceCents);
 const feeCents=marketplace?Math.round(productCents*feePct/100)+fixed:0;
 const mode=quote?.delivery?.mode||'retirada',quoted=quote?.delivery?.quotedCents??null,actual=quote?.delivery?.actualCents??null;
 const deliveryChargeCents=mode==='repasse'?(quoted??0):0;
 const deliveryExpenseCents=(mode==='repasse'||mode==='cortesia')?(actual??quoted??0):0;
 const deliveryPending=(mode==='repasse'||mode==='cortesia')&&actual===null;
 const totalCents=productCents+deliveryChargeCents;
 const profitCents=totalCents-costCents-feeCents-packaging-deliveryExpenseCents;
 return {costCents,recommendedCents,minimumCents,productCents,feeCents,packagingCents:packaging,
   deliveryChargeCents,deliveryExpenseCents,deliveryPending,totalCents,profitCents,
   belowMinimum:productCents<minimumCents,
   marketplaceMissingConfig:marketplace&&p.marketplaceConfigured!==true,
   hasItems:items.length>0};
}
export function nextQuoteNumber(soundline,year=new Date().getFullYear()){
 const sequence=Math.max(0,cap(soundline.sequence,999999))+1;
 return {sequence,number:'SL-'+String(year)+'-'+String(sequence).padStart(4,'0')};
}
