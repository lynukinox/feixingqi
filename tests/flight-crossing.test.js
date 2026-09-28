import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,roll,move,globalIndex} from '../src/engine.js';
test('all four flights capture stacked enemies on the intersected home cell only',()=>{
 for(let id=0;id<4;id++)for(const start of [13,17]){
  const s=createState({rules:'skills',mode:'local',rng:()=>0});s.current=id;
  const actor=s.players[id],enemy=s.players[(id+2)%4];actor.pieces[0]=start;enemy.pieces=[53,53,52,54];
  roll(s,1);const r=move(s,0,()=>0);
  assert.deepEqual(enemy.pieces,[-1,-1,52,54]);assert.equal(r.captured.length,2);assert.equal(actor.stats.captures,2);
  assert.equal(enemy.hand.length,4);assert.equal(r.target,start===13?30:34);
 }
});
test('shield blocks cross-line collision once without compensation',()=>{
 const s=createState({rules:'skills',mode:'local',rng:()=>0});s.players[0].pieces[0]=17;s.players[2].pieces[0]=53;s.players[2].shields[0]=true;
 roll(s,1);const r=move(s,0,()=>0);assert.equal(r.blocked.length,1);assert.equal(r.captured.length,0);
 assert.equal(s.players[2].pieces[0],53);assert.equal(s.players[2].shields[0],false);assert.equal(s.players[2].hand.length,2);
});
test('roadblock before flight prevents crossing; one at the far end does not undo crossing',()=>{
 for(const cell of [18,30]){
  const s=createState({rules:'skills',mode:'local',rng:()=>0});s.players[0].pieces[0]=17;s.players[2].pieces[0]=53;
  s.barriers=[globalIndex(s.players[0],cell)];roll(s,1);const r=move(s,0,()=>0);
  assert.equal(r.destroyed,true);assert.equal(s.players[2].pieces[0],cell===18?53:-1);
 }
});
