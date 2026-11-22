import test from 'node:test';
import assert from 'node:assert/strict';
import {renderQuotePdf,quoteFileName} from '../js/soundline-pdf.js';
import {parseSoundlineVoice} from '../js/soundline-voice.js';
import {quotePricingSnapshot,buildCableLine,createSoundlineState} from '../js/soundline-core.js';
const supplies=[{id:'wire',name:'Cabo Alpha',category:'cabo',costCents:300,active:true},
 {id:'sa2x',name:'Plug SA2X',category:'conector',costCents:800,active:true},
 {id:'neon',name:'Malha Verde Neon',category:'malha',costCents:150,active:true},
 {id:'id',name:'Identificação Personalizada',category:'identificacao',costCents:80,active:true}];
const settings=createSoundlineState().settings;
const item=()=>buildCableLine({quantity:2,lengthMeters:5,cableId:'wire',connectorId:'sa2x',connectorQty:2,
 sleeveId:'neon',labelId:'id',labelQty:2,description:'Cabo personalizado'},supplies,settings,'a');
const quote=()=>({id:'id1',number:'SL-2026-0001',clientName:'João da Silva',items:[item()],status:'rascunho',
 channel:'direto',productPriceCents:15000,pricing:quotePricingSnapshot(settings,100),
 delivery:{mode:'repasse',quotedCents:1800,actualCents:null,destination:'Teresina - PI'},
 validityDays:7,notes:'Obrigado pela preferência.',createdAt:'2026-11-22T12:00:00-03:00'});
test('PDF binário gerado no navegador ou Node com nome de arquivo seguro',()=>{
 const data=renderQuotePdf(quote(),settings),content=Buffer.from(data).toString('latin1');
 assert.ok(data instanceof Uint8Array);assert.ok(data.byteLength>1800);
 assert.match(content,/^%PDF-1.4/);
 assert.match(content,/xref\n0 \d+/);
 assert.match(content,/%%EOF/);
 assert.match(content,/SOUNDLINE/);assert.match(content,/João da Silva/);
 assert.match(content,/SA2X/);
 assert.doesNotMatch(content,/Custo estimado|Lucro bruto|8200|margin/i);
 assert.match(quoteFileName(quote()),/SOUNDLINE-Orcamento-SL-2026-0001-Joao-da-Silva\.pdf/);
});
test('PDF continua em mais de uma página quando há muitos produtos',()=>{
 const q=quote();q.items=Array.from({length:30},(_,i)=>({...item(),id:'item'+i,
   description:'Cabo SOUNDLINE Premium para estúdio personalizado 5 metros com malha verde neon ' + i}));
 const pdf=Buffer.from(renderQuotePdf(q,settings)).toString('latin1');
 assert.match(pdf,/\/Count [2-9]/);
});
test('PDF não permite emitir cotação de marketplace sem tarifas confirmadas',()=>{
 const q=quote();q.channel='mercado_livre';
 assert.throws(()=>renderQuotePdf(q,settings),/Configure as taxas/);
});
test('voz lê quantidade, comprimento, cliente e materiais cadastrados',()=>{
 const t='Criar orçamento para o cliente Carlos, dois cabos de cinco metros com plugs SA2X, malha verde neon e identificação nas duas pontas';
 const p=parseSoundlineVoice(t,supplies);
 assert.equal(p.clientName,'Carlos');assert.equal(p.quantity,2);assert.equal(p.lengthMeters,5);
 assert.equal(p.connectorId,'sa2x');assert.equal(p.sleeveId,'neon');assert.equal(p.labelId,'id');
 assert.equal(p.labelQty,2);assert.equal(p.cableId,'');
});
test('voz sem catálogo não inventa custo nem plug, mantém aviso para conferência',()=>{
 const p=parseSoundlineVoice('Orçamento para Paula, um cabo de 3 metros SA2X',[]);
 assert.equal(p.clientName,'Paula');assert.equal(p.quantity,1);
 assert.equal(p.cableId,'');assert.equal(p.connectorId,'');
 assert.ok(p.warnings.length>0);
});
test('entrega mencionada por voz exige conferir modalidade e custo',()=>{
 const p=parseSoundlineVoice('Criar orçamento para João cabo de 5 metros com entrega por Uber',supplies);
 assert.equal(p.deliveryMode,'repasse');
 assert.ok(p.warnings.some(w=>w.includes('entregador')));
});
