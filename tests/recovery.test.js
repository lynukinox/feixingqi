import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {io} from 'socket.io-client';
import {createGameServer} from '../server/index.js';
import {createState,useCard,roll,move,drawCards,standings,autoDiscard} from '../src/engine.js';
import {loadRooms} from '../server/room-store.js';

test('reward notices record reasons and overflow without exposing card types; stats distinguish shields',()=>{
  const s=createState({rules:'skills',rng:()=>0}),p=s.players[0],enemy=s.players[1];
  p.hand=['missile'];p.pieces[0]=1;enemy.pieces[0]=37;enemy.shields[0]=true;
  useCard(s,0,{piece:0,target:1,targetPiece:0},()=>0);
  assert.equal(p.stats.cardsUsed,1);assert.equal(p.stats.captures,0);assert.equal(enemy.stats.destroyed,0);
  s.skillUsed=false;p.hand=['missile'];useCard(s,0,{piece:0,target:1,targetPiece:0},()=>0);
  assert.equal(p.stats.captures,1);assert.equal(enemy.stats.destroyed,1);assert.equal(s.notices.at(-1).reason,'撞毁补偿');
  p.hand=['dice','dice','dice','dice','dice'];drawCards(s,p,2,()=>0,'回收奖励');
  assert.equal(s.notices.at(-1).added,0);assert.equal(s.notices.at(-1).pending,2);
  assert.ok(!JSON.stringify(s.notices).includes('dice'));
  autoDiscard(s,p.id);p.pieces=[55,56,56,56];roll(s,1);move(s,0,()=>0);
  assert.equal(standings(s)[0].id,0);assert.equal(standings(s)[0].arrived,4);
});

test('restart restores room state, private hands and tokens without duplicate rewards or running offline clocks',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'flight-recovery-')),storagePath=join(folder,'rooms.json');
  let server;const clients=[];
  t.after(async()=>{clients.forEach(c=>c.disconnect());if(server)await server.close();assert.equal(dirname(resolve(folder)),resolve(tmpdir()));await rm(folder,{recursive:true,force:true});});
  const call=(c,event,data)=>new Promise(resolve=>c.emit(event,data,resolve));
  async function client(port){const c=io(`http://127.0.0.1:${port}`,{transports:['websocket'],forceNew:true,reconnection:false});clients.push(c);await new Promise((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});return c;}
  server=createGameServer({storagePath,cardRandom:()=>0,rollDie:()=>1});let address=await server.listen(0);
  const a=await client(address.port),b=await client(address.port);
  const made=await call(a,'create',{name:'甲',rules:'skills'}),joined=await call(b,'join',{code:made.room.code,name:'乙'});
  const r=server.rooms.get(made.room.code);await call(a,'start',{revision:r.revision});
  await call(a,'card',{revision:r.revision,index:0,args:{piece:0,value:6}});
  r.state.barriers=[20];r.state.players[0].shields[0]=true;
  const expected=structuredClone(r.state);await server.close();server=null;
  const disk=JSON.parse(await readFile(storagePath,'utf8'));assert.equal(disk.rooms[0].members[0].socketId,null);
  server=createGameServer({storagePath,rollDie:()=>1});address=await server.listen(0);
  const restored=server.rooms.get(made.room.code);assert.deepEqual(restored.state,expected);assert.equal(restored.timer,null);assert.equal(restored.deadline,null);
  const next=await client(address.port);const result=await call(next,'join',{code:made.room.code,token:made.token});
  assert.equal(result.ok,true);assert.deepEqual(result.room.state.players[0].hand,['dice']);assert.deepEqual(result.room.state.players[1].hand,[null,null]);
  assert.equal(result.room.state.noticeSeq,expected.noticeSeq);assert.equal(result.room.state.players[0].stats.cardsUsed,1);
  await call(next,'roll',{revision:restored.revision});assert.equal(restored.state.die,1);
  const other=await client(address.port);const otherResult=await call(other,'join',{code:made.room.code,token:joined.token});assert.equal(otherResult.ok,true);
  assert.equal((await call(other,'roll',{revision:restored.revision})).ok,false);
  await call(next,'leave',{});assert.equal(server.rooms.get(made.room.code).members[0].bot,true);await call(other,'leave',{});assert.equal(server.rooms.size,0);assert.equal(loadRooms(storagePath,86400000).length,0);
});
