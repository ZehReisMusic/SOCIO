import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundlineState,normalizeSoundline,fromMoney,money,buildCableLine,
 calculateQuote,quotePricingSnapshot,nextQuoteNumber} from '../js/soundline-core.js';
import {validateData} from '../js/store.js';
import {seedData} from '../js/logic.js';

const supplies=[
 {id:'wire',name:'Cabo Premium',category:'cabo',costCents:450,active:true},
 {id:'plug',name:'Plug SA2X',category:'conector',costCents:1200,active:true},
 {id:'sleeve',name:'Malha Verde Neon',category:'malha',costCents:350,active:true},
 {id:'label',name:'Identificação Personalizada',category:'identificacao',costCents:150,active:true}
];
const settings={...createSoundlineState().settings,assemblyCents:1200,consumablesCents:200,overheadCents:100};
const line=()=>buildCableLine({quantity:2,lengthMeters:5,cableId:'wire',connectorId:'plug',connectorQty:2,
 sleeveId:'sleeve',labelId:'label',labelQty:2,description:'Cabo especial'},supplies,settings,'line1');
const makeQuote=(override={})=>({id:'q1',number:'SL-2026-0001',clientName:'Carlos',clientContact:'',
 channel:'direto',status:'rascunho',items:[line()],productPriceCents:null,
 pricing:quotePricingSnapshot(settings,100),delivery:{mode:'retirada',quotedCents:null,actualCents:null,destination:''},
 createdAt:'2026-11-22T14:00:00.000Z',validityDays:7,...override});

test('dados antigos ganham módulo vazio sem perder agenda, tarefas e estação',()=>{
 const d=seedData(new Date(2026,10,22));delete d.soundline;d.appointments=[{id:'a',title:'Teste',date:'2026-11-24',time:'15:00'}];
 const out=validateData(d);
 assert.equal(out.tasks.length,d.tasks.length);
 assert.equal(out.appointments.length,1);
 assert.ok(Array.isArray(out.soundline.supplies));
 assert.ok(Array.isArray(out.soundline.quotes));
 assert.equal(out.soundline.settings.minMarkupPct,100);
});
test('preços monetários são inteiros em centavos e vírgulas são aceitas',()=>{
 assert.equal(fromMoney('R$ 1.234,56'),123456);
 assert.equal(fromMoney('50,50'),5050);assert.equal(fromMoney('50.50'),5050);
 assert.equal(fromMoney(''),null);assert.equal(fromMoney('-12'),null);
 assert.match(money(-250),/2,50/);assert.match(money(-250),/-/);
});
test('composição usa metro, plug duplo, malha, etiquetas e mão de obra',()=>{
 const item=line();
 assert.equal(item.unitCostCents,8200);assert.equal(item.quantity,2);
 assert.match(item.description,/SA2X/);assert.match(item.description,/Verde Neon/);
 assert.equal(item.components.find(c=>c.name==='Cabo Premium').totalCents,2250);
});
test('cada cabo precisa de materiais conhecidos e unidades válidas',()=>{
 assert.throws(()=>buildCableLine({quantity:1,lengthMeters:5,cableId:'x',connectorId:'plug',connectorQty:2},supplies,settings),/Insumo/);
 assert.throws(()=>buildCableLine({quantity:1,lengthMeters:0,cableId:'wire',connectorId:'plug',connectorQty:2},supplies,settings),/comprimento/);
 assert.throws(()=>buildCableLine({quantity:1,lengthMeters:5,cableId:'wire',connectorId:'plug',connectorQty:0},supplies,settings),/conectores/);
});
test('venda direta cumpre acréscimo mínimo de 100% e aceita valor maior',()=>{
 const q=makeQuote();
 assert.equal(calculateQuote(q).costCents,16400);
 assert.equal(calculateQuote(q).recommendedCents,32800);
 assert.equal(calculateQuote(q).minimumCents,32800);
 assert.equal(calculateQuote({...q,productPriceCents:41000}).profitCents,24600);
 assert.equal(calculateQuote({...q,productPriceCents:20000}).belowMinimum,true);
});
test('entrega paga diretamente pelo cliente não entra no caixa',()=>{
 const q=makeQuote({productPriceCents:35000,delivery:{mode:'cliente_paga',quotedCents:1800,actualCents:null,destination:'Centro'}});
 const a=calculateQuote(q);
 assert.equal(a.totalCents,35000);assert.equal(a.deliveryChargeCents,0);
 assert.equal(a.profitCents,18600);
});
test('entrega por repasse distingue cotação e pagamento real',()=>{
 const q=makeQuote({productPriceCents:35000,delivery:{mode:'repasse',quotedCents:1800,actualCents:2200}});
 const a=calculateQuote(q);
 assert.equal(a.totalCents,36800);assert.equal(a.profitCents,18200);
 assert.equal(a.deliveryExpenseCents,2200);
});
test('entrega de cortesia diminui lucro sem inflar receita',()=>{
 const q=makeQuote({productPriceCents:35000,delivery:{mode:'cortesia',quotedCents:1800,actualCents:2000}});
 const a=calculateQuote(q);assert.equal(a.totalCents,35000);assert.equal(a.profitCents,16600);
});
test('Mercado Livre inclui taxa percentual, fixa e embalagem com mesmo lucro-alvo',()=>{
 const q=makeQuote({channel:'mercado_livre',pricing:{...quotePricingSnapshot(settings,100),
  marketplaceFeePct:15,marketplaceFixedFeeCents:200,marketplacePackagingCents:500,marketplaceConfigured:true}});
 const a=calculateQuote(q);
 assert.equal(a.recommendedCents,Math.ceil((32800+700)/.85));
 assert.ok(a.profitCents>=16400-1);
 assert.equal(a.marketplaceMissingConfig,false);
});
test('marketplace sem taxas confirmadas sinaliza risco comercial',()=>{
 const q=makeQuote({channel:'mercado_livre'});
 assert.equal(calculateQuote(q).marketplaceMissingConfig,true);
});
test('catálogo e regras posteriores não alteram custo histórico da proposta',()=>{
 const q=makeQuote();
 const d=createSoundlineState();d.supplies=supplies;d.quotes=[q];d.sequence=1;
 const prior=calculateQuote(q).costCents;
 const copy=normalizeSoundline(d);
 copy.supplies[0].costCents=9000;copy.settings.defaultMarkupPct=150;
 assert.equal(calculateQuote(copy.quotes[0]).costCents,prior);
 assert.equal(calculateQuote(copy.quotes[0]).recommendedCents,32800);
 const d2=seedData(new Date(2026,10,22));d2.soundline=copy;
 assert.deepEqual(validateData(validateData(d2)).soundline,validateData(d2).soundline);
});
test('numeração não colide dentro do mesmo estado',()=>{
 const a=createSoundlineState();
 const first=nextQuoteNumber(a,2026);a.sequence=first.sequence;
 assert.equal(first.number,'SL-2026-0001');
 assert.equal(nextQuoteNumber(a,2026).number,'SL-2026-0002');
});
