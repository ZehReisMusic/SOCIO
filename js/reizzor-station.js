// REIZZOR STATION — conteúdo privado no armazenamento local do MEU SÓCIO.
// Este módulo não publica conteúdo, não sincroniza com o REIZZOR HUB e não altera o Web Push.
export const STATION_STATUSES={
  ideia:'Ideia',
  desenvolvimento:'Em composição',
  repertorio:'No repertório',
  concluida:'Concluída'
};

export function renderStationContent(data,selectedId,esc){
  const songs=[...(data.station?.songs||[])].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  const current=songs.find(s=>s.id===selectedId)||null;
  const button=(label,action,id='',extra='')=>`<button type="button" class="btn-outline btn-small" data-action="${action}" data-id="${esc(id)}" ${extra}>${label}</button>`;
  const list=songs.length?`<div class="station-list">${songs.map(s=>`
    <article class="station-song ${current?.id===s.id?'selected':''}">
      <div><div class="station-song-name">${esc(s.title)}</div>
      <div class="station-song-meta">${esc(STATION_STATUSES[s.status]||'Ideia')}${s.bpm?' · '+esc(s.bpm)+' BPM':''}${s.tuning?' · '+esc(s.tuning):''}</div></div>
      ${button('Abrir','open-song',s.id)}
    </article>`).join('')}</div>`:`<div class="panel station-empty"><h2>Suas músicas em um só lugar</h2><p>Comece cadastrando uma composição. Letras, anotações e referências ficarão organizadas no seu espaço pessoal.</p></div>`;
  const guides=current?.guides||[];
  const detail=current?`<section class="panel station-detail">
      <div class="station-detail-top"><div><span class="eyebrow">MÚSICA SELECIONADA</span><h2>${esc(current.title)}</h2><p>${esc(STATION_STATUSES[current.status]||'Ideia')}</p></div>
      <div class="station-buttons">${button('Editar música','edit-song',current.id)}${button('Excluir','delete-song',current.id)}</div></div>
      <div class="station-facts">
        <span><strong>Tom:</strong> ${esc(current.key||'Não informado')}</span>
        <span><strong>BPM:</strong> ${current.bpm||'Não informado'}</span>
        <span><strong>Afinação:</strong> ${esc(current.tuning||'Não informada')}</span>
      </div>
      <div class="station-detail-grid">
        <section><h3>Letra / composição</h3><div class="station-copy">${esc(current.lyrics||'Nenhuma letra cadastrada ainda.')}</div></section>
        <section><h3>Anotações musicais</h3><div class="station-copy">${esc(current.notes||'Sem anotações por enquanto.')}</div></section>
      </div>
      <div class="station-guides-head"><h3>Áudios-guia e referências</h3>${button('Adicionar link de áudio','add-guide',current.id)}</div>
      <p class="station-hint">Nesta primeira versão, use links HTTPS para arquivos ou pastas de áudio que você já guarda em outro serviço. Não fazemos upload nem cópias nesta etapa.</p>
      ${guides.length?`<div class="station-guide-list">${guides.map(g=>`
      <div class="station-guide"><a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">♫ ${esc(g.label)}</a><button class="btn-quiet" type="button" data-action="delete-guide" data-id="${esc(g.id)}" data-song="${esc(current.id)}" aria-label="Remover referência">Remover</button></div>
      `).join('')}</div>`:'<p class="station-hint">Nenhum guia associado ainda.</p>'}
    </section>`:'';
  return `<div class="station-workspace">
    <section class="station-intro panel"><div><div class="eyebrow">ESPAÇO PRIVADO</div><h2>Sua central criativa REIZZOR</h2><p>Composições, repertório, letras e guias em um só lugar. Sem tarefas coletivas e sem tirar o foco financeiro do SÓCIO.</p></div><div><strong>${songs.length}</strong><span> músicas</span></div></section>
    <div class="station-bar"><h2>Repertório e composições</h2><button type="button" class="btn-primary" data-action="new-song">＋ Nova música</button></div>
    ${list}
    ${detail}
    <p class="station-hint">Os registros ficam apenas neste aparelho e entram no backup JSON do MEU SÓCIO. Sem sincronização automática com iPhone, Mac ou integrantes.</p>
  </div>`;
}
