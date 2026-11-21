import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const text=path=>readFileSync(new URL(path,root),'utf8');
const bytes=path=>readFileSync(new URL(path,root));

test('fonte do ícone 01 aprovado é íntegra, sem novas versões criadas',()=>{
  const base64=[1,2,3].map(i=>text('assets/icon-v1-source/part'+i+'.b64').trim()).join('');
  const data=Buffer.from(base64,'base64');
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(data).digest('hex'),'441d561328c2487fd6819c9449bdd0d93cc48a5ff64d2f95c69392f1cd5839b5');
});

test('PWA publica os três ícones PNG nos tamanhos corretos',()=>{
  for(const [path,dimension] of Object.entries({
    'icons/icon-192.png':192,'icons/icon-512.png':512,'icons/apple-touch-icon.png':180
  })){
    const buf=bytes(path);
    assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path+' assinatura PNG');
    assert.equal(buf.readUInt32BE(16),dimension,path+' largura');
    assert.equal(buf.readUInt32BE(20),dimension,path+' altura');
  }
});

test('atalho iPhone e manifestos usam versão cache-busted do ícone oficial',()=>{
  const html=text('index.html'),manifest=JSON.parse(text('manifest.webmanifest')),sw=text('service-worker.js');
  assert.match(html,/apple-touch-icon\.png\?v=0035/);
  assert.match(html,/icon-192\.png\?v=0035/);
  assert.equal(manifest.icons.length,2);
  assert.ok(manifest.icons.every(x=>x.src.includes('?v=0035')&&x.purpose==='any'));
  for(const icon of ['icon-192.png','icon-512.png','apple-touch-icon.png'])assert.ok(sw.includes("'./icons/"+icon+"'"));
  assert.match(sw,/socio-v00316-20261121/);
});
