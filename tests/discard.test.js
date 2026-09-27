import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,drawCards,discardCard,roll,useCard} from '../src/engine.js';
test('full hand queues all draws; swap or reject incoming cards, then resume',()=>{
 const s=createState({mode:'local',rules:'skills',rng:()=>0}),p=s.players[0];p.hand=Array(5).fill('dice');
 drawCards(s,p,2,()=>3);assert.deepEqual(p.pendingCards,['shield','shield']);assert.equal(p.hand.length,5);
 assert.equal(roll(s,2),false);assert.equal(useCard(s,0,{value:6}),null);
 const before=structuredClone(s);assert.equal(discardCard(s,0,6),false);assert.deepEqual(s,before);
 assert.ok(discardCard(s,0,0));assert.equal(p.hand.at(-1),'shield');assert.equal(p.pendingCards.length,1);
 assert.ok(discardCard(s,0,5));assert.equal(p.pendingCards.length,0);assert.equal(p.hand.length,5);assert.ok(roll(s,2));
 assert.equal(discardCard(s,0,0),false);
});
test('voluntary discard is own roll only, grants no draw or use count',()=>{
 const s=createState({mode:'local',rules:'skills',rng:()=>0});
 assert.equal(discardCard(s,1,0),false);assert.ok(discardCard(s,0,0));
 assert.equal(s.players[0].hand.length,1);assert.equal(s.players[0].stats.cardsUsed,0);
});
