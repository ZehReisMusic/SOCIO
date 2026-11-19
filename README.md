# SÓCIO — Versão 002

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
