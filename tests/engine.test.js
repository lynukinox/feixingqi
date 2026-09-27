import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createState,roll,move,legalPieces,endTurn,previewMove,FINISH,RING,position,chooseAI,rotatePoint,tileColor,globalIndex} from '../src/engine.js';

test('board has 52 unique cells and each home route connects to its entry',()=>{
  assert.equal(RING.length,52);assert.equal(new Set(RING.map(String)).size,52);
  for(let id=0;id<4;id++){const a=position({id},50),b=position({id},51);assert.ok(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-93.7)<.01);}
});
test('every track, home and hangar position matches a printed circle in the actual board SVG',()=>{
  const svg=fs.readFileSync(new URL('../public/board.svg',import.meta.url),'utf8');
  const circles=[...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map(m=>rotatePoint([Number(m[1]),Number(m[2])],1));
  const points=[...RING];
  for(let id=0;id<4;id++){for(let p=51;p<=56;p++)points.push(position({id},p));for(let n=0;n<4;n++)points.push(position({id},-1,n));}
  for(const [x,y] of points)assert.ok(circles.some(([cx,cy])=>Math.hypot(x-cx,y-cy)<.04),`No board circle at ${x}, ${y}`);
});
test('launch pads are outside the shared track, and flights cross straight over 12 spaces',()=>{
  for(let id=0;id<4;id++){
    assert.ok(!RING.some(p=>String(p)===String(position({id},0))));
    const a=position({id},18),b=position({id},30);assert.ok(a[0]===b[0]||a[1]===b[1]);
    assert.equal(tileColor(globalIndex({id},18)),id);assert.equal(tileColor(globalIndex({id},30)),id);
    assert.equal(tileColor(globalIndex({id},2)),id);
  }
});
test('odd dice cannot launch; six launches and grants another turn',()=>{
  const s=createState();roll(s,3);assert.deepEqual(legalPieces(s),[]);endTurn(s);assert.equal(s.current,1);
  roll(s,6);assert.deepEqual(legalPieces(s),[0,1,2,3]);move(s,0);assert.equal(s.players[1].pieces[0],0);endTurn(s);assert.equal(s.current,1);assert.equal(s.phase,'roll');
});
test('invalid actions do not mutate state',()=>{
  const s=createState();assert.equal(move(s,0),null);assert.equal(roll(s,7),false);roll(s,3);assert.equal(roll(s,6),false);assert.equal(move(s,0),null);
});
test('same color jumps and a marked flight can follow a jump',()=>{
  assert.equal(previewMove(3,3).target,10);assert.equal(previewMove(13,1).target,30);assert.equal(previewMove(17,1).flight,true);assert.equal(previewMove(29,1).target,34);
});
test('finish is exact and overshoot bounces back',()=>{
  assert.equal(previewMove(53,3).target,FINISH);assert.equal(previewMove(54,5).target,53);assert.equal(previewMove(50,6).target,FINISH);
});
test('landing captures every enemy on square, but not own pieces or transit',()=>{
  const s=createState();s.players[0].pieces=[13,15,-1,-1];s.players[1].pieces=[2,2,1,-1];roll(s,2);const r=move(s,0);
  assert.equal(r.captured.length,2);assert.deepEqual(s.players[1].pieces,[-1,-1,1,-1]);assert.equal(s.players[0].pieces[1],15);
});
test('jump departure landing and final landing both capture',()=>{
  const s=createState();s.players[0].pieces[0]=17;s.players[1].pieces=[5,17,-1,-1];roll(s,1);const r=move(s,0);assert.equal(r.captured.length,2);assert.equal(r.target,34);
});
test('launching does not collide with the outer ring, and launch pads cannot be captured',()=>{
  const s=createState();s.players[1].pieces[0]=39;roll(s,6);assert.equal(move(s,0).captured.length,0);
  const t=createState();t.players[0].pieces[0]=12;t.players[1].pieces[0]=0;roll(t,1);assert.equal(move(t,0).captured.length,0);
});
test('home lanes do not capture and finished planes cannot move',()=>{
  const s=createState();s.players[0].pieces=[50,56,56,56];s.players[1].pieces[0]=38;roll(s,1);assert.deepEqual(legalPieces(s),[0]);move(s,0);assert.equal(s.players[1].pieces[0],38);
});
test('four finished planes win and turn stays on winner',()=>{
  const s=createState();s.players[0].pieces=[55,56,56,56];roll(s,1);move(s,0);assert.equal(s.phase,'won');assert.equal(s.winner,0);endTurn(s);assert.equal(s.current,0);
});
test('two players use opposite airports and local mode has no bots',()=>{
  const s=createState({count:2,mode:'local'});assert.deepEqual(s.players.map(p=>p.id),[0,2]);assert.ok(s.players.every(p=>!p.ai));
});
test('seeded full games terminate with legal states and AI choices',()=>{
  for(let seed=1;seed<=20;seed++) {
    let rng=seed;const next=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return 1+Math.floor(rng/4294967296*6);};
    const s=createState({count:seed%3+2});let turns=0;
    while(s.phase!=='won'&&turns++<10000){roll(s,next());const piece=chooseAI(s);if(piece!==undefined){assert.ok(legalPieces(s).includes(piece));move(s,piece);}endTurn(s);assert.ok(s.players.every(p=>p.pieces.every(v=>v>=-1&&v<=56)));}
    assert.equal(s.phase,'won',`seed ${seed} failed to terminate`);
  }
});


test('direct flight entry flies then jumps; jump into entry does not jump twice',()=>{
  assert.deepEqual(previewMove(17,1).route,[18,30,34]);
  assert.deepEqual(previewMove(13,1).route,[14,18,30]);
  for(let id=0;id<4;id++){
    const s=createState();s.current=id;s.players[id].pieces[0]=17;
    roll(s,1);assert.equal(move(s,0).target,34);
  }
});

test('flight chain captures each landing but not crossed cells; barriers stop either segment',()=>{
  const s=createState({rules:'skills',rng:()=>0});
  s.players[0].pieces[0]=17;s.players[1].pieces=[5,17,21,19];
  roll(s,1);assert.equal(move(s,0,()=>0).captured.length,3);
  assert.deepEqual(s.players[1].pieces,[-1,-1,-1,19]);
  for(const [cell,target] of [[18,-1],[30,-1],[34,-1],[32,34]]){
    const t=createState();t.players[0].pieces[0]=17;t.barriers=[globalIndex(t.players[0],cell)];
    roll(t,1);assert.equal(move(t,0).target,target);
    assert.equal(t.barriers.length,cell===32?1:0);
  }
});


test('two and four launch in classic and skills without an extra roll',()=>{
  for(const rules of ['classic','skills'])for(const value of [2,4]){
    const s=createState({rules});roll(s,value);assert.deepEqual(legalPieces(s),[0,1,2,3]);
    assert.equal(move(s,0).target,0);endTurn(s);assert.equal(s.current,1);
  }
});
