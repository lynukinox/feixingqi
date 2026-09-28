import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,useCard,cardOptions,globalIndex} from '../src/engine.js';
const game=()=>{const s=createState({rules:'skills',mode:'local',rng:()=>0});s.players[0].hand=['retreat'];return s;};
test('enemy can retreat out of home lane, capture by its own colour, and preserve normal turn',()=>{
 const s=game();s.players[1].pieces[0]=53;s.players[2].pieces[0]=36;
 const r=useCard(s,0,{target:1,piece:0},()=>0);
 assert.equal(s.players[1].pieces[0],49);assert.equal(s.players[2].pieces[0],-1);
 assert.equal(r.movement.captured.length,1);assert.equal(s.players[1].stats.captures,1);assert.equal(s.current,0);assert.equal(s.phase,'roll');assert.equal(s.turn,1);
});
test('triple retreat consumes caster buff only, then jumps backwards four',()=>{
 const s=game();s.players[0].triple=true;s.players[1].triple=true;s.players[1].pieces[0]=54;
 const r=useCard(s,0,{target:1,piece:0},()=>0);assert.equal(r.movement.steps,12);assert.equal(s.players[1].pieces[0],38);
 assert.equal(s.players[0].triple,false);assert.equal(s.players[1].triple,true);assert.equal(r.movement.jump,true);
});

test('reverse flight captures its landings and the intersected home lane',()=>{
 const s=game();s.players[0].pieces[0]=34;s.players[1].pieces=[17,5,1,-1];s.players[2].pieces[0]=53;
 const r=useCard(s,0,{target:0,piece:0},()=>0);
 assert.deepEqual(r.movement.route,[33,32,31,30,18,14]);
 assert.equal(r.movement.flight,true);assert.equal(r.movement.captured.length,4);
 assert.equal(s.players[0].pieces[0],14);
});

test('reverse colour jump into flight stops at its other end',()=>{
 const s=game();s.players[0].pieces[0]=38;
 const r=useCard(s,0,{target:0,piece:0},()=>0);
 assert.deepEqual(r.movement.route,[37,36,35,34,30,18]);assert.equal(s.players[0].pieces[0],18);
});

test('barriers and shields interrupt reverse flight before crossing',()=>{
 for(const defense of ['barrier','shield']){
  const s=game();s.players[0].pieces[0]=34;s.players[2].pieces[0]=53;
  if(defense==='barrier')s.barriers.push(globalIndex(s.players[0],30));
  else {s.players[1].pieces[0]=17;s.players[1].shields[0]=true;}
  const r=useCard(s,0,{target:0,piece:0},()=>0);
  assert.equal(s.players[2].pieces[0],53);assert.equal(r.movement.flight,false);
  assert.equal(s.players[0].pieces[0],defense==='barrier'?-1:31);
 }
});
test('retreat stops at launch pad and excludes finished, hangar and launch planes',()=>{
 const s=game();s.players[0].pieces=[2,56,0,-1];assert.equal(cardOptions(s,0).length,1);
 useCard(s,0,{target:0,piece:0},()=>0);assert.equal(s.players[0].pieces[0],0);
});
test('retreat shield collision stops one cell before target in reverse travel direction',()=>{
 const s=game();s.players[0].pieces[0]=20;s.players[1].pieces[0]=3;s.players[1].shields[0]=true;
 const r=useCard(s,0,{target:0,piece:0},()=>0);assert.equal(r.movement.target,17);assert.equal(s.players[1].shields[0],false);assert.equal(r.movement.captured.length,0);
});
