#!/usr/bin/env node
// MEU SÓCIO — instalação assistida do servidor Web Push.
// Executar LOCALMENTE no Mac; nunca compartilhar chaves privadas no chat.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {randomBytes,webcrypto} from 'node:crypto';

const folder=dirname(fileURLToPath(import.meta.url));
const configFile=join(folder,'wrangler.jsonc');
const dbName='socio-push';
const cli=process.platform==='win32'?'npx.cmd':'npx';
const rl=createInterface({input:stdin,output:stdout});
const print=(message='')=>console.log(message);

async function command(args,{capture=false,inputText}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(cli,['wrangler',...args],{
      cwd:folder,env:{...process.env,NO_COLOR:'1'},
      stdio:[inputText!==undefined?'pipe':'inherit',capture?'pipe':'inherit','inherit']
    });
    let output='';
    if(capture)child.stdout.on('data',chunk=>{output+=chunk.toString();});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(output):reject(Error('Wrangler falhou em: '+args.join(' ')+' (código '+code+')')));
    if(inputText!==undefined){child.stdin.end(inputText);}
  });
}
async function selectDatabase(){
  let raw=await command(['d1','list','--json'],{capture:true});
  let list;
  try{list=JSON.parse(raw);}catch{throw Error('Não foi possível interpretar a lista de bancos do Cloudflare.');}
  if(!Array.isArray(list))list=list?.result||list?.databases||[];
  let match=list.find(x=>x.name===dbName);
  if(!match){
    print('Criando banco D1 '+dbName+'...');
    await command(['d1','create',dbName],{capture:false});
    raw=await command(['d1','list','--json'],{capture:true});
    list=JSON.parse(raw);
    if(!Array.isArray(list))list=list?.result||list?.databases||[];
    match=list.find(x=>x.name===dbName);
  }
  const id=match?.uuid||match?.id;
  if(!/^[a-f0-9-]{36}$/i.test(String(id||'')))throw Error('Banco criado, mas seu identificador não foi identificado. Consulte o painel D1.');
  return id;
}
async function setDbId(id){
  const raw=await readFile(configFile,'utf8');
  const config=JSON.parse(raw);
  if(config.d1_databases?.[0]?.database_id===id)return;
  if(!config.d1_databases?.[0]||config.d1_databases[0].database_name!==dbName)
    throw Error('Arquivo wrangler.jsonc inesperado; não vou sobrescrever configurações desconhecidas.');
  config.d1_databases[0].database_id=id;
  await writeFile(configFile,JSON.stringify(config,null,2)+'\n',{mode:0o600});
}
async function secretValues(){
  const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const publicKey=Buffer.from(await webcrypto.subtle.exportKey('raw',keys.publicKey)).toString('base64url');
  const privateJwk=await webcrypto.subtle.exportKey('jwk',keys.privateKey);
  const key=privateJwk.d;
  if(!key)throw Error('Não foi possível gerar a chave VAPID.');
  const answer=(await rl.question('Qual e-mail para contato técnico do Web Push? ')).trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer))throw Error('E-mail inválido.');
  return {
    VAPID_SUBJECT:'mailto:'+answer,
    VAPID_PUBLIC_KEY:publicKey,
    VAPID_PRIVATE_KEY:key,
    SETUP_SECRET:randomBytes(24).toString('hex')
  };
}
async function main(){
  print('\nMEU SÓCIO — Configurar notificações Cloudflare');
  print('Este instalador cria um banco D1 e publica um Worker. Confira o plano gratuito no Cloudflare antes de continuar.');
  print('Não envie tokens, chaves ou capturas com segredos para ninguém.');
  const confirm=(await rl.question('Continuar? [s/N] ')).trim().toLowerCase();
  if(!['s','sim','y','yes'].includes(confirm)){print('Operação cancelada.');return;}
  print('\n1/5 — Conectar ao Cloudflare (pode abrir o navegador)...');
  await command(['login']); // Garante autorização explícita neste Mac.
  print('\n2/5 — Preparar D1...');
  const dbId=await selectDatabase();
  await setDbId(dbId);
  await command(['d1','execute',dbName,'--remote','--file=./schema.sql','--yes']);
  print('\n3/5 — Publicar Worker...');
  const deployOutput=await command(['deploy'],{capture:true});
  print(deployOutput);
  const match=deployOutput.match(/https:\/\/[\w.-]+\.workers\.dev\b/);
  const serviceUrl=match?.[0]||'(veja URL HTTPS no painel Workers & Pages)';
  print('\n4/5 — Gerar e enviar segredos SEM gravá-los no GitHub...');
  const secrets=await secretValues();
  await command(['secret','bulk'],{capture:false,inputText:JSON.stringify(secrets)});
  print('\n5/5 — Verificar servidor...');
  if(match){
    try{
      const response=await fetch(serviceUrl+'/health',{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      print('Serviço respondeu: '+await response.text());
    }catch(err){print('Aviso: a URL ainda não respondeu. Confira no painel do Cloudflare. '+err.message);}
  }
  print('\n✅ CONFIGURAÇÃO ENVIADA AO CLOUDFLARE');
  print('Endereço do serviço: '+serviceUrl);
  print('\nCÓDIGO DE ATIVAÇÃO DO SEU IPHONE (guarde em gerenciador de senhas):');
  print(secrets.SETUP_SECRET);
  print('\nAbra MEU SÓCIO → Ajustes → Notificações: informe o endereço do serviço e este código.');
  print('Toque em Ativar notificações; autorize no iPhone; depois Enviar teste.');
  print('\nIMPORTANTE: não compartilhe o código acima neste chat. Ele não está armazenado pelo script.');
}
try{await main();}
catch(err){print('\nNão foi possível finalizar: '+err.message);process.exitCode=1;}
finally{rl.close();}
