import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,roll,chooseAI,chooseAICard,globalIndex} from '../src/engine.js';

test('AI avoids unnecessary home-lane bounce and enters the safe home lane',()=>{
  const s=createState();s.players[0].pieces=[55,4,-1,-1];roll(s,3);assert.equal(chooseAI(s),1);
  const t=createState();t.players[0].pieces=[50,8,-1,-1];roll(t,1);assert.equal(chooseAI(t),0);
});
test('AI evaluates blocked routes instead of nominal dice distance',()=>{
  const s=createState({rules:'skills'});s.players[0].pieces=[40,10,-1,-1];
  s.barriers=[globalIndex(s.players[0],41)];roll(s,4);assert.equal(chooseAI(s),1);
});
test('AI changes its decision when shields remove next-roll collision risk',()=>{
  const s=createState();s.players[0].pieces=[10,12,-1,-1];s.players[1].pieces=[43,-1,-1,-1];roll(s,1);
  assert.equal(chooseAI(s),1);s.players[0].shields=[true,true,false,false];assert.equal(chooseAI(s),0);
});
test('AI chooses the winning fixed die and preserves advanced planes instead of recycling for cards',()=>{
  const s=createState({rules:'skills'});s.players[0].pieces=[55,56,56,56];s.players[0].hand=['dice'];
  assert.deepEqual(chooseAICard(s),{index:0,args:{value:1}});
  const t=createState({rules:'skills'});t.players[0].pieces=[50,51,53,55];t.players[0].hand=['recycle'];assert.equal(chooseAICard(t),null);
});
test('AI planning does not mutate live state or depend on opponents hidden card faces',()=>{
  const s=createState({rules:'skills'});s.players[0].hand=['steal','disrupt','dice'];s.players[0].pieces=[15,35,-1,-1];
  const before=structuredClone(s),choice=chooseAICard(s);assert.deepEqual(s,before);
  s.players.slice(1).forEach(p=>p.hand=p.hand.map(()=>null));assert.deepEqual(chooseAICard(s),choice);
  roll(s,6);const rolled=structuredClone(s);chooseAI(s);assert.deepEqual(s,rolled);
});
