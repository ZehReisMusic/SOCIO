# SÓCIO — Versão 001

**Menos planos. Mais avanço.** PWA pessoal para acompanhar negócios, recomendar uma única ação por vez e registrar resultados reais.

## O que funciona

- Visão geral com recomendação do dia e indicadores de ações concluídas.
- Cadastro e edição de negócios, objetivos, contexto atual, situação e foco.
- Criação, edição, exclusão, conclusão e reabertura de tarefas; impacto, urgência, esforço, prazo e duração estimada.
- Modo Execução: uma ação por vez, com explicação da recomendação. Permite adiar para amanhã sem penalidade.
- Histórico de tarefas concluídas, decisões e avanços registrados manualmente.
- Exportar e importar backups JSON.
- PWA responsivo para Mac/iPhone, com ícone de instalação e suporte offline após primeira visita via HTTPS.
- Cinco negócios iniciais e duas tarefas reais como ponto de partida.

## Arquitetura

HTML + CSS + JavaScript modular, sem frameworks, sem build e sem dependências de terceiros. `js/logic.js` calcula a recomendação, `js/store.js` cuida da persistência e validação do backup, `js/app.js` implementa a interface. Dados no `localStorage` do próprio navegador, **sem servidor, login ou sincronização entre aparelhos**. O código público e o serviço de hospedagem não recebem seus dados pessoais cadastrados no app.

## Executar localmente no Mac

1. Descompacte o ZIP e abra o Terminal na pasta `socio-v001`.
2. Execute `python3 -m http.server 8080`.
3. Abra `http://localhost:8080` no Safari ou Chrome.
4. Para interromper, use `Ctrl+C` no Terminal.

**Importante:** não abra `index.html` diretamente via `file://`; PWA e importações funcionam de forma mais confiável com um servidor HTTP local ou HTTPS.

## Publicar gratuitamente no GitHub Pages

1. Crie um **repositório público separado** (sugestão: `SOCIO`) na sua conta GitHub. O código-fonte inicial inclui nomes e contexto dos cinco negócios; só publique se isso for aceitável.
2. Envie **o conteúdo descompactado** desta pasta para a raiz do repositório na branch `main`. Não envie apenas o ZIP. Também pode permitir que o ChatGPT envie os arquivos ao repositório via conector GitHub se a instalação tiver acesso de escrita.
3. Em **Settings → Pages → Build and deployment**, selecione **Deploy from a branch**, branch `main`, pasta `/(root)` e salve.
4. Acesse a URL informada pelo GitHub Pages, com HTTPS. No Safari do iPhone, use o menu Compartilhar → **Adicionar à Tela de Início** e selecione **Abrir como aplicativo**, se aparecer.
5. Para instalar no Mac, use o recurso do navegador para adicionar o site como web app, se disponível.

## Backup e dados

Use **Ajustes → Baixar meus dados** para guardar um arquivo JSON. A importação substitui a base local do aparelho; um backup não sincroniza automaticamente Mac e iPhone. Apagar os dados do navegador, remover um PWA ou usar navegação privada pode causar perda de registros. Esta é uma versão de teste pessoal: não armazene senhas nem informações sensíveis.

## Regras transparentes de priorização

Pontuação = `impacto × 4 + urgência × 3 + (6 − esforço) × 2 + foco do negócio + bônus por prazo + ajuste pela situação do negócio`.

O bônus de prazo varia de 0 a 12; negócios em espera recebem penalidade para preservar o foco. O algoritmo não consulta nenhuma IA paga. Os resultados são sugestões, não cobranças. Ações adiadas somem da recomendação até o próximo dia local.

## Testes

Com Node.js 20+ instalado, execute `npm test`. Não há `npm install`, pois a aplicação não tem dependências.

## Plano de evolução

- **V002 (esta entrega):** fluxo essencial + backup local.
- **V002.1:** validação de usabilidade e refinamentos baseados no uso real.
- **V002 (só se necessário):** autenticação e sincronização segura entre dispositivos.
- **V003 (após validação):** assessor com IA, análise financeira e notificações — sem contratar infraestrutura antes de existir necessidade real.

## Estrutura

```
index.html
css/style.css
js/logic.js
js/store.js
js/app.js
icons/
manifest.webmanifest
service-worker.js
.nojekyll
package.json
tests/logic.test.js
README.md
```


## V002 — Minha Agenda e microfone

A aba **Minha Agenda** permite criar, editar, concluir e excluir compromissos pessoais com título, data, hora e observações. Para agendar falando:

1. Abra **Minha Agenda**, toque em **Gravar áudio**, permita o acesso ao microfone.
2. Diga, por exemplo: “Agendar reunião com fornecedor amanhã às 15 horas”.
3. Toque em **Parar e revisar**. Escute a gravação, revise a transcrição, título, data e horário e confirme **Salvar compromisso**.
4. A gravação é **temporária**: o arquivo de áudio não é guardado após fechar a revisão, mas os dados confirmados entram na agenda e no backup JSON.

**Dependência do navegador:** a captura usa `MediaRecorder` e o reconhecimento de fala usa `SpeechRecognition`/`webkitSpeechRecognition` quando disponível. O reconhecimento de fala pode requerer internet e usar um serviço externo do fornecedor do navegador; não é uma transcrição local garantida. O suporte varia, inclusive no Safari/iOS e em PWAs instaladas. Se não houver transcrição automática, o usuário pode ouvir o áudio temporário e preencher título/data/hora manualmente. A entrada manual sempre funciona. Nenhuma integração com Google/Apple Calendar e nenhum lembrete/notificação estão incluídos nesta versão.

**Migração de dados:** a V002 mantém a mesma chave `socio.v001.data` e aceita backups V001 sem compromissos; dados antigos são preservados e o novo campo `appointments` é criado automaticamente. Como na V001, cada aparelho mantém seus próprios dados. Para transferir use exportação/importação de backup.

**Publicação no GitHub:** criar repositório separado `SOCIO`, enviar todos os arquivos da pasta (incluindo `.nojekyll`, `index.html`, `css`, `js`, `icons`, `service-worker.js`, `manifest.webmanifest`) na raiz do branch `main`. No GitHub, abrir **Settings → Pages → Deploy from a branch → main → /(root) → Save**. É preciso acesso ao repositório para que o assistente faça o envio por integração; a V002 não foi publicada automaticamente. A página precisa de HTTPS para liberar microfone.
