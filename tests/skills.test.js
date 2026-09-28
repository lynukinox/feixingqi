import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,roll,move,endTurn,useCard,cardOptions,drawCards,globalIndex,chooseAI,chooseAICard,CARD_KEYS,autoDiscard} from '../src/engine.js';

const fixed=()=>0;
const game=()=>createState({rules:'skills',mode:'local',rng:fixed});
function give(s,kind){s.players[s.current].hand=[kind];}
test('skills deal two; classic deals none; draws stop at five',()=>{
  const s=game();assert.ok(s.players.every(p=>p.hand.length===2));
  assert.ok(createState().players.every(p=>p.hand.length===0));
  drawCards(s,s.players[0],20,fixed);assert.equal(s.players[0].hand.length,5);
});
test('fixed movement is immediate, atomic, and leaves the ordinary roll available',()=>{
  const s=game();give(s,'dice');const before=structuredClone(s);
  for(const args of [{piece:0,value:7},{piece:0,value:1},{piece:9,value:6},null])assert.equal(useCard(s,0,args),null);
  assert.deepEqual(s,before);
  assert.ok(useCard(s,0,{piece:0,value:6}));assert.equal(s.players[0].pieces[0],0);
  assert.equal(s.phase,'roll');assert.equal(s.current,0);assert.equal(s.turn,1);assert.equal(s.round,1);assert.equal(s.die,null);
  s.players[0].hand=['double'];assert.ok(useCard(s,0,{}));roll(s,1);assert.equal(s.die,1);
  assert.equal(useCard(s,0,{}),null);move(s,0);endTurn(s);assert.equal(s.current,1);
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
  roll(t,2);const result=move(t,0,fixed);assert.equal(result.blocked.length,1);assert.equal(result.captured.length,0);assert.equal(result.target,14);
  assert.deepEqual(t.players[1].pieces,[2,2,-1,-1]);assert.equal(t.players[1].hand.length,2);assert.equal(t.players[1].shields[0],false);
});
test('barrier destroys on contact, consumes itself and cancels jumps; jump over a barrier is safe',()=>{
  const s=game();give(s,'barrier');s.players[0].pieces[0]=3;
  assert.ok(useCard(s,0,{cell:globalIndex(s.players[0],6)}));roll(s,5);
  const r=move(s,0);assert.equal(r.target,-1);assert.equal(r.destroyed,true);assert.equal(r.jump,false);assert.equal(s.barriers.length,0);
  const t=game();t.players[0].pieces[0]=13;t.barriers=[globalIndex(t.players[0],15)];roll(t,1);
  assert.equal(move(t,0).target,30);assert.equal(t.barriers.length,1);
  const u=game();u.players[0].pieces[0]=13;u.barriers=[globalIndex(u.players[0],18)];roll(u,1);
  assert.equal(move(u,0).target,-1);assert.equal(u.barriers.length,0);
});
test('roadblocks reject occupied cells; own planes also stop at them',()=>{
  const s=game();give(s,'barrier');s.players[1].pieces[0]=12;
  assert.equal(useCard(s,0,{cell:globalIndex(s.players[1],12)}),null);
  assert.equal(useCard(s,0,{cell:52}),null);assert.equal(s.players[0].hand.length,1);
});
test('missile hits all planes within three including friendly and wrap, but excludes launcher and safe lanes',()=>{
 const s=game();give(s,'missile');s.players[0].pieces=[1,2,5,51];s.players[1].pieces=[37,39,36,0];
 // Red center 0; yellow progress 37 -> global 49 (three behind), 36 is four behind.
 assert.ok(useCard(s,0,{piece:0},fixed));
 assert.deepEqual(s.players[0].pieces,[1,-1,5,51]);assert.deepEqual(s.players[1].pieces,[-1,-1,36,0]);
 assert.equal(s.players[0].stats.captures,2);assert.equal(s.players[0].stats.destroyed,1);
 assert.equal(s.players[0].hand.length,1);assert.equal(s.players[1].hand.length,4);
 const t=game();give(t,'missile');t.players[0].pieces[0]=1;t.players[1].pieces=[36,51,0,-1];
 assert.equal(cardOptions(t,0).length,0);assert.equal(useCard(t,0,{piece:0}),null);
});
test('shield blocks missile exactly once; shield cannot stack or target finished planes',()=>{
  const s=game();give(s,'shield');s.players[0].pieces=[1,56,-1,-1];
  assert.equal(useCard(s,0,{piece:1}),null);assert.ok(useCard(s,0,{piece:0}));
  s.skillUsed=false;give(s,'shield');assert.equal(useCard(s,0,{piece:0}),null);
  s.current=1;s.skillUsed=false;give(s,'missile');s.players[1].pieces[0]=37;
  const before=s.players[0].hand.length;assert.ok(useCard(s,0,{piece:0,target:0,targetPiece:0},fixed));
  assert.equal(s.players[0].pieces[0],1);assert.equal(s.players[0].hand.length,before);assert.equal(s.players[0].shields[0],false);
});
test('recycle consumes first, draws only two, clears shield, caps at five and rejects hangars',()=>{
  const s=game();s.players[0].hand=['recycle','dice','dice','dice','dice'];s.players[0].pieces[0]=20;s.players[0].shields[0]=true;
  assert.equal(useCard(s,0,{piece:1}),null);assert.ok(useCard(s,0,{piece:0},fixed));
  assert.equal(s.players[0].hand.length,5);assert.equal(s.players[0].pieces[0],-1);assert.equal(s.players[0].shields[0],false);
  const t=game();give(t,'recycle');t.players[0].pieces[0]=0;useCard(t,0,{piece:0},fixed);assert.equal(t.players[0].hand.length,2);
});
test('all-launch launches all or last one, does not roll or capture',()=>{
  const s=game();give(s,'double');useCard(s,0,{});assert.deepEqual(s.players[0].pieces,[0,0,0,0]);assert.equal(s.phase,'roll');
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
      s.players.forEach(p=>autoDiscard(s,p.id));
      const card=chooseAICard(s);if(card)assert.ok(useCard(s,card.index,card.args,rng));
      roll(s,rng(6)+1);const piece=chooseAI(s);if(piece!==undefined)move(s,piece,rng);endTurn(s,rng);
      assert.ok(s.players.every(p=>p.hand.length<=5&&p.hand.every(c=>CARD_KEYS.includes(c))&&p.pieces.every(v=>v>=-1&&v<=56)));
    }
    assert.equal(s.phase,'won',`seed ${seed}`);
  }
});


test('extra movements can chain and do not overwrite the natural die',()=>{
 const s=game();s.players[0].hand=['dice','dice','steal'];s.players[1].hand=['double'];
 useCard(s,0,{piece:0,value:6});useCard(s,0,{piece:0,value:2});
 assert.equal(s.players[0].pieces[0],6);assert.equal(s.turn,1);assert.equal(s.round,1);
 assert.ok(useCard(s,0,{target:1},fixed));assert.ok(useCard(s,0,{}));
 assert.equal(s.players[0].stats.cardsUsed,4);assert.equal(s.players[0].hand.length,0);
 roll(s,5);assert.equal(s.die,5);move(s,2);endTurn(s);assert.equal(s.current,1);
});
test('extra movement obeys roadblocks, arrival rewards and immediate victory',()=>{
 const s=game();give(s,'dice');s.players[0].pieces[0]=3;s.barriers=[globalIndex(s.players[0],5)];
 const r=useCard(s,0,{piece:0,value:6},fixed);assert.equal(r.movement.target,-1);assert.equal(s.phase,'roll');assert.equal(s.barriers.length,0);
 const t=game();give(t,'dice');t.players[0].pieces=[55,56,56,56];
 assert.ok(useCard(t,0,{piece:0,value:1},fixed));assert.equal(t.phase,'won');assert.equal(t.winner,0);assert.equal(t.turn,1);assert.equal(t.players[0].hand.length,1);
});
