import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,useCard,cardOptions,roll,move,endTurn,globalIndex} from '../src/engine.js';
const game=()=>createState({rules:'skills',mode:'local',rng:()=>0});
const card=(s,kind,args)=>{s.players[s.current].hand=[kind];return useCard(s,0,args,()=>0);};
test('buff selects own unfinished outer-lane or hangar pieces and cannot stack',()=>{
 const s=game(),p=s.players[0];p.pieces=[-1,50,51,56];p.hand=['cruise'];
 assert.deepEqual(cardOptions(s,0).map(o=>o.args.piece),[0,1]);
 card(s,'cruise',{piece:0});assert.equal(p.cruise[0],true);assert.equal(card(s,'cruise',{piece:0}),null);
 roll(s,6);assert.equal(move(s,0).target,0);assert.equal(p.cruise[0],true);
});
test('buff persists across movements, applies to fixed dice, triple stacks and reverse moves',()=>{
 const s=game(),p=s.players[0];p.pieces[0]=3;card(s,'cruise',{piece:0});
 assert.equal(card(s,'dice',{piece:0,value:1}).movement.steps,2);assert.equal(p.pieces[0],5);
 p.triple=2;const r=card(s,'dice',{piece:0,value:2});assert.equal(r.movement.steps,36);assert.equal(p.pieces[0],41);
 assert.equal(p.triple,false);assert.equal(p.cruise[0],true);assert.equal(s.phase,'roll');
 assert.equal(card(s,'retreat',{target:0,piece:0}).movement.steps,8);assert.equal(p.pieces[0],33);
 roll(s,3);move(s,0);endTurn(s);assert.equal(s.current,1);
});
test('entry into home lane stops doubling immediately and bounce does not restore it',()=>{
 const s=game(),p=s.players[0];p.pieces[0]=49;p.cruise[0]=true;
 const r=card(s,'dice',{piece:0,value:4});assert.deepEqual(r.movement.route,[50,51,52,53,54]);assert.equal(p.cruise[0],false);
 p.pieces[0]=50;p.cruise[0]=true;p.triple=2;
 card(s,'dice',{piece:0,value:2});assert.equal(p.pieces[0],44);assert.equal(p.cruise[0],false);
});
test('shielded wall stops before home lane without clearing buff; destruction clears it',()=>{
 for(const shield of [false,true]){
  const s=game(),p=s.players[0];p.pieces[0]=49;p.cruise[0]=true;p.shields[0]=shield;s.barriers=[globalIndex(p,50)];
  const r=card(s,'dice',{piece:0,value:4});assert.equal(p.pieces[0],shield?50:-1);assert.equal(p.cruise[0],shield);assert.equal(r.movement.enteredHome,false);
 }
});
test('captures and missiles clear buff only when destruction succeeds',()=>{
 for(const kind of ['capture','missile'])for(const shield of [false,true]){
  const s=game(),p=s.players[0],enemy=s.players[1];enemy.pieces[0]=3;enemy.cruise[0]=true;enemy.shields[0]=shield;
  p.pieces[0]=kind==='capture'?15:16;
  if(kind==='capture'){roll(s,1);move(s,0);}else card(s,'missile',{piece:0});
  assert.equal(enemy.cruise[0],shield);assert.equal(enemy.pieces[0],shield?3:-1);
 }
});
