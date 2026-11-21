import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seedData} from '../js/logic.js';
import {validateData} from '../js/store.js';
import {normalizeAgendaDuration,agendaDurationLabel,agendaIntervalsConflict,agendaConflicts,suggestAgendaSlots} from '../js/agenda-scheduling.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ap=(id,date,time,durationMinutes=0,extra={})=>({id,title:id,date,time,durationMinutes,status:'open',...extra});
test('não atribui duração artificial a compromissos antigos e preserva dados no backup',()=>{
 const source=seedData(new Date(2026,10,21,11));
 source.appointments=[
   ap('retina','2026-11-23','19:00',0),
   ap('show','2026-11-24','20:00',90),
   {...ap('voz','2026-11-25','11:00'),durationMinutes:undefined}
 ];
 const before=source.station.songs.length;
 const clean=validateData(source);
 assert.deepEqual(clean.appointments.map(x=>x.durationMinutes),[0,90,0]);
 assert.deepEqual(validateData(clean).appointments,clean.appointments);
 assert.equal(clean.station.songs.length,before);
 assert.equal(normalizeAgendaDuration(120),120);
 assert.equal(normalizeAgendaDuration('75'),0);
 assert.equal(agendaDurationLabel(0),'Duração não informada');
 assert.equal(agendaDurationLabel(90),'1h30');
});
test('avisa quando dois períodos informados se sobrepõem, mas não quando um termina e outro começa',()=>{
 const first=ap('a','2026-11-23','14:00',60);
 assert.equal(agendaIntervalsConflict(first,ap('b','2026-11-23','14:30',30)),true);
 assert.equal(agendaIntervalsConflict(first,ap('c','2026-11-23','15:00',60)),false);
 assert.equal(agendaIntervalsConflict(first,ap('d','2026-11-23','13:30',60)),true);
});
test('sem duração não inventa fim; início conhecido dentro de período informado gera alerta',()=>{
 const unknown=ap('a','2026-11-23','14:00',0);
 assert.equal(agendaIntervalsConflict(unknown,ap('b','2026-11-23','14:30',0)),false);
 assert.equal(agendaIntervalsConflict(unknown,ap('b','2026-11-23','14:00',0)),true);
 assert.equal(agendaIntervalsConflict(unknown,ap('b','2026-11-23','13:30',60)),true);
 assert.equal(agendaIntervalsConflict(ap('b','2026-11-23','13:30',60),unknown),true);
 assert.equal(agendaIntervalsConflict(unknown,ap('b','2026-11-23','15:00',60)),false);
});
test('ao editar, ignora o próprio compromisso e não inclui compromissos concluídos',()=>{
 const a=ap('a','2026-11-23','14:00',60);
 const b=ap('b','2026-11-23','14:20',30);
 const done=ap('done','2026-11-23','14:10',60,{status:'done'});
 assert.deepEqual(agendaConflicts(a,[a,b,done],'a').map(x=>x.id),['b']);
 assert.deepEqual(agendaConflicts(done,[a,b],'done'),[]);
});
test('conflitos atravessam meia-noite e não tratam datas distintas como necessariamente livres',()=>{
 const late=ap('late','2026-11-23','23:30',90);
 const early=ap('early','2026-11-24','00:30',30);
 assert.equal(agendaIntervalsConflict(late,early),true);
 assert.equal(agendaIntervalsConflict(late,ap('later','2026-11-24','01:00',30)),false);
});
test('consulta horários livres sem criar compromisso, com intervalo e duração escolhidos',()=>{
 const events=[ap('ocupado','2026-11-23','10:00',60)];
 const now=new Date(2026,10,22,15);
 const snapshot=JSON.stringify(events);
 const free=suggestAgendaSlots(events,{date:'2026-11-23',from:'09:00',to:'12:00',durationMinutes:60},now);
 assert.deepEqual(free.map(s=>s.time),['09:00','11:00']);
 assert.deepEqual(free.map(s=>s.endsAt),['10:00','12:00']);
 assert.equal(JSON.stringify(events),snapshot);
});
test('consulta respeita horário inicial ocupado sem duração e não propõe horários passados',()=>{
 const now=new Date(2026,10,23,10,0);
 const events=[ap('sem-duration','2026-11-23','11:00',0)];
 const free=suggestAgendaSlots(events,{date:'2026-11-23',from:'09:00',to:'13:00',durationMinutes:60},now);
 assert.deepEqual(free.map(s=>s.time),['11:30','12:00']);
});
test('entrada inválida e faixa curta geram nenhuma sugestão',()=>{
 const now=new Date(2026,10,22,11);
 for(const req of [
  {date:'2026-02-30',from:'09:00',to:'18:00',durationMinutes:60},
  {date:'2026-11-23',from:'14:00',to:'13:00',durationMinutes:60},
  {date:'2026-11-23',from:'13:00',to:'13:30',durationMinutes:60},
  {date:'2026-11-23',from:'13:00',to:'13:30',durationMinutes:0},
 ])assert.deepEqual(suggestAgendaSlots([],req,now),[]);
});
test('captura de voz, seleção manual, alerta e botão de uso de horário estão conectados',()=>{
 const app=read('js/app.js');
 assert.match(app,/function agendaForm\(id='',voice=false,transcript='',audioUrl='',prefill=\{\}\)/);
 assert.match(app,/selectField\('Duração estimada \(opcional\)','durationMinutes'/);
 assert.match(app,/function agendaSlotsPanel\(\)/);
 assert.match(app,/case 'agenda-search-slots':/);
 assert.match(app,/case 'agenda-use-slot':agendaForm/);
 assert.match(app,/case 'agenda-find-toggle':/);
 assert.match(app,/const conflicts=agendaConflicts/);
 assert.match(app,/Deseja salvar mesmo assim\?/);
 assert.match(app,/function startAgendaVoice\(\)/);
 assert.match(app,/recognition\.lang='pt-BR'/);
});
test('PWA V003.13 preserva iPhone, aviso inferior branco, Web Push e ícone',()=>{
 const html=read('index.html'),worker=read('service-worker.js');
 assert.equal(JSON.parse(read('version.json')).version,'V003.13');
 assert.match(read('js/updater.js'),/APP_VERSION = 'V003\.13'/);
 assert.match(worker,/socio-v00313-20261121/);
 assert.match(worker,/'\.\/js\/agenda-scheduling\.js'/);
 assert.match(worker,/'\.\/css\/agenda-scheduling-v00312\.css'/);
 assert.match(html,/href="\.\/css\/agenda-scheduling-v00312\.css"/);
 assert.match(html,/href="\.\/css\/iphone-safe-area-v00311\.css"/);
 assert.match(read('css/theme-v0032.css'),/\.toast\{background:#24363d;color:#fff/);
 assert.match(worker,/self\.addEventListener\('push'/);
 assert.match(worker,/self\.addEventListener\('notificationclick'/);
 assert.match(read('js/store.js'),/socio\.v001\.data/);
 assert.match(read('js/push.js'),/socio\.v003\.push/);
 assert.match(html,/apple-touch-icon\.png\?v=0035/);
});

test('arquivos JavaScript principais passam na verificação de sintaxe do Node',async()=>{
 const {spawnSync}=await import('node:child_process');
 for(const file of ['js/app.js','js/store.js','js/agenda-scheduling.js','js/agenda-overview.js','js/push.js','js/updater.js','service-worker.js']){
   const run=spawnSync(process.execPath,['--check',file],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
   assert.equal(run.status,0,file+': '+run.stderr);
 }
});

test('consulta recalcula resultados conforme a agenda atualiza, sem referências circulares',()=>{
 const app=read('js/app.js');
 assert.match(app,/const slots=a\.results===null\?null:suggestAgendaSlots/);
 assert.doesNotMatch(app,/const slots=slots===null/);
 assert.match(app,/\$\{slots===null\?/);
});
