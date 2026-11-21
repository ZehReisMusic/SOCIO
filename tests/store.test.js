import test from 'node:test';
import assert from 'node:assert/strict';
import {seedData} from '../js/logic.js';
import {validateData} from '../js/store.js';
test('backup V001 válido passa por normalização',()=>{const original=seedData(new Date('2026-11-19T12:00:00'));const restored=validateData(JSON.parse(JSON.stringify(original)));assert.equal(restored.businesses.length,6);assert.deepEqual(restored.station.songs,[]);assert.equal(restored.tasks.length,2);});
test('backup incompatível é rejeitado',()=>assert.throws(()=>validateData({version:2,businesses:[],tasks:[],events:[]})));
test('importação restringe valores e remove cores inválidas',()=>{const original=seedData();original.businesses[0].focus=500;original.businesses[0].color='red; background:url()';original.tasks[0].status='hacked';const clean=validateData(original);assert.equal(clean.businesses[0].focus,5);assert.equal(clean.businesses[0].color,'#DEB678');assert.equal(clean.tasks[0].status,'open');});

test('backup antigo ganha REIZZOR STATION sem apagar negócios ou tarefas',()=>{
  const old=seedData(new Date('2026-11-19T12:00:00'));
  delete old.station;old.businesses=old.businesses.filter(b=>b.id!=='b-reizzor');
  const migrated=validateData(old);
  assert.equal(migrated.businesses.length,6);
  assert.equal(migrated.tasks.length,2);
  assert.deepEqual(migrated.station.songs,[]);
});
test('músicas preservadas e links não HTTPS descartados na importação',()=>{
  const data=seedData();
  data.station.songs=[{id:'song-1',title:'Retina Azul',lyrics:'Primeiro verso',notes:'Guia',guides:[{id:'g1',label:'Demo',url:'https://example.com/demo.mp3'},{id:'g2',label:'Inválido',url:'javascript:alert(1)'}]}];
  const clean=validateData(data);
  assert.equal(clean.station.songs.length,1);
  assert.equal(clean.station.songs[0].guides.length,1);
  assert.equal(clean.station.songs[0].lyrics,'Primeiro verso');
});
test('reabrir backup com estação não recria negócio que foi removido',()=>{
  const data=seedData();data.businesses=data.businesses.filter(b=>b.id!=='b-reizzor');
  const clean=validateData(data);
  assert.equal(clean.businesses.some(b=>b.id==='b-reizzor'),false);
});

test('vínculos de compromissos com tarefas persistem nos backups e referências inválidas são limpas',()=>{
  const data=seedData();
  const known=data.tasks[0].id;
  data.appointments=[
    {id:'a-1',title:'Reunião',date:'2026-11-25',time:'15:00',notes:'',taskId:known,status:'open'},
    {id:'a-2',title:'Consulta',date:'2026-11-26',time:'09:00',notes:'',taskId:'t-nao-existe',status:'open'}];
  const clean=validateData(data);
  assert.equal(clean.appointments[0].taskId,known);
  assert.equal(clean.appointments[1].taskId,'');
  assert.deepEqual(clean.appointments,validateData(clean).appointments);
});
