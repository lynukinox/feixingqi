import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,roll,move,endTurn,useCard,cardOptions,drawCards,globalIndex,chooseAI,chooseAICard,CARD_KEYS} from '../src/engine.js';

const fixed=()=>0;
const game=()=>createState({rules:'skills',mode:'local',rng:fixed});
function give(s,kind){s.players[s.current].hand=[kind];}
test('skills deal two; classic deals none; draws stop at five',()=>{
  const s=game();assert.ok(s.players.every(p=>p.hand.length===2));
  assert.ok(createState().players.every(p=>p.hand.length===0));
  drawCards(s,s.players[0],20,fixed);assert.equal(s.players[0].hand.length,5);
});
test('one card per action; chosen six launches and gives extra roll; invalid actions are atomic',()=>{
  const s=game();give(s,'dice');const before=structuredClone(s);
  for(const args of [{value:7},{value:0},{value:'6'},null])assert.equal(useCard(s,0,args),null);
  assert.equal(useCard(s,-1,{value:6}),null);assert.deepEqual(s,before);
  assert.ok(useCard(s,0,{value:6}));s.players[0].hand.push('double');
  assert.equal(useCard(s,0,{}),null);roll(s,1);assert.equal(s.die,6);move(s,0);endTurn(s);
  assert.equal(s.current,0);assert.equal(s.round,1);assert.equal(s.forcedDie,null);
  assert.ok(useCard(s,0,{}));roll(s,2);assert.equal(s.die,2);
  const classic=createState();classic.players[0].hand=['dice'];assert.equal(useCard(classic,0,{value:6}),null);
});
test('five complete rounds, not five turns or bonus rolls, award all players',()=>{
  const s=game();
  for(let i=0;i<19;i++){roll(s,1);endTurn(s,fixed);}
  assert.equal(s.round,5);assert.equal(s.players[0].hand.length,2);
  roll(s,1);endTurn(s,fixed);assert.equal(s.round,6);assert.ok(s.players.every(p=>p.hand.length===3));
});
test('arrival and each destroyed plane grant cards, shields prevent destruction and reward',()=>{
  const s=game();s.players[0].pieces[0]=55;roll(s,1);move(s,0,fixed);assert.equal(s.players[0].hand.length,3);
  const t=game();t.players[0].pieces[0]=13;t.players[1].pieces=[2,2,-1,-1];t.players[1].shields[0]=true;
  roll(t,2);const result=move(t,0,fixed);assert.equal(result.blocked.length,1);assert.equal(result.captured.length,1);
  assert.deepEqual(t.players[1].pieces,[2,-1,-1,-1]);assert.equal(t.players[1].hand.length,3);assert.equal(t.players[1].shields[0],false);
});
test('barrier stops transit, consumes itself and cancels jumps; jump over a barrier is safe',()=>{
  const s=game();give(s,'barrier');s.players[0].pieces[0]=3;
  assert.ok(useCard(s,0,{cell:globalIndex(s.players[0],6)}));roll(s,5);
  const r=move(s,0);assert.equal(r.target,6);assert.equal(r.jump,false);assert.equal(s.barriers.length,0);
  const t=game();t.players[0].pieces[0]=13;t.barriers=[globalIndex(t.players[0],15)];roll(t,1);
  assert.equal(move(t,0).target,30);assert.equal(t.barriers.length,1);
  const u=game();u.players[0].pieces[0]=13;u.barriers=[globalIndex(u.players[0],18)];roll(u,1);
  assert.equal(move(u,0).target,18);assert.equal(u.barriers.length,0);
});
test('roadblocks reject occupied cells; own planes also stop at them',()=>{
  const s=game();give(s,'barrier');s.players[1].pieces[0]=12;
  assert.equal(useCard(s,0,{cell:globalIndex(s.players[1],12)}),null);
  assert.equal(useCard(s,0,{cell:52}),null);assert.equal(s.players[0].hand.length,1);
});
test('missiles allow either direction within five including wrap; no airport or home targets',()=>{
  const s=game();give(s,'missile');s.players[0].pieces[0]=1;s.players[1].pieces=[35,34,51,-1];
  // Enemy progress 35 => global 47, five steps behind global 0.
  assert.ok(useCard(s,0,{piece:0,target:1,targetPiece:0},fixed));assert.equal(s.players[1].pieces[0],-1);assert.equal(s.players[1].hand.length,3);
  const t=game();give(t,'missile');t.players[0].pieces[0]=1;t.players[1].pieces=[34,51,0,-1];
  assert.equal(cardOptions(t,0).length,0);assert.equal(useCard(t,0,{piece:0,target:1,targetPiece:1}),null);
});
test('shield blocks missile exactly once; shield cannot stack or target finished planes',()=>{
  const s=game();give(s,'shield');s.players[0].pieces=[1,56,-1,-1];
  assert.equal(useCard(s,0,{piece:1}),null);assert.ok(useCard(s,0,{piece:0}));
  s.skillUsed=false;give(s,'shield');assert.equal(useCard(s,0,{piece:0}),null);
  s.current=1;s.skillUsed=false;give(s,'missile');s.players[1].pieces[0]=35;
  const before=s.players[0].hand.length;assert.ok(useCard(s,0,{piece:0,target:0,targetPiece:0},fixed));
  assert.equal(s.players[0].pieces[0],1);assert.equal(s.players[0].hand.length,before);assert.equal(s.players[0].shields[0],false);
});
test('recycle consumes first, draws only two, clears shield, caps at five and rejects hangars',()=>{
  const s=game();s.players[0].hand=['recycle','dice','dice','dice','dice'];s.players[0].pieces[0]=20;s.players[0].shields[0]=true;
  assert.equal(useCard(s,0,{piece:1}),null);assert.ok(useCard(s,0,{piece:0},fixed));
  assert.equal(s.players[0].hand.length,5);assert.equal(s.players[0].pieces[0],-1);assert.equal(s.players[0].shields[0],false);
  const t=game();give(t,'recycle');t.players[0].pieces[0]=0;useCard(t,0,{piece:0},fixed);assert.equal(t.players[0].hand.length,2);
});
test('double launches two or last one, does not roll or capture',()=>{
  const s=game();give(s,'double');useCard(s,0,{});assert.deepEqual(s.players[0].pieces,[0,0,-1,-1]);assert.equal(s.phase,'roll');
  s.skillUsed=false;give(s,'double');s.players[0].pieces=[56,2,4,-1];useCard(s,0,{});assert.deepEqual(s.players[0].pieces,[56,2,4,0]);
  s.skillUsed=false;give(s,'double');assert.equal(useCard(s,0,{}),null);
});
test('steal and disrupt choose randomly, refuse self/empty targets, never exceed cap',()=>{
  const s=game();s.players[0].hand=['steal','dice','dice','dice','dice'];s.players[1].hand=['shield','missile'];
  assert.equal(useCard(s,0,{target:0}),null);assert.ok(useCard(s,0,{target:1},()=>1));
  assert.deepEqual(s.players[1].hand,['shield']);assert.equal(s.players[0].hand.at(-1),'missile');assert.equal(s.players[0].hand.length,5);
  s.skillUsed=false;give(s,'disrupt');useCard(s,0,{target:1},fixed);assert.equal(s.players[1].hand.length,0);
  s.skillUsed=false;give(s,'steal');assert.equal(useCard(s,0,{target:1}),null);
});
test('seeded skill games finish with legal positions and bounded hands',()=>{
  for(let seed=1;seed<=12;seed++){
    let n=seed;const rng=max=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n%max;};
    const s=createState({rules:'skills',count:seed%3+2,rng});let steps=0;
    while(s.phase!=='won'&&steps++<10000){
      const card=chooseAICard(s);if(card)assert.ok(useCard(s,card.index,card.args,rng));
      roll(s,rng(6)+1);const piece=chooseAI(s);if(piece!==undefined)move(s,piece,rng);endTurn(s,rng);
      assert.ok(s.players.every(p=>p.hand.length<=5&&p.hand.every(c=>CARD_KEYS.includes(c))&&p.pieces.every(v=>v>=-1&&v<=56)));
    }
    assert.equal(s.phase,'won',`seed ${seed}`);
  }
});
