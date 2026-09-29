import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,missileTargets,missileRange,useCard} from '../src/engine.js';
const game=()=>{const s=createState({rules:'skills',mode:'local',rng:()=>0});s.players[0].hand=['missile'];return s;};
test('missile reaches three cells down an enemy home lane and matches range preview',()=>{
 const s=game();s.players[0].pieces[0]=11;s.players[1].pieces=[51,52,53,54];
 assert.deepEqual(missileTargets(s,s.players[0],0),[0,1,2].map(piece=>({player:1,piece})));
 assert.deepEqual(missileRange(s,s.players[0],0).filter(c=>c.player===1).map(c=>c.progress),[51,52,53]);
 useCard(s,0,{piece:0},()=>0);assert.deepEqual(s.players[1].pieces,[-1,-1,-1,54]);assert.equal(s.players[0].pieces[0],11);
});
test('entry distance reduces home reach; friendly home planes and shields resolve normally',()=>{
 const s=game(),p=s.players[0];p.pieces=[49,51,52,53];p.shields[1]=true;
 useCard(s,0,{piece:0},()=>0);assert.deepEqual(p.pieces,[49,51,-1,53]);assert.equal(p.shields[1],false);assert.equal(p.stats.captures,0);assert.equal(p.stats.destroyed,1);
});
test('missile excludes completed planes, hangars, launch pads and distant lanes',()=>{
 const s=game();s.players[0].pieces[0]=11;s.players[1].pieces=[56,0,-1,54];
 assert.deepEqual(missileTargets(s,s.players[0],0),[]);assert.equal(useCard(s,0,{piece:0}),null);
});
