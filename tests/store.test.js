import test from 'node:test';
import assert from 'node:assert/strict';
import {seedData} from '../js/logic.js';
import {validateData} from '../js/store.js';
test('backup V001 válido passa por normalização',()=>{const original=seedData(new Date('2026-11-19T12:00:00'));const restored=validateData(JSON.parse(JSON.stringify(original)));assert.equal(restored.businesses.length,5);assert.equal(restored.tasks.length,2);});
test('backup incompatível é rejeitado',()=>assert.throws(()=>validateData({version:2,businesses:[],tasks:[],events:[]})));
test('importação restringe valores e remove cores inválidas',()=>{const original=seedData();original.businesses[0].focus=500;original.businesses[0].color='red; background:url()';original.tasks[0].status='hacked';const clean=validateData(original);assert.equal(clean.businesses[0].focus,5);assert.equal(clean.businesses[0].color,'#DEB678');assert.equal(clean.tasks[0].status,'open');});
