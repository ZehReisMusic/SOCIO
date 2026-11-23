/** SOUNDLINE — área comercial independente, acessada pelo negócio dentro do MEU SÓCIO. */
import {SUPPLY_CATEGORIES,QUOTE_STATUSES,DELIVERY_MODES,DEFAULT_SETTINGS,createSoundlineState,
 normalizeSoundline,fromMoney,money,buildCableLine,calculateQuote,quotePricingSnapshot,nextQuoteNumber} from './soundline-core.js';
import {parseSoundlineVoice} from './soundline-voice.js';
import {applyVocabulary} from './assistant-vocabulary.js';
import {renderQuotePdf,quoteFileName} from './soundline-pdf.js';

export function createSoundlineController(h){
 let tab='quotes',screen='list',draft=null,voicePrefill=null,voiceText='',speech=null;
 const E=h.esc,B=h.btn,icon=h.svg;
 const state=()=>{const data=h.getData();if(!data.soundline)data.soundline=createSoundlineState();return data.soundline;};
 const date=s=>{const d=new Date(s||Date.now());return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR'):'';};
 const value=c=>c===null||c===undefined?'':(Number(c)/100).toFixed(2);
 const input=(label,name,val,type='text',attrs='')=>h.field(label,name,val,type,attrs);
 const option=(label,name,val,items)=>h.selectField(label,name,val,items);
 const area=(label,name,val,attrs='')=>h.textArea(label,name,val,attrs);
 const section=(heading,body,actions='')=>'<section class="sl-section"><div class="sl-section-head"><h2>'+heading+'</h2>'+actions+'</div>'+body+'</section>';
 const caption=s=>'<p class="sl-note">'+s+'</p>';
 const refresh=()=>h.refresh();
 const supplyOptions=(category,empty='Não utilizar')=>[['',empty],...state().supplies.filter(s=>s.category===category&&s.active!==false).map(s=>[s.id,s.name+' · '+money(s.costCents)+' / '+(SUPPLY_CATEGORIES.find(x=>x[0]===category)?.[2]||'un')])];
 const current=()=>state().quotes.find(q=>q.id===draft?.id);
 const editQuote=id=>{
  draft=id?JSON.parse(JSON.stringify(state().quotes.find(q=>q.id===id)||null)):null;
  if(!draft)draft={id:'',number:'',clientName:'',clientContact:'',channel:'direto',status:'rascunho',
   items:[],productPriceCents:null,pricing:quotePricingSnapshot(state().settings,state().settings.defaultMarkupPct),
   delivery:{mode:'retirada',quotedCents:null,actualCents:null,destination:''},
   validityDays:state().settings.validityDays,paymentTerms:state().settings.paymentTerms,
   productionTerms:state().settings.productionTerms,notes:'',createdAt:'',updatedAt:'',sentAt:''};
  screen='editor';tab='quotes';voicePrefill=null;voiceText='';refresh();
 };
 function moneyRow(label,cents,highlight=false){
  return '<div class="sl-money-row'+(highlight?' sl-money-total':'')+'"><span>'+label+'</span><strong>'+money(cents)+'</strong></div>';
 }
 function listQuotes(){
  const quotes=[...state().quotes].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const buttons=B(icon('plus',15)+' Novo orçamento','sl-new-quote','primary')+' '+B(icon('mic',15)+' Falar orçamento','sl-start-voice','outline','id="sl-voice-trigger"');
  let body='<div class="sl-main-actions">'+buttons+'</div><p id="sl-voice-live" role="status" aria-live="polite"></p>';
  body+=caption('Os custos e margens ficam somente no MEU SÓCIO. Os PDFs contêm apenas dados comerciais.');
  if(!quotes.length)body+='<div class="sl-empty"><h3>Seu primeiro orçamento começa aqui.</h3><p>Cadastre os insumos que usa na produção e crie a primeira proposta. Nada será enviado sem sua confirmação.</p>'+B('Cadastrar insumos','sl-go-supplies','outline')+'</div>';
  else body+='<div class="sl-quote-list">'+quotes.map(q=>{
   const t=calculateQuote(q);
   const status=QUOTE_STATUSES.find(s=>s[0]===q.status)?.[1]||'Rascunho';
   return '<article class="sl-quote-card"><div class="sl-quote-top"><div><strong>'+E(q.number)+'</strong><span>'+E(date(q.createdAt))+'</span></div><span class="sl-status">'+E(status)+'</span></div>'+
    '<h3>'+E(q.clientName)+'</h3><p>'+q.items.length+' item(ns) · '+E(q.channel==='mercado_livre'?'Mercado Livre':'Venda direta')+'</p>'+
    '<div class="sl-quote-bottom"><strong>'+money(t.totalCents)+'</strong><div class="sl-row-actions">'+
      B('Ver','sl-view-quote','outline','data-id="'+E(q.id)+'"')+
      B('Editar','sl-edit-quote','outline','data-id="'+E(q.id)+'"')+
      B('PDF','sl-pdf','primary','data-id="'+E(q.id)+'"')+'</div></div></article>';
  }).join('')+'</div>';
  return section('Orçamentos',body);
 }
 function listSupplies(){
  const supplies=[...state().supplies].sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name,'pt-BR'));
  let body=B(icon('plus',15)+' Novo insumo','sl-new-supply','primary');
  body+=caption('Valores são privados. Cabos e malhas: custo por metro; plugs, identificações e acessórios: custo por unidade.');
  if(!supplies.length)body+='<div class="sl-empty"><h3>Nenhum insumo cadastrado.</h3><p>Comece pelos modelos de cabo, conectores e malhas que você já tem em estoque. Não cadastre preços fictícios.</p></div>';
  else body+='<div class="sl-supply-list">'+supplies.map(s=>{
   const cat=SUPPLY_CATEGORIES.find(c=>c[0]===s.category)||['extra','Acessório','un'];
   return '<div class="sl-supply-row"><div><strong>'+E(s.name)+'</strong><p>'+E(cat[1])+(s.active?'':' · Inativo')+'</p></div><strong>'+money(s.costCents)+' / '+cat[2]+'</strong><div>'+B('Editar','sl-edit-supply','outline','data-id="'+E(s.id)+'"')+'</div></div>';
  }).join('')+'</div>';
  return section('Insumos de produção',body);
 }
 function showSettings(){
  const s=state().settings;
  const rows=[
   ['Acréscimo padrão sobre o custo','defaultMarkupPct',s.defaultMarkupPct,'number','min="100" max="400" step="1" required'],
   ['Montagem e testes (R$ por cabo)','assemblyCents',value(s.assemblyCents),'number','min="0" step="0.01" required'],
   ['Consumíveis (R$ por cabo)','consumablesCents',value(s.consumablesCents),'number','min="0" step="0.01" required'],
   ['Custos indiretos (R$ por cabo)','overheadCents',value(s.overheadCents),'number','min="0" step="0.01" required'],
   ['Embalagem da venda direta (R$ por cabo)','directPackagingCents',value(s.directPackagingCents),'number','min="0" step="0.01" required'],
   ['Taxa proporcional Mercado Livre (%)','marketplaceFeePct',s.marketplaceFeePct,'number','min="0" max="90" step="0.01"'],
   ['Tarifa fixa do anúncio/pedido (R$)','marketplaceFixedFeeCents',value(s.marketplaceFixedFeeCents),'number','min="0" step="0.01"'],
   ['Embalagem para envio (R$ por pedido)','marketplacePackagingCents',value(s.marketplacePackagingCents),'number','min="0" step="0.01"']
  ];
  let body='<form id="sl-settings-form" class="sl-form"><div class="sl-grid-2">'+rows.map(r=>input(...r)).join('')+'</div>';
  body+=caption('A regra mínima permanece 100% de acréscimo sobre o custo. Os encargos do Mercado Livre são configurados por você, nunca presumidos pelo SÓCIO.');
  body+='<label class="sl-check"><input type="checkbox" name="marketplaceConfigured" '+(s.marketplaceConfigured?'checked':'')+'> Conferi e configurei as taxas do meu tipo de anúncio no Mercado Livre</label>';
  body+='<div class="sl-grid-2">'+input('Contato SOUNDLINE (no PDF)','contact',s.contact,'text','maxlength="200"')+
  input('Validade em dias','validityDays',s.validityDays,'number','min="0" max="90"')+
  input('Condições de pagamento','paymentTerms',s.paymentTerms,'text','maxlength="300"')+
  input('Prazo de produção','productionTerms',s.productionTerms,'text','maxlength="300"')+'</div>';
  body+='<div class="sl-actions"><button type="submit" class="btn-primary">Salvar precificação</button></div></form>';
  body+=caption('As tarifas reais podem variar por anúncio, categoria e modalidade. Confira também frete e demais encargos, que não são estimados automaticamente nesta V001.');
  return section('Custos fixos e regras de preço',body);
 }
 function quoteTotalsPanel(q){
  const t=calculateQuote(q);
  const warnings=[];
  if(!t.hasItems)warnings.push('Inclua pelo menos um cabo.');
  if(t.belowMinimum)warnings.push('Preço abaixo do mínimo comercial de 100% sobre o custo.');
  if(t.marketplaceMissingConfig)warnings.push('Taxas do Mercado Livre ainda não confirmadas: o preço é provisório e o PDF ficará bloqueado.');
  if(q.delivery?.mode==='repasse'&&q.delivery?.quotedCents===null)warnings.push('Entrega por aplicativo: valor ainda não confirmado; não está incluído no total.');
  if(!state().settings.assemblyCents)warnings.push('Mão de obra está em R$ 0,00. Confira o custo completo da fabricação.');
  let html='<div class="sl-totals"><h3>Conferência financeira · Privado</h3>'+
    moneyRow('Custo estimado da produção',t.costCents)+moneyRow('Preço mínimo recomendado',t.minimumCents)+
    moneyRow('Preço calculado dos produtos',t.recommendedCents)+moneyRow('Preço escolhido dos produtos',t.productCents)+
    (q.channel==='mercado_livre'?moneyRow('Taxas do marketplace',t.feeCents)+moneyRow('Embalagem do marketplace',t.packagingCents):'')+
    (q.delivery?.mode==='repasse'?moneyRow('Entrega cobrada ao cliente',t.deliveryChargeCents):'')+
    moneyRow('Total do orçamento',t.totalCents,true)+
    moneyRow('Lucro bruto estimado (com custos registrados)',t.profitCents);
  if(q.delivery?.mode==='repasse'||q.delivery?.mode==='cortesia')html+=caption(t.deliveryPending?'Despesa de entrega ainda estimada. Informe o valor real depois para avaliar a diferença.':'Despesa real de entrega registrada.');
  if(warnings.length)html+='<div class="sl-warnings">'+warnings.map(w=>'<p>• '+E(w)+'</p>').join('')+'</div>';
  return html+'</div>';
 }
 function editor(){
  if(!draft)return listQuotes();
  const supplyCount=state().supplies.length;
  const p=voicePrefill||{};
  const currentChannel=draft.channel;
  const header='<div class="sl-editor-head"><div><h2>'+E(draft.id?'Editar orçamento '+draft.number:'Novo orçamento')+'</h2><p>Preencha, confira os custos e salve antes de gerar o PDF.</p></div>'+B('Cancelar','sl-cancel-editor','outline')+'</div>';
  let voice='';
  if(voiceText)voice='<div class="sl-voice-review"><strong>Transcrição recebida</strong>'+
   '<textarea id="sl-voice-transcript" rows="3" spellcheck="true">'+E(voiceText)+'</textarea>'+
   B('Interpretar novamente','sl-reparse-voice','outline')+
   caption('Confira cliente, modelo, comprimento, quantidade e componentes. O áudio não é salvo no orçamento.')+'</div>';
  let form='<form id="sl-quote-form" class="sl-form">'+voice+
   '<div class="sl-grid-2">'+input('Nome do cliente','clientName',draft.clientName,'text','required maxlength="150" placeholder="Nome do cliente"')+
    input('Contato (opcional)','clientContact',draft.clientContact,'text','maxlength="150" placeholder="WhatsApp ou e-mail"')+
    option('Canal de venda','channel',currentChannel,[['direto','Venda direta'],['mercado_livre','Mercado Livre']])+
    input('Acréscimo de referência (%)','markupPct',draft.pricing.markupPct,'number','min="100" max="400" step="1"')+'</div>'+
   '<div class="sl-product-builder"><h3>Adicionar cabo ao orçamento</h3>'+
   '<div class="sl-grid-2">'+
     input('Quantidade de cabos','lineQuantity',p.quantity||1,'number','min="1" max="100" step="1"')+
     input('Comprimento de cada cabo (m)','lengthMeters',p.lengthMeters??'','number','min="0.1" max="200" step="0.1" placeholder="5"')+
     option('Tipo de cabo','cableId',p.cableId||'',supplyOptions('cabo','Escolher cabo'))+
     option('Conectores','connectorId',p.connectorId||'',supplyOptions('conector','Escolher conector'))+
     input('Conectores por cabo','connectorQty',p.connectorQty??2,'number','min="1" max="8"')+
     option('Malha (opcional)','sleeveId',p.sleeveId||'',supplyOptions('malha'))+
     input('Metros de malha por cabo (opcional)','sleeveMeters',p.lengthMeters??'','number','min="0" max="250" step="0.1"')+
     option('Identificação (opcional)','labelId',p.labelId||'',supplyOptions('identificacao'))+
     input('Identificações por cabo','labelQty',p.labelQty??0,'number','min="0" max="8" step="1"')+
     option('Acessório adicional (opcional)','extraId','',supplyOptions('extra'))+
     input('Acessórios por cabo','extraQty',1,'number','min="1" max="50" step="1"')+
     input('Nome comercial do produto','lineDescription','Cabo SOUNDLINE personalizado','text','maxlength="220"')+
   '</div>'+area('Detalhes adicionais do cabo (opcional)','lineNotes','','maxlength="800" rows="2"')+
   '<div class="sl-actions">'+B(icon('plus',15)+' Adicionar este cabo','sl-add-line','primary')+'</div></div>';
  if(draft.items.length){
   form+='<div class="sl-line-list"><h3>Produtos do orçamento</h3>'+draft.items.map((item,index)=>
     '<div class="sl-line-item"><div><strong>'+E(item.description)+'</strong><p>'+item.quantity+'x · Custo interno '+money(item.unitCostCents)+'/un</p></div>'+
     B('Remover','sl-remove-line','outline','data-index="'+index+'"')+'</div>').join('')+'</div>';
  }else form+='<div class="sl-empty sl-small">Você ainda não adicionou nenhum cabo.</div>';
  form+='<div class="sl-grid-2">'+
    input('Preço desejado dos produtos (R$)','productPrice',value(draft.productPriceCents),'number','min="0" step="0.01" placeholder="Deixe vazio para preço calculado"')+
    option('Forma de entrega','deliveryMode',draft.delivery.mode,DELIVERY_MODES.map(x=>x.slice(0,2)))+
    input('Custo de entrega cotado (R$)','deliveryQuoted',value(draft.delivery.quotedCents),'number','min="0" step="0.01" placeholder="A confirmar"')+
    input('Custo real da entrega (R$)','deliveryActual',value(draft.delivery.actualCents),'number','min="0" step="0.01" placeholder="Preencha após a entrega"')+
    input('Local de entrega (opcional)','deliveryDestination',draft.delivery.destination,'text','maxlength="200"')+
    input('Validade do orçamento (dias)','validityDays',draft.validityDays,'number','min="0" max="90"')+
    input('Pagamento','paymentTerms',draft.paymentTerms,'text','maxlength="300"')+
    input('Prazo de produção','productionTerms',draft.productionTerms,'text','maxlength="300"')+
   '</div>'+area('Observações para o cliente','notes',draft.notes,'maxlength="1500" rows="3"')+
   '<div class="sl-actions">'+B('Atualizar cálculo','sl-recalculate','outline')+'<button type="submit" class="btn-primary">'+icon('check',15)+' Salvar orçamento</button></div></form>';
  return '<div class="sl-editor">'+header+(!supplyCount?'<div class="sl-warnings">Cadastre os insumos antes de adicionar cabos.</div>':'')+form+quoteTotalsPanel(draft)+'</div>';
 }
 function details(id){
  const q=state().quotes.find(v=>v.id===id);
  if(!q){screen='list';return listQuotes();}
  const totals=calculateQuote(q);
  const status=QUOTE_STATUSES.find(s=>s[0]===q.status)?.[1]||'Rascunho';
  const controls='<div class="sl-row-actions">'+B('Editar','sl-edit-quote','outline','data-id="'+E(q.id)+'"')+
   B(icon('download',15)+' Gerar PDF','sl-pdf','primary','data-id="'+E(q.id)+'"')+
   B('Compartilhar PDF','sl-share-pdf','outline','data-id="'+E(q.id)+'"')+'</div>';
  let body='<div class="sl-detail"><div class="sl-quote-top"><div><strong>'+E(q.number)+'</strong><span>'+E(date(q.createdAt))+'</span></div><span class="sl-status">'+E(status)+'</span></div>'+
   '<h2>'+E(q.clientName)+'</h2><p>'+E(q.clientContact)+' · '+E(q.channel==='mercado_livre'?'Mercado Livre':'Venda direta')+'</p>'+
   '<div class="sl-detail-products">'+q.items.map(i=>'<div><strong>'+i.quantity+'x '+E(i.description)+'</strong>'+(i.notes?'<p>'+E(i.notes)+'</p>':'')+'</div>').join('')+'</div>'+
   '<div class="sl-delivery"><strong>Entrega:</strong> '+E(DELIVERY_MODES.find(m=>m[0]===q.delivery.mode)?.[1]||'Retirada')+
   (q.delivery.destination?' · '+E(q.delivery.destination):'')+
   (q.delivery.quotedCents!==null?' · Cotação '+money(q.delivery.quotedCents):' · Valor a confirmar')+'</div>'+
   '<div class="sl-money-row sl-money-total"><span>Total devido à SOUNDLINE</span><strong>'+money(totals.totalCents)+'</strong></div>'+
   '<div class="sl-status-controls"><strong>Andamento comercial</strong><div class="sl-row-actions">'+
   QUOTE_STATUSES.map(([code,label])=>B(label,'sl-status',q.status===code?'primary':'outline','data-id="'+E(q.id)+'" data-status="'+code+'"')).join('')+'</div></div>'+
   controls+quoteTotalsPanel(q)+
   '<div class="sl-actions">'+B('Criar tarefa de acompanhamento','sl-followup','outline','data-id="'+E(q.id)+'"')+
   B('Voltar aos orçamentos','sl-list','outline')+'</div></div>';
  return section('Detalhes do orçamento',body);
 }
 function render(){
  const tabs=[['quotes','Orçamentos'],['supplies','Insumos'],['settings','Precificação']];
  const n='<div class="sl-nav" role="group" aria-label="Áreas SOUNDLINE">'+tabs.map(([k,l])=>'<button type="button" data-action="sl-tab" data-tab="'+k+'" class="'+(tab===k?'active':'')+'">'+l+'</button>').join('')+'</div>';
  const title='<div class="sl-heading"><div><span class="sl-overline">MEUS NEGÓCIOS / CENTRAL COMERCIAL</span><h1>SOUNDLINE</h1><p>Orçamentos, custos de produção e vendas em um só lugar.</p></div>'+B('Voltar aos negócios','sl-back','outline')+'</div>';
  return '<div class="sl-workspace">'+title+n+
   (tab==='supplies'?listSupplies():tab==='settings'?showSettings():screen==='editor'?editor():screen.startsWith('detail:')?details(screen.slice(7)):listQuotes())+
   '<p class="sl-footnote">Dados privados deste dispositivo. Faça backup em Ajustes. A emissão do PDF não representa emissão de nota fiscal.</p></div>';
 }
 function supplyModal(id=''){
  const s=state().supplies.find(x=>x.id===id)||{name:'',category:'cabo',costCents:0,notes:'',active:true};
  const content=input('Nome do insumo','name',s.name,'text','required maxlength="150" placeholder="Ex.: Plug SA2X"')+
   option('Categoria','category',s.category,SUPPLY_CATEGORIES.map(x=>[x[0],x[1]]))+
   input('Custo de compra por unidade indicada (R$)','cost',value(s.costCents),'number','min="0" step="0.01" required')+
   area('Notas (opcional)','notes',s.notes,'maxlength="500" rows="2"')+
   '<label class="sl-check"><input type="checkbox" name="active" '+(s.active?'checked':'')+'> Disponível para novos orçamentos</label>'+
   caption('Cabos e malhas são cadastrados por metro. Os demais materiais são por unidade. Histórico de propostas não muda quando o custo for atualizado.');
  h.openModal(h.formWrap('SOUNDLINE',id?'Editar insumo':'Novo insumo',content,'Salvar insumo'),'sl-supply',id);
 }
 function readDraft(){
  const f=document.getElementById('sl-quote-form');if(!f||!draft)return null;
  const v=new FormData(f);
  const str=k=>String(v.get(k)||'').trim();
  const oldChannel=draft.channel;
  draft.clientName=str('clientName');draft.clientContact=str('clientContact');
  draft.channel=str('channel')==='mercado_livre'?'mercado_livre':'direto';
  const markup=Math.max(100,Math.min(400,Number(v.get('markupPct'))||100));
  if(draft.channel!==oldChannel)draft.pricing=quotePricingSnapshot(state().settings,markup);
  else draft.pricing.markupPct=markup;
  draft.productPriceCents=fromMoney(v.get('productPrice'));
  draft.delivery={mode:str('deliveryMode'),quotedCents:fromMoney(v.get('deliveryQuoted')),
   actualCents:fromMoney(v.get('deliveryActual')),destination:str('deliveryDestination')};
  draft.validityDays=Math.min(90,Math.max(0,Number(v.get('validityDays'))||0));
  draft.paymentTerms=str('paymentTerms');draft.productionTerms=str('productionTerms');draft.notes=str('notes');
  return v;
 }
 function saveDraft(){
  readDraft();if(!draft)return;
  if(!draft.clientName){h.toast('Informe o nome do cliente.');return;}
  if(!draft.items.length){h.toast('Adicione ao menos um cabo antes de salvar.');return;}
  const totals=calculateQuote(draft);
  if(totals.marketplaceMissingConfig){h.toast('Configure as taxas do Mercado Livre em Precificação.');return;}
  if(totals.belowMinimum&&!confirm('O preço escolhido está abaixo do mínimo de 100% sobre o custo. Deseja salvar assim mesmo?'))return;
  const d=state(),now=new Date().toISOString(),existing=Boolean(draft.id);
  if(!existing){
    const serial=nextQuoteNumber(d);d.sequence=serial.sequence;draft.number=serial.number;
    draft.id=h.newId('sl-quote');draft.createdAt=now;
  }
  draft.updatedAt=now;
  draft.productPriceCents=totals.productCents;
  const clean=normalizeSoundline({quotes:[draft]}).quotes[0];
  if(!clean){h.toast('Não foi possível validar o orçamento.');return;}
  if(existing){
   const i=d.quotes.findIndex(q=>q.id===draft.id);
   if(i<0){h.toast('Orçamento original não encontrado.');return;}
   d.quotes[i]=clean;
  }else d.quotes.push(clean);
  draft=null;screen='detail:'+clean.id;h.commit();h.toast('Orçamento salvo. PDF disponível.');
 }
 function addLine(){
  if(!draft)return;
  const f=readDraft();if(!f)return;
  try{
   if(draft.items.length>=40)throw new Error('Limite de 40 itens por proposta.');
   const v=k=>String(f.get(k)||'').trim();
   const line=buildCableLine({
    quantity:v('lineQuantity'),lengthMeters:v('lengthMeters'),cableId:v('cableId'),connectorId:v('connectorId'),
    connectorQty:v('connectorQty'),sleeveId:v('sleeveId'),sleeveMeters:v('sleeveMeters'),
    labelId:v('labelId'),labelQty:v('labelQty'),extraId:v('extraId'),extraQty:v('extraQty'),
    description:v('lineDescription'),notes:v('lineNotes')
   },state().supplies,state().settings,h.newId('sl-item'));
   draft.items.push(line);
   // Evita manter o valor antigo quando novos produtos entram na proposta.
   draft.productPriceCents=null;voicePrefill=null;refresh();h.toast('Cabo incluído no orçamento.');
  }catch(err){h.toast(err.message);}
 }
 function interpretVoice(text){
  voiceText=applyVocabulary(String(text||'').slice(0,1200),h.getData()?.vocabulary);
  const result=parseSoundlineVoice(voiceText,state().supplies);
  if(!draft)editQuote();
  draft.clientName=result.clientName||draft.clientName;
  draft.channel=result.channel;
  draft.delivery.mode=result.deliveryMode;
  voicePrefill=result;
  refresh();
  if(result.warnings.length)h.toast('Ditado interpretado. Confira os campos sinalizados antes de salvar.');
 }
 function stopVoice(cancel=false){
  const old=speech;if(!old)return;
  old.cancelled=cancel;
  if(cancel)speech=null;
  try{cancel?old.recognition.abort():old.recognition.stop();}catch{
   if(!cancel){speech=null;editQuote();interpretVoice(old.transcript);}
  }
 }
 function startVoice(){
  const Recognizer=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognizer){editQuote();h.toast('Reconhecimento indisponível. Use o microfone do teclado no formulário.');return;}
  if(speech){stopVoice();return;}
  let recognition;try{recognition=new Recognizer();}catch{editQuote();h.toast('Ditado indisponível. Utilize o teclado.');return;}
  const session={recognition,transcript:'',cancelled:false};speech=session;
  recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=e=>{
   if(speech!==session)return;
   session.transcript=Array.from(e.results||[]).map(r=>r[0]?.transcript||'').join(' ').trim();
   const hint=document.getElementById('sl-voice-live');if(hint)hint.textContent='Ouvindo: '+session.transcript;
  };
  recognition.onerror=()=>{if(speech===session){h.toast('Ditado indisponível. Revise o texto manualmente.');}};
  recognition.onend=()=>{
   if(speech!==session)return;
   speech=null;if(session.cancelled)return;
   editQuote();interpretVoice(session.transcript);
  };
  try{
   recognition.start();
   const btn=document.getElementById('sl-voice-trigger');
   if(btn){btn.dataset.action='sl-stop-voice';btn.textContent='Parar e revisar';}
   const hint=document.getElementById('sl-voice-live');if(hint)hint.textContent='Ouvindo... Toque em Parar e revisar.';
  }catch{speech=null;editQuote();h.toast('Não foi possível iniciar o microfone. Digite os dados manualmente.');}
 }
 async function pdf(id,share=false){
  const q=state().quotes.find(v=>v.id===id);if(!q)return;
  const totals=calculateQuote(q);
  if(totals.marketplaceMissingConfig){h.toast('Configure as taxas do marketplace antes do PDF.');return;}
  if(totals.belowMinimum&&!confirm('Este orçamento está abaixo do mínimo comercial. Deseja gerar o PDF mesmo assim?'))return;
  try{
   const bytes=renderQuotePdf(q,state().settings),fileName=quoteFileName(q);
   const file=new File([bytes],fileName,{type:'application/pdf'});
   if(share&&navigator.share&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:'Orçamento SOUNDLINE '+q.number});}catch(e){if(e?.name!=='AbortError')h.toast('Compartilhamento não concluído. Use Gerar PDF.');}
   }else{
    const url=URL.createObjectURL(file),link=document.createElement('a');
    link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    h.toast('PDF gerado. Confira os arquivos/downloads do dispositivo.');
   }
  }catch(err){console.error('PDF SOUNDLINE',err);h.toast('Falha ao gerar o PDF: '+(err?.message||'tente novamente'));}
 }
 function followup(id){
  const q=state().quotes.find(v=>v.id===id),d=h.getData();if(!q)return;
  const business=d.businesses.find(b=>b.id==='b-soundline')||d.businesses.find(b=>/soundline/i.test(b.name||''));
  if(!business){h.toast('Negócio SOUNDLINE não encontrado para a tarefa.');return;}
  const followupTitle='Acompanhar orçamento '+q.number+' — '+q.clientName;
  if(d.tasks.some(t=>t.status==='open'&&t.title===followupTitle)){h.toast('Já existe uma tarefa pendente para esse orçamento.');return;}
  d.tasks.push({id:h.newId('t'),businessId:business.id,title:followupTitle,
   notes:'Verificar se o cliente recebeu a proposta e esclarecer dúvidas. Não alterar o orçamento sem confirmação.',
   status:'open',impact:4,urgency:3,effort:1,minutes:10,due:'',createdAt:new Date().toISOString(),completedAt:null});
  h.commit();h.toast('Tarefa de acompanhamento criada.');
 }
 function action(target){
  const a=target.dataset.action,id=target.dataset.id||'';
  if(a==='sl-back'){if(screen==='editor'&&!confirm('Sair sem salvar este orçamento?'))return true;stopVoice(true);h.navigate('negocios');return true;}
  if(a==='sl-tab'){if(screen==='editor'&&!confirm('Trocar de área descartará a edição do orçamento. Continuar?'))return true;stopVoice(true);tab=target.dataset.tab||'quotes';screen='list';draft=null;refresh();return true;}
  if(a==='sl-go-supplies'){tab='supplies';refresh();return true;}
  if(a==='sl-new-supply'){supplyModal();return true;}
  if(a==='sl-edit-supply'){supplyModal(id);return true;}
  if(a==='sl-new-quote'){editQuote();return true;}
  if(a==='sl-edit-quote'){editQuote(id);return true;}
  if(a==='sl-cancel-editor'){if(!confirm('Descartar as alterações deste orçamento?'))return true;draft=null;screen='list';refresh();return true;}
  if(a==='sl-list'){screen='list';refresh();return true;}
  if(a==='sl-view-quote'){screen='detail:'+id;refresh();return true;}
  if(a==='sl-add-line'){addLine();return true;}
  if(a==='sl-remove-line'){
   if(draft){readDraft();draft.items.splice(Number(target.dataset.index),1);draft.productPriceCents=null;refresh();}return true;
  }
  if(a==='sl-recalculate'){readDraft();refresh();return true;}
  if(a==='sl-pdf'){void pdf(id,false);return true;}
  if(a==='sl-share-pdf'){void pdf(id,true);return true;}
  if(a==='sl-status'){
   const q=state().quotes.find(v=>v.id===id),status=target.dataset.status;
   if(q&&QUOTE_STATUSES.some(x=>x[0]===status)){
    q.status=status;q.updatedAt=new Date().toISOString();
    if(status==='enviado'&&!q.sentAt)q.sentAt=q.updatedAt;
    h.commit();h.toast('Status do orçamento atualizado.');
   }return true;
  }
  if(a==='sl-followup'){followup(id);return true;}
  if(a==='sl-start-voice'){startVoice();return true;}
  if(a==='sl-stop-voice'){stopVoice();return true;}
  if(a==='sl-reparse-voice'){const t=document.getElementById('sl-voice-transcript')?.value||'';readDraft();interpretVoice(t);return true;}
  return false;
 }
 function submit(event){
  if(event.target?.id==='sl-quote-form'){event.preventDefault();saveDraft();return true;}
  if(event.target?.id==='sl-settings-form'){
   event.preventDefault();const f=new FormData(event.target),cfg=state().settings;
   const cents=k=>fromMoney(f.get(k));
   for(const k of ['assemblyCents','consumablesCents','overheadCents','directPackagingCents','marketplaceFixedFeeCents','marketplacePackagingCents']){
    const v=cents(k);if(v===null){h.toast('Confira o valor de '+k+'.');return true;}cfg[k]=v;
   }
   const markup=Number(f.get('defaultMarkupPct')),fee=Number(f.get('marketplaceFeePct'));
   if(!Number.isFinite(markup)||markup<100||markup>400||!Number.isFinite(fee)||fee<0||fee>90){h.toast('Confira a porcentagem de lucro e a taxa do marketplace.');return true;}
   cfg.defaultMarkupPct=markup;cfg.minMarkupPct=100;cfg.marketplaceFeePct=fee;
   cfg.marketplaceConfigured=f.get('marketplaceConfigured')==='on';
   cfg.validityDays=Math.min(90,Math.max(0,Number(f.get('validityDays'))||0));
   cfg.contact=String(f.get('contact')||'').trim();
   cfg.paymentTerms=String(f.get('paymentTerms')||'').trim();
   cfg.productionTerms=String(f.get('productionTerms')||'').trim();
   h.commit();h.toast('Custos e regras SOUNDLINE salvos.');return true;
  }
  if(event.target?.id==='entry-form'&&h.modalMode()==='sl-supply'){
   event.preventDefault();const f=new FormData(event.target),id=h.modalId();
   const name=String(f.get('name')||'').trim(),category=String(f.get('category')||'');
   const cost=fromMoney(f.get('cost'));
   if(!name||!SUPPLY_CATEGORIES.some(x=>x[0]===category)||cost===null){h.toast('Informe nome, categoria e custo válido.');return true;}
   const d=state(),s=d.supplies.find(x=>x.id===id);
   const payload={name,category,costCents:cost,notes:String(f.get('notes')||'').trim(),active:f.get('active')==='on'};
   if(s)Object.assign(s,payload);
   else{
    if(d.supplies.length>=600){h.toast('Limite de 600 insumos.');return true;}
    d.supplies.push({id:h.newId('sl-supply'),...payload,createdAt:new Date().toISOString()});
   }
   h.closeModal();h.commit();h.toast('Insumo salvo.');return true;
  }
  return false;
 }
 return {render,action,submit,cancelVoice:()=>stopVoice(true)};
}
