import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,roll,move,globalIndex} from '../src/engine.js';
test('shield stops ordinary and jumping attackers one cell before defender',()=>{
 for(const [start,die,target] of [[13,2,15],[3,3,10]]){
 const s=createState({rules:'skills',mode:'local',rng:()=>0}),a=s.players[0],b=s.players[1];
 a.pieces[0]=start;b.pieces[0]=(globalIndex(a,target)-13+52)%52+1;b.shields[0]=true;
 roll(s,die);const r=move(s,0,()=>0);assert.equal(r.target,target-1);assert.equal(r.route.at(-1),target-1);
 assert.equal(r.captured.length,0);assert.equal(b.shields[0],false);assert.equal(b.hand.length,2);
 }
});
test('shield at flight entry cancels flight and preserves a later roadblock',()=>{
 const s=createState({rules:'skills',mode:'local',rng:()=>0});s.players[0].pieces[0]=17;s.players[1].pieces[0]=5;s.players[1].shields[0]=true;
 s.barriers=[globalIndex(s.players[0],30)];roll(s,1);const r=move(s,0,()=>0);
 assert.equal(r.target,17);assert.equal(r.flight,false);assert.equal(s.barriers.length,1);assert.equal(r.destroyed,undefined);
});
