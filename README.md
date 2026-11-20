## Preparação V003.1 — REIZZOR STATION (ramificação, ainda não publicada)

Adiciona **REIZZOR STATION** a **Meus Negócios**, com uma central criativa pessoal para cadastrar músicas, compor letras, adicionar BPM/tom/afinação, anotações e guardar **links HTTPS** para áudios-guia. Não há upload de arquivos nessa versão. A estação preserva o foco financeiro da SOUNDLINE e não cria tarefas automáticas.

- Compatível com backups anteriores: na primeira leitura dos dados antigos, a estação é inserida sem apagar tarefas e histórico. Letras e músicas passam a integrar o backup JSON.
- Dados permanecem exclusivamente no armazenamento local do dispositivo. O Mac e o iPhone **não** sincronizam automaticamente. Faça backup antes de atualizar.
- O aplicativo coletivo **REIZZOR HUB** será futuro e separado, com compartilhamento seletivo. Nada da estação pessoal é enviado aos integrantes.
- Atualização da interface Web Push não é parte desta entrega. Não implantar a V003.1 até validar o lembrete automático da V003 em 21/11/2026.

### Roteiro de teste antes de mesclar

1. Testar lembrete automático agendado na V003 no iPhone em 21/11; confirmar recebimento, horário e comportamento ao concluir a tarefa.
2. Na ramificação V003.1, abrir Negócios → REIZZOR STATION → Abrir estação.
3. Criar música, editar letra e dados musicais, adicionar link HTTPS de guia e remover referência.
4. Exportar backup e reimportá-lo; conferir que músicas, tarefas e histórico continuam intactos.
5. Verificar que Início, Execução, Agenda, Ajustes e Web Push continuam funcionando.
6. Depois, planejar o refinamento de layout sem adicionar recursos complexos.

## V003 — MEU SÓCIO · notificações push (20/11/2026)

Código da interface e do serviço Web Push preparado, **mas a função de entrega ainda não está ativa** até implantar a pasta `push-worker/` no Cloudflare. A aba **Ajustes → Notificações** permite ativar voluntariamente após configurar o URL HTTPS privado e a chave de ativação. O app pode programar aviso para o dia seguinte quando uma tarefa é adiada. Concluir a tarefa cancela o aviso se a sincronização funcionar. O app nunca solicita permissão antes do toque do usuário. A notificação, quando enviada, abrirá **Executar**. Horário padrão 10:00 local, ajustável. Não são enviados lembretes anteriores cuja hora já passou. Nenhuma alteração no layout geral foi feita.

**Implantação técnica:** [push-worker/README.md](push-worker/README.md). Não compartilhe chaves privadas ou códigos de ativação. **Atenção:** GitHub Pages sozinho não envia Web Push; o serviço Cloudflare precisa de D1, cron e segredos, com consentimento explícito do usuário.

# SÓCIO — Versão 002

**Atualização V002.2 (20/11/2026):** gerenciamento de atualizações da PWA. A aba Ajustes mostra a versão instalada e oferece o botão **Verificar e atualizar**, que busca um manifesto `version.json` sem cache e recarrega a página. O aplicativo verifica novas versões ao abrir e ao voltar para primeiro plano com conexão à internet. Se um formulário estiver aberto, o recarregamento fica pendente até ele ser fechado. A atualização do código não apaga o `localStorage`. O service worker prioriza a rede e mantém o cache somente para uso offline; a cada nova versão, atualizar `js/updater.js` (APP_VERSION), `index.html`, `service-worker.js` (CACHE_NAME) e `version.json` (por último). Em iOS, a reabertura ou a volta ao primeiro plano pode ser necessária para detectar a atualização. NÃO desinstale o atalho para forçar atualização — os dados são locais.

**Atualização V002.1 (20/11/2026):** O botão “Não agora, outra ação” mantém a tarefa pendente, a adia apenas nas recomendações do dia e registra o adiamento no Histórico como decisão (sem contabilizá-lo como tarefa concluída). O layout permanece o mesmo. Os adiamentos anteriores à atualização não são recriados retroativamente.

**Menos planos. Mais avanço.** Aplicativo pessoal de negócios, execução de tarefas e compromissos com entrada por voz. PWA gratuito, sem servidor nem dependências externas.

## Funcionalidades

- **Início:** visão geral dos negócios e prioridade recomendada.
- **Meus negócios:** cadastro, edição, objetivos, situação e foco.
- **Tarefas inteligentes:** impacto, urgência, esforço, prazo, conclusão e adiamento.
- **Modo Execução:** uma ação prioritária de cada vez, com a razão da recomendação.
- **Histórico:** decisões, avanços e tarefas concluídas.
- **Minha Agenda (V002):** cadastrar, editar, concluir e excluir compromissos com título, data, horário e observações. Botão **Gravar áudio** para falar um compromisso; rever áudio e transcrição antes de salvar.
- **Dados e ajustes:** backup local JSON para exportar/importar.

Negócios iniciais demonstrativos: SOUNDLINE, VOZ PRONTA, Estúdio, Locação de som e Novas oportunidades.

## Como publicar no GitHub Pages

O código está na raiz da branch `main` deste repositório.

1. Acesse **Settings → Pages** no GitHub.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Selecione `main`, pasta `/(root)`, e clique em **Save**.
4. Após a publicação, abra **https://zehreismusic.github.io/SOCIO/**.
5. No iPhone, abra no Safari e use **Compartilhar → Adicionar à Tela de Início**. No Mac, use o navegador ou instale como web app quando a opção estiver disponível.

**O link só funcionará depois de o GitHub Pages estar efetivamente publicado.** O site usa HTTPS para poder solicitar acesso ao microfone.

## Como usar a agenda por voz

1. Abra **Minha Agenda** e toque em **Gravar áudio**. Permita o uso do microfone.
2. Diga por exemplo: “Marcar reunião com fornecedor amanhã às 15 horas”.
3. Toque em **Parar e revisar**.
4. Confira o áudio, a transcrição e os campos **título / data / hora**. Corrija se necessário e clique em **Salvar compromisso**.

O navegador poderá oferecer transcrição automática em português do Brasil usando `SpeechRecognition`/`webkitSpeechRecognition`. **A disponibilidade varia por navegador, iOS e PWA**, e o reconhecimento pode depender da internet e de um serviço externo. Sem transcrição automática, é possível ouvir o áudio e preencher os campos manualmente. O arquivo de áudio não fica salvo no aplicativo; são armazenados apenas os dados do compromisso confirmado.

## Privacidade e limitações

Os dados cadastrados ficam no **armazenamento local do dispositivo** (`localStorage`). Não há conta, sincronização entre Mac/iPhone, notificações de compromissos nem integração com Apple/Google Calendar nesta versão. A transcrição pelo navegador pode envolver serviços do fornecedor do navegador.

O repositório e o código são públicos. **Nunca coloque senhas, dados pessoais ou backups no repositório.** Apagar dados do navegador pode apagar registros locais. Faça backups em **Dados e ajustes → Baixar meus dados**. A importação substitui os registros atuais do aparelho.

## Desenvolvimento e testes

Requisitos: navegador moderno; Node.js 20+ apenas para executar os testes.

```sh
npm test
python3 -m http.server 8080
```

Abra `http://localhost:8080` (não abra `index.html` diretamente como arquivo). Não é preciso executar `npm install`.

Arquitetura: HTML + CSS + JavaScript modular. `js/logic.js` calcula prioridades; `js/store.js` faz persistência/backup; `js/agenda.js` interpreta datas e horários; `js/app.js` implementa a interface; `service-worker.js` dá suporte offline após a primeira visita.

**Status:** código V002 enviado para o GitHub, 20 testes automatizados locais aprovados. O reconhecimento de voz deve ser validado nos navegadores/dispositivos reais. O layout será refinado apenas após validar as funcionalidades principais.
