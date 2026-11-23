import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('SOUNDLINE abre por Meus Negócios sem criar barra de navegação extra',()=>{
 const app=read('js/app.js');
 assert.match(app,/data-action="open-soundline"/);
 assert.match(app,/case 'open-soundline':navigate\('soundline'\)/);
 assert.match(app,/soundline:\(\)=>soundlineUI.render\(\)/);
 assert.match(app,/soundlineUI.action\(target\)/);
 assert.match(app,/if\(soundlineUI.submit\(event\)\)return/);
 assert.match(app,/getData:\(\)=>data,commit:save/);
});
test('backup local migra o SOUNDLINE sem trocar chave ou versão de dados',()=>{
 const store=read('js/store.js'),logic=read('js/logic.js');
 assert.match(store,/soundline:normalizeSoundline\(value\.soundline\)/);
 assert.match(store,/socio\.v001\.data/);
 assert.match(logic,/soundline:createSoundlineState\(\)/);
});
test('interface contém cadastro, confirmação, editor multi-itens, delivery, voice e PDF',()=>{
 const ui=read('js/soundline-ui.js');
 for(const term of ['sl-new-supply','sl-edit-supply','sl-new-quote','sl-add-line',
  'sl-remove-line','sl-recalculate','sl-status','sl-pdf','sl-share-pdf','sl-start-voice',
  'sl-stop-voice','sl-followup','sl-quote-form','sl-settings-form'])
  assert.ok(ui.includes(term),term);
 assert.match(ui,/navigator\.share/);
 assert.match(ui,/recognition\.lang='pt-BR'/);
 assert.match(ui,/quotePricingSnapshot/);
 assert.match(ui,/readDraft\(\)/);
 assert.match(ui,/confirm\('O preço escolhido está abaixo/);
 assert.match(ui,/quoteFileName/);
});
test('tema do iPhone não perde CSS antigos e não força zoom ou rolagem',()=>{
 const css=read('css/soundline-v00322.css'),html=read('index.html');
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/min-width:0/);
 assert.match(css,/font-size:16px!important/);
 assert.doesNotMatch(css,/user-scalable|maximum-scale|touch-action|position:fixed/);
 assert.ok(html.indexOf('soundline-v00322.css')>html.indexOf('task-voice-v00321.css'));
});
test('V003.25 entra no cache PWA e preserva notificações e recursos anteriores',()=>{
 const sw=read('service-worker.js'),html=read('index.html'),up=read('js/updater.js');
 assert.match(up,/APP_VERSION = 'V003\.25'/);
 assert.match(html,/MEU SÓCIO · V003\.25/);
 assert.match(sw,/socio-v00325-20261123/);
 for(const f of ['soundline-core.js','soundline-ui.js','soundline-pdf.js','soundline-voice.js','time-aware.js','task-voice.js','agenda-task-links.js','push.js'])
  assert.ok(sw.includes(f),f);
 assert.match(sw,/self\.addEventListener\('push'/);
 assert.match(sw,/self\.addEventListener\('notificationclick'/);
});
