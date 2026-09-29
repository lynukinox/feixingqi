import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,allies,roll,move,endTurn,useCard,cardOptions,teamName} from '../src/engine.js';
const game=()=>createState({rules:'skills2v2',mode:'local',count:2,rng:()=>0});
test('2v2 fixes four diagonal seats and retains individual turn order and six bonus',()=>{
 const s=game();assert.equal(s.rules,'skills');assert.equal(s.teamMode,true);assert.deepEqual(s.players.map(p=>p.id),[0,1,2,3]);assert.ok(allies(s,0,2));assert.ok(allies(s,1,3));assert.ok(!allies(s,0,1));
 roll(s,6);move(s,0);endTurn(s);assert.equal(s.current,0);
 for(let i=0;i<4;i++){assert.equal(s.current,i);roll(s,1);if(i===0)move(s,0);endTurn(s);}assert.equal(s.current,0);
});
test('teammates do not collide or consume shields, including flight crossing',()=>{
 const s=game();s.players[0].pieces[0]=28;s.players[2].pieces[0]=3;s.players[2].shields[0]=true;roll(s,1);move(s,0);
 assert.equal(s.players[0].pieces[0],29);assert.equal(s.players[2].pieces[0],3);assert.equal(s.players[2].shields[0],true);
 const t=game();t.players[0].pieces[0]=17;t.players[2].pieces[0]=53;roll(t,1);move(t,0);assert.equal(t.players[2].pieces[0],53);
 const classic=createState({mode:'local',rules:'skills',rng:()=>0});classic.players[0].pieces[0]=28;classic.players[2].pieces[0]=3;roll(classic,1);move(classic,0);assert.equal(classic.players[2].pieces[0],-1);
});
test('enemy-only cards exclude teammates; missiles keep friendly fire without kill credit',()=>{
 const s=game();for(const kind of ['steal','disrupt']){s.players[0].hand=[kind];assert.deepEqual(cardOptions(s,0).map(o=>o.args.target),[1,3]);assert.equal(useCard(s,0,{target:2}),null);}
 s.players[0].hand=['missile'];s.players[0].pieces[0]=29;s.players[2].pieces[0]=3;useCard(s,0,{piece:0});assert.equal(s.players[2].pieces[0],-1);assert.equal(s.players[0].stats.captures,0);
});
test('one teammate finishing all four wins for that diagonal team',()=>{
 const s=game();s.current=2;s.players[2].pieces=[56,56,56,55];roll(s,1);move(s,3);assert.equal(s.phase,'won');assert.equal(s.winner,2);assert.equal(teamName(s.winner),'红蓝队');assert.ok(s.players[0].pieces.every(v=>v===-1));
});
