# MEU SÓCIO — Serviço privado de Web Push (V003)

**Status:** código preparado no GitHub, **não implantado**. Nenhuma notificação remota será enviada até a conta Cloudflare ser configurada.

O aplicativo continua hospedado no GitHub Pages. Este Worker envia mensagens Web Push para o atalho instalado no iPhone. O banco D1 guarda inscrições criptográficas e, após consentimento, apenas os títulos e os horários das tarefas adiadas. Não recebe os demais negócios, agenda ou histórico.

## Caminho recomendado: instalador assistido no Mac

Pré-requisito: **Node.js LTS** instalado no Mac (https://nodejs.org). A conta Cloudflare já pode estar criada.

Use o Terminal e execute:

```sh
cd ~/Downloads
curl -fL https://github.com/ZehReisMusic/SOCIO/archive/refs/heads/main.zip -o meu-socio.zip
unzip -oq meu-socio.zip
cd SOCIO-main/push-worker
npm install
npm run setup
```

O assistente abrirá o navegador para autorizar o Cloudflare e pedirá um e-mail de contato técnico. Ele cuida da criação do banco D1, atualização de `wrangler.jsonc` **somente na cópia local**, preparação das tabelas, publicação do Worker e gravação das chaves VAPID como Cloudflare Secrets. Não imprime a chave privada VAPID nem envia credenciais ao GitHub. O assistente exibirá **apenas no próprio Mac** o URL do Worker e um código secreto de ativação para copiar ao iPhone. Nunca compartilhe esse código em chats/capturas.

**Não execute o instalador de novo após ativar o serviço**, pois recriará segredos e poderá invalidar inscrições anteriores. Para novas versões, use `npx wrangler deploy` preservando o mesmo banco e as mesmas chaves.

Se o `curl`, o `npm install` ou a autenticação falhar, interrompa o processo e procure a mensagem de erro; não substitua valores por tentativa. Os passos manuais abaixo são uma alternativa, não são necessários após o sucesso do instalador.

### Alternativa: configuração manual

## Passos únicos no Mac

1. Crie ou acesse sua conta gratuita em https://dash.cloudflare.com/ .
2. Instale Node.js LTS, caso ainda não tenha; no Terminal, clone o repositório `https://github.com/ZehReisMusic/SOCIO` (ou baixe o ZIP do GitHub) e entre na pasta `push-worker`.
3. Execute:

```sh
npm install
npx wrangler login
npx wrangler d1 create socio-push
```

4. Copie o **database_id** retornado, edite `push-worker/wrangler.jsonc` substituindo `REPLACE_WITH_DATABASE_ID` por esse ID. **Nunca substitua pelo nome do banco**.
5. Prepare o banco:

```sh
npx wrangler d1 execute socio-push --remote --file=./schema.sql
```

6. Gere um par VAPID localmente:

```sh
npm run vapid
```

Guarde `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`. **A privada nunca deve ser enviada ao ChatGPT nem salva no GitHub.** Defina as variáveis seguras no Cloudflare:

```sh
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put SETUP_SECRET
```

Para cada comando, cole o valor no Terminal quando solicitado. Use `mailto:seu-email@exemplo.com` para VAPID_SUBJECT (seu endereço real, não o exemplo). Gere `SETUP_SECRET` com `openssl rand -hex 24`, guarde-a em um gerenciador de senhas e **não a compartilhe no chat**.

7. Publique o serviço:

```sh
npx wrangler deploy
```

O Terminal mostrará um URL HTTPS terminando em `.workers.dev`. Visite esse URL seguido de `/health`: deve retornar `{"ok":true,"service":"meu-socio-push"}`.

8. Abra o ícone **MEU SÓCIO** instalado no iPhone → **Ajustes → Notificações**, insira o URL do Worker, cole sua **SETUP_SECRET** e toque em **Ativar notificações**. Autorize o alerta do iOS. Use **Enviar teste** e bloqueie a tela do iPhone para verificar se o push aparece.

## Regras e limites da V003

- O app só pede permissão após toque; nenhuma ativação automática.
- Avisos são agendados **apenas para tarefas adiadas explicitamente**, no dia seguinte, às **10h no fuso local do aparelho** (alterável).
- Se a tarefa for concluída e a sincronização com o servidor funcionar, o aviso será cancelado.
- Quando estiver offline, o app mantém os dados locais, mas o servidor pode ficar desatualizado até a próxima sincronização. É possível receber um lembrete antigo nesse intervalo.
- O Worker é executado a cada 5 minutos (horários aproximados, sem garantia de pontualidade); iOS pode atrasar/silenciar notificações conforme Foco e bateria.
- Um evento já adiado antes da ativação, cujo horário de envio tenha passado, não é disparado retroativamente.
- Para obter push com app fechado no iPhone, abra o app pela **Tela de Início**, não pela aba do Safari. Requer iOS 16.4 ou posterior.
- O endpoint registra até 5 dispositivos e no máximo 3 notificações de teste por dia em cada um.
- A chave privada VAPID e a chave SETUP_SECRET ficam somente em **Cloudflare Secrets**; o repositório é público.
- Acesso ao D1 e avisos depende da disponibilidade e das cotas do plano Cloudflare. Confira limites e cobranças no painel antes de habilitar recursos pagos.
- O banco não é sincronizador de tarefas: dados pessoais completos continuam locais no iPhone. Remover o ícone pode eliminar essa base local; faça backup pelo app.

## Operação e desenvolvimento

- Código: `src/index.js` — `fetch` para /health, /config, /register, /sync, /test, /disable; `scheduled` para envio.
- D1: `schema.sql`.
- Cron: `*/5 * * * *` em UTC; o agendamento em horário local é convertido pelo PWA para UTC antes de salvar.
- Criptografia: `@block65/webcrypto-web-push@2.0.0` (RFC 8291/RFC 8292).
- Para testar cron localmente: `npx wrangler dev --test-scheduled`.
- Nunca coloque tokens de dispositivo, assinaturas, PINs ou chaves privadas em issues, capturas públicas ou commits.

Fontes: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers ; https://developers.cloudflare.com/workers/configuration/cron-triggers/ ; https://developers.cloudflare.com/d1/get-started/ .
