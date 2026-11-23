import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Tarefas têm botão funcional de reconhecimento de fala e revisão obrigatória',()=>{
 const app=read('js/app.js');
 assert.match(app,/from '.\/task-voice\.js'/);
 assert.match(app,/function taskVoicePanel\(\)/);
 assert.match(app,/data-action="task-voice-start"/);
 assert.match(app,/case 'task-voice-start':startTaskSpeech\(\)/);
 assert.match(app,/case 'task-voice-stop':stopTaskSpeech\(\)/);
 assert.match(app,/case 'parse-task-voice'/);
 assert.match(app,/const voiceHtml=voice\?/);
 assert.match(app,/taskForm\('','',true,session\.transcript\|\|''\)/);
});
test('reconhecimento pt-BR depende de permissão, nunca salva sem o usuário confirmar',()=>{
 const app=read('js/app.js');
 assert.match(app,/window\.SpeechRecognition\|\|window\.webkitSpeechRecognition/);
 assert.match(app,/recognition\.lang='pt-BR'/);
 assert.match(app,/recognition\.start\(\)/);
 assert.match(app,/recognition\.stop\(\)/);
 assert.match(app,/const Speech=window\.SpeechRecognition/);
 assert.match(app,/Use o microfone do teclado do iPhone/);
 assert.doesNotMatch(app,/recognition\.onend=\(\)=>save\(/);
});
test('visualização na aba Tarefas preserva inputs de data e seletores',()=>{
 const app=read('js/app.js');
 assert.match(app,/\$\{taskVoicePanel\(\)\}<div class="filter-bar">/);
 assert.match(app,/field\('Prazo \(opcional\)','due',t\.due,'date'\)/);
 assert.match(app,/selectField\('Duração estimada','minutes'/);
 const css=read('css/task-voice-v00321.css');
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/min-width:0/);
 assert.match(css,/#task-transcript/);
 assert.doesNotMatch(css,/user-scalable|touch-action|maximum-scale/);
});
test('versão V003.28 mantém o motor da Etapa 05, ícone, Web Push e backup',()=>{
 const html=read('index.html'),worker=read('service-worker.js'),app=read('js/app.js');
 assert.match(html,/MEU SÓCIO · V003\.28/);
 assert.match(worker,/socio-v00328-20261123/);
 for(const item of ['./js/task-voice.js','./css/task-voice-v00321.css','./js/time-aware.js','./js/agenda-task-links.js','./js/push.js'])assert.ok(worker.includes(item));
 assert.match(worker,/self\.addEventListener\('push'/);
 assert.match(worker,/self\.addEventListener\('notificationclick'/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
 assert.match(app,/selectTaskForTime\(rankTasks\(data,now\),data\.appointments\|\|\[\],now\)/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
});
