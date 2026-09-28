import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,useCard,roll,move,endTurn,globalIndex,cardOptions} from '../src/engine.js';
const game=()=>{const s=createState({rules:'skills',mode:'local',rng:()=>0});s.players[0].hand=['triple','dice'];s.players[0].pieces[0]=3;return s;};
test('triple plus fixed six moves eighteen without taking the normal turn or giving a bonus',()=>{
 const s=game();useCard(s,0,{});const r=useCard(s,0,{piece:0,value:6},()=>0);
 assert.equal(r.movement.steps,18);assert.equal(s.players[0].pieces[0],21);assert.equal(s.players[0].triple,false);
 assert.equal(s.phase,'roll');assert.equal(s.turn,1);assert.equal(s.current,0);
 roll(s,1);move(s,0);endTurn(s);assert.equal(s.current,1);
});
test('natural two tripled to six gives no bonus; natural six tripled to eighteen does',()=>{
 for(const die of [2,6]){
  const s=game();useCard(s,0,{});roll(s,die);assert.equal(move(s,0).steps,die*3);endTurn(s);
  assert.equal(s.current,die===6?0:1);
 }
});
test('triple stacks twice, rejects a third card and survives launching',()=>{
 const s=game();s.players[0].pieces=[-1,-1,-1,-1];s.players[0].hand=['triple','triple','triple'];
 useCard(s,0,{});useCard(s,0,{});assert.equal(s.players[0].triple,2);
 assert.deepEqual(cardOptions(s,0),[]);assert.equal(useCard(s,0,{}),null);assert.equal(s.players[0].hand.length,1);
 roll(s,6);assert.equal(move(s,9),null);move(s,0);assert.equal(s.players[0].triple,2);endTurn(s);
 roll(s,3);assert.equal(move(s,0).steps,27);assert.equal(s.players[0].triple,false);
});

test('two boosts apply to fixed dice without granting a bonus turn',()=>{
 const s=game();s.players[0].hand=['triple','triple','dice'];useCard(s,0,{});useCard(s,0,{});
 const r=useCard(s,0,{piece:0,value:6});assert.equal(r.movement.steps,54);
 assert.equal(s.players[0].triple,false);assert.equal(s.phase,'roll');assert.equal(s.current,0);assert.equal(s.turn,1);
});

test('two boosts retreat 36 steps using caster stacks and stop at launch',()=>{
 for(const from of [55,20]){
  const s=game();s.players[0].hand=['triple','triple','retreat'];s.players[1].pieces[0]=from;s.players[1].triple=2;
  useCard(s,0,{});useCard(s,0,{});const r=useCard(s,0,{target:1,piece:0});
  assert.equal(r.movement.steps,36);assert.equal(s.players[1].pieces[0],Math.max(0,from-36));
  assert.equal(s.players[0].triple,false);assert.equal(s.players[1].triple,2);
 }
});
test('roadblock destroys unshielded plane, compensates owner once and consumes boost and trap',()=>{
 const s=game();s.players[0].shields[0]=false;s.barriers=[globalIndex(s.players[0],5)];useCard(s,0,{});roll(s,4);
 const r=move(s,0,()=>0);assert.equal(r.target,-1);assert.deepEqual(r.route,[4,5]);assert.equal(r.destroyed,true);
 assert.equal(s.players[0].shields[0],false);assert.equal(s.players[0].stats.destroyed,1);assert.equal(s.players[0].hand.length,2);
 assert.equal(s.players[0].triple,false);assert.equal(s.barriers.length,0);
});

test('shield cancels roadblock once with no crash reward or destruction',()=>{
 const s=game();s.players[0].shields[0]=true;s.barriers=[globalIndex(s.players[0],5)];roll(s,4);
 const r=move(s,0,()=>0);assert.equal(r.target,5);assert.equal(r.barrierBlocked,true);assert.equal(r.destroyed,undefined);
 assert.equal(s.players[0].shields[0],false);assert.equal(s.players[0].stats.destroyed,0);assert.equal(s.players[0].hand.length,2);assert.equal(s.barriers.length,0);
});
