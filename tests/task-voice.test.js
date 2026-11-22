import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceTask} from '../js/task-voice.js';
const now=new Date(2026,10,22,12,0);
const businesses=[{id:'soundline',name:'SOUNDLINE'},{id:'studio',name:'Estúdio'},{id:'reizzor',name:'REIZZOR STATION'}];

test('interpreta título, negócio, prazo amanhã e duração explícita',()=>{
 const p=parseVoiceTask('Criar tarefa preparar orçamento SOUNDLINE amanhã, leva 30 minutos',businesses,now);
 assert.equal(p.businessId,'soundline');assert.equal(p.due,'2026-11-23');assert.equal(p.minutes,30);
 assert.match(p.title,/Preparar orçamento soundline/i);
});
test('interpreta daqui a dois dias e não assume horário',()=>{
 const p=parseVoiceTask('Anotar revisar contrato depois de amanhã',businesses,now);
 assert.equal(p.due,'2026-11-24');assert.equal(p.minutes,null);
});
test('interpreta data explícita que cruza ano',()=>{
 const p=parseVoiceTask('Cadastrar publicar anúncio dia 03/01',businesses,now);
 assert.equal(p.due,'2027-01-03');
});
test('não inventa datas inválidas',()=>{
 const p=parseVoiceTask('Tarefa testar dia 31/02',businesses,now);
 assert.equal(p.due,'');
});
test('tempo só é interpretado com termo de duração, não horário solto',()=>{
 const p=parseVoiceTask('Reunião com cliente às 14 horas',businesses,now);
 assert.equal(p.minutes,null);
});
test('interpreta uma hora e meia hora quando declaradas como esforço',()=>{
 assert.equal(parseVoiceTask('Relatório leva uma hora',businesses,now).minutes,60);
 assert.equal(parseVoiceTask('Vídeo leva meia hora',businesses,now).minutes,30);
});
test('não grava nem altera negócio quando nenhum foi mencionado',()=>{
 const original=JSON.stringify(businesses);
 const p=parseVoiceTask('Enviar orçamento',businesses,now);
 assert.equal(p.businessId,'');assert.equal(p.due,'');assert.equal(p.minutes,null);
 assert.equal(JSON.stringify(businesses),original);
});
test('texto vazio ou mal reconhecido permanece revisável',()=>{
 assert.equal(parseVoiceTask('',businesses,now).title,'');
 assert.ok(parseVoiceTask('Preciso',businesses,now).title.length===0);
});
