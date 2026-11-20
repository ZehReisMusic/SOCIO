import test from 'node:test';
import assert from 'node:assert/strict';
import {seedData,htmlEscape,recommend} from '../js/logic.js';
import {validateData} from '../js/store.js';
import {STATION_STATUSES,renderStationContent} from '../js/reizzor-station.js';
import {pendingReminders} from '../js/push.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const base=()=>seedData(new Date('2026-11-20T12:00:00Z'));
const oneSong=()=>({
  id:'song-1',title:'Retina Azul',key:'Fm',bpm:143,tuning:'Drop C',status:'desenvolvimento',
  lyrics:'Verso 1\nRefrão 1',notes:'Arranjo de guitarras',createdAt:'2026-11-20T12:00:00Z',
  updatedAt:'2026-11-20T12:00:00Z',
  guides:[{id:'guide-1',label:'Guia vocal V2',url:'https://example.org/retina.mp3'}]
});
test('REIZZOR STATION nasce em Meus Negócios e não cria tarefas automaticamente',()=>{
  const data=base();
  assert.ok(data.businesses.some(b=>b.id==='b-reizzor'));
  assert.deepEqual(data.station.songs,[]);
  assert.equal(data.tasks.length,2);
  assert.equal(recommend(data).id,'t-mercadolivre');
});
test('backup V003 anterior ganha estação e mantém lembretes, agenda, tarefas e histórico',()=>{
  const old=base();old.businesses=old.businesses.filter(b=>b.id!=='b-reizzor');delete old.station;
  old.appointments=[{id:'a1',title:'Ensaio',date:'2026-11-21',time:'18:00',status:'open',source:'manual'}];
  old.skipped={date:'2026-11-20',taskIds:['t-mercadolivre']};
  old.events.push({id:'e-skip',businessId:'b-soundline',taskId:'t-mercadolivre',type:'adiamento',title:'Ação adiada',createdAt:'2026-11-20T12:00:00Z'});
  const migrated=validateData(old);
  assert.equal(migrated.businesses.length,6);
  assert.deepEqual(migrated.station.songs,[]);
  assert.equal(migrated.tasks.length,2);
  assert.equal(migrated.appointments[0].title,'Ensaio');
  assert.ok(migrated.events.some(x=>x.type==='adiamento'));
  assert.deepEqual(migrated.skipped.taskIds,['t-mercadolivre']);
});
test('migração repetida não duplica REIZZOR STATION',()=>{
  let data=base();delete data.station;data.businesses=data.businesses.filter(b=>b.id!=='b-reizzor');
  for(let i=0;i<4;i++)data=validateData(data);
  assert.equal(data.businesses.filter(b=>b.id==='b-reizzor').length,1);
});
test('deletar a frente da estação não causa recriação em backups já migrados',()=>{
  const data=base();
  data.businesses=data.businesses.filter(b=>b.id!=='b-reizzor');
  assert.equal(validateData(data).businesses.some(b=>b.id==='b-reizzor'),false);
});
test('backup JSON preserva letras, BPM, tom, afinação, status, notas e referência de áudio',()=>{
  const data=base();data.station.songs=[oneSong()];
  const clean=validateData(clone(data));
  assert.deepEqual(clean.station.songs[0],oneSong());
  assert.equal(clean.tasks.length,2);
  assert.equal(clean.events.length,1);
});
test('novos dados não apagam agenda nem alteram prioridade SOUNDLINE',()=>{
  const data=base();data.station.songs=[oneSong()];
  data.appointments=[{id:'a',title:'Reunião',date:'2026-11-21',time:'09:30',status:'open',source:'voz'}];
  const clean=validateData(data);
  assert.equal(clean.appointments.length,1);
  assert.equal(recommend(clean).id,'t-mercadolivre');
});
test('limita letras e notas e descarta músicas vazias',()=>{
  const data=base();
  data.station.songs=[{id:'x',title:'',lyrics:'não salvar'},{id:'ok',title:'Teste',lyrics:'X'.repeat(15000),notes:'Y'.repeat(5000)}];
  const s=validateData(data).station.songs;
  assert.equal(s.length,1);
  assert.equal(s[0].lyrics.length,12000);
  assert.equal(s[0].notes.length,4000);
});
test('status musical inválido volta a Ideia e BPM é normalizado',()=>{
  const data=base();data.station.songs=[{id:'a',title:'A',bpm:900,status:'hack'}];
  const s=validateData(data).station.songs[0];
  assert.equal(s.status,'ideia');
  assert.equal(s.bpm,300);
  assert.equal(STATION_STATUSES[s.status],'Ideia');
});
test('links inseguros são removidos da importação',()=>{
  const data=base();data.station.songs=[{id:'x',title:'Demo',guides:[
    {id:'g1',label:'JS',url:'javascript:alert(1)'},
    {id:'g2',label:'HTTP',url:'http://example.org/a.mp3'},
    {id:'g3',label:'Bom',url:'https://example.org/a.mp3'}
  ]}];
  assert.deepEqual(validateData(data).station.songs[0].guides.map(x=>x.id),['g3']);
});
test('interface escapa HTML injetado em título, letras e guia',()=>{
  const data=base();
  data.station.songs=[{...oneSong(),title:'<img src=x onerror=alert(1)>',lyrics:'<script>alert(1)</script>',
    guides:[{id:'g',label:'<svg onload=alert(1)>',url:'https://example.org/audio.mp3'}]}];
  const html=renderStationContent(data,'song-1',htmlEscape);
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;svg'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
});
test('estação vazia e seleção inexistente mostram a ação de cadastro',()=>{
  assert.match(renderStationContent(base(),'desconhecida',htmlEscape),/Nova música/);
});
test('links de guia são exibidos com proteção de nova aba',()=>{
  const data=base();data.station.songs=[oneSong()];
  const html=renderStationContent(data,'song-1',htmlEscape);
  assert.match(html,/rel="noopener noreferrer"/);
});
test('STATION não altera a programação das notificações',()=>{
  const data=base();
  const agora=new Date();
  const event=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate(),11,0);
  data.events.push({id:'e-t',type:'adiamento',taskId:'t-mercadolivre',createdAt:event.toISOString()});
  const initial=pendingReminders(data,'10:00');
  data.station.songs=[oneSong()];
  const after=pendingReminders(data,'10:00');
  assert.deepEqual(after,initial);
});
test('concluir tarefa retira seu lembrete e edição da estação não a reabre',()=>{
  const data=base();
  const today=new Date();const event=new Date(today.getFullYear(),today.getMonth(),today.getDate(),9,0);
  data.events.push({id:'e-t',type:'adiamento',taskId:'t-mercadolivre',createdAt:event.toISOString()});
  data.tasks[0].status='done';data.station.songs=[oneSong()];
  assert.deepEqual(pendingReminders(data,'10:00'),[]);
});
