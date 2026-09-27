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
test('triple does not stack, survives launching and is consumed only on a legal move',()=>{
 const s=game();s.players[0].pieces=[-1,-1,-1,-1];s.players[0].hand=['triple','triple'];
 useCard(s,0,{});assert.deepEqual(cardOptions(s,0),[]);assert.equal(useCard(s,0,{}),null);
 roll(s,6);assert.equal(move(s,9),null);move(s,0);assert.equal(s.players[0].triple,true);endTurn(s);
 roll(s,3);assert.equal(move(s,0).steps,9);assert.equal(s.players[0].triple,false);
});
test('roadblock destroys shielded plane, compensates owner once and consumes boost and trap',()=>{
 const s=game();s.players[0].shields[0]=true;s.barriers=[globalIndex(s.players[0],5)];useCard(s,0,{});roll(s,4);
 const r=move(s,0,()=>0);assert.equal(r.target,-1);assert.deepEqual(r.route,[4,5]);assert.equal(r.destroyed,true);
 assert.equal(s.players[0].shields[0],false);assert.equal(s.players[0].stats.destroyed,1);assert.equal(s.players[0].hand.length,2);
 assert.equal(s.players[0].triple,false);assert.equal(s.barriers.length,0);
});
