import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createGameServer} from '../server/index.js';

async function fixture(t,options={}){
  const server=createGameServer(options),address=await server.listen(0),clients=[];
  t.after(async()=>{clients.forEach(c=>c.disconnect());await server.close();});
  async function client(){const c=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],forceNew:true});clients.push(c);await new Promise((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});c.on('room',r=>c.room=r);return c;}
  return {server,client,address};
}
const call=(socket,event,data={})=>new Promise(resolve=>socket.emit(event,data,resolve));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('skill rooms keep hands private, enforce ownership and revisions, restore on reconnect',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>1,cardRandom:()=>0});const a=await client(),b=await client();
  const created=await call(a,'create',{name:'甲',rules:'skills'});await call(b,'join',{code:created.room.code,name:'乙'});
  const r=server.rooms.get(created.room.code);await call(a,'start',{revision:r.revision});await wait(15);
  assert.deepEqual(a.room.state.players[0].hand,['dice','dice']);assert.deepEqual(a.room.state.players[1].hand,[null,null]);
  assert.deepEqual(b.room.state.players[0].hand,[null,null]);assert.deepEqual(b.room.state.players[1].hand,['dice','dice']);
  assert.equal((await call(b,'card',{revision:r.revision,index:0,args:{piece:0,value:6}})).ok,false);
  assert.equal((await call(a,'card',{revision:r.revision,index:0,args:{piece:0,value:9}})).ok,false);assert.equal(r.state.players[0].hand.length,2);
  const revision=r.revision;assert.equal((await call(a,'card',{revision,index:0,args:{piece:0,value:6}})).ok,true);
  assert.equal((await call(a,'card',{revision,index:0,args:{piece:0,value:6}})).ok,false);
  a.disconnect();await wait(10);const c=await client();const restored=await call(c,'join',{code:r.code,token:created.token});
  assert.deepEqual(restored.room.state.players[0].hand,['dice']);assert.equal(restored.room.state.players[0].pieces[0],0);assert.equal(restored.room.state.forcedDie,null);
  assert.deepEqual(restored.room.state.players[1].hand,[null,null]);
  await call(c,'roll',{revision:r.revision,die:2});assert.equal(r.state.die,1);
  assert.equal((await call(c,'card',{revision:r.revision,index:0,args:{piece:0,value:1}})).ok,false);
});
test('steal stays private in broadcasts and logs and leaves timeout deadline intact',async t=>{
  const {server,client}=await fixture(t,{cardRandom:()=>0});const a=await client(),b=await client();
  const made=await call(a,'create',{name:'甲',rules:'skills'});await call(b,'join',{name:'乙',code:made.room.code});
  const r=server.rooms.get(made.room.code);await call(a,'start',{revision:r.revision});
  r.state.players[0].hand=['steal'];r.state.players[1].hand=['missile','shield'];const deadline=r.deadline;
  assert.equal((await call(a,'card',{revision:r.revision,index:0,args:{target:2}})).ok,true);await wait(15);
  assert.equal(r.deadline,deadline);assert.deepEqual(a.room.state.players[0].hand,['missile']);
  assert.deepEqual(b.room.state.players[0].hand,[null]);assert.deepEqual(a.room.state.players[1].hand,[null]);
  assert.ok(!JSON.stringify(b.room.logs).includes('missile'));assert.deepEqual(b.room.state.players[1].hand,['shield']);
});
test('two devices synchronize; dice and turn ownership are authoritative; revisions reject duplicates',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>6});const a=await client(),b=await client();
  const created=await call(a,'create',{name:'小红'});const code=created.room.code;
  const joined=await call(b,'join',{code,name:'小蓝'});assert.equal(joined.ok,true);
  const r=server.rooms.get(code);assert.equal((await call(b,'start',{revision:r.revision})).ok,false);
  assert.equal((await call(a,'start',{revision:r.revision})).ok,true);
  assert.equal((await call(b,'roll',{revision:r.revision})).ok,false);
  const revision=r.revision;
  assert.equal((await call(a,'roll',{revision,die:1})).ok,true);assert.equal(r.state.die,6);
  assert.equal((await call(a,'roll',{revision})).ok,false);
  assert.equal((await call(a,'move',{revision:r.revision,piece:9})).ok,false);
  assert.equal((await call(a,'move',{revision:r.revision,piece:0})).ok,true);
  await wait(20);assert.deepEqual(a.room.state,b.room.state);assert.equal(b.room.state.players[0].pieces[0],0);
  assert.ok(!JSON.stringify(b.room).includes(created.token));
  assert.equal((await call(b,'join',{code,token:'fake',name:'冒名'})).ok,false);
});
test('refresh token restores a seat; lobby host transfers; rooms remain isolated',async t=>{
  const {server,client}=await fixture(t);const a=await client(),b=await client(),other=await client();
  const first=await call(a,'create',{name:'房主'});await call(b,'join',{code:first.room.code,name:'朋友'});
  const isolated=await call(other,'create',{name:'另一桌'});assert.equal(isolated.room.members.length,1);
  a.disconnect();await wait(20);const renewed=await client();const resumed=await call(renewed,'join',{code:first.room.code,token:first.token});
  assert.equal(resumed.memberId,first.memberId);assert.equal(resumed.room.members.length,2);
  await call(renewed,'leave');assert.equal(server.rooms.get(first.room.code).members[0].name,'朋友');
  assert.equal(server.rooms.get(isolated.room.code).members.length,1);
});
test('rooms enforce capacity, input validation and no late joins; explicit leave retains a bot seat',async t=>{
  const {server,client}=await fixture(t);const clients=await Promise.all(Array.from({length:5},client));
  assert.equal((await call(clients[0],'create',{name:'<img onerror=x>'})).ok,false);
  const created=await call(clients[0],'create',{name:'玩家1'});const code=created.room.code;
  for(let i=1;i<4;i++)assert.equal((await call(clients[i],'join',{code,name:`玩家${i+1}`})).ok,true);
  assert.equal((await call(clients[4],'join',{code,name:'多余玩家'})).ok,false);
  await call(clients[0],'start',{revision:server.rooms.get(code).revision});
  assert.equal((await call(clients[4],'join',{code,name:'迟到'})).ok,false);
  await call(clients[1],'leave');assert.equal(server.rooms.has(code),true);assert.equal(server.rooms.get(code).members[1].bot,true);
});
test('operation timeout advances a stalled game and resume rearms a fully disconnected room',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>1,turnMs:90});const a=await client(),b=await client();
  const created=await call(a,'create',{name:'甲'}),joined=await call(b,'join',{code:created.room.code,name:'乙'});const r=server.rooms.get(created.room.code);
  await call(a,'start',{revision:r.revision});await wait(115);assert.ok(r.state.turn>=2);
  a.disconnect();b.disconnect();await wait(30);assert.equal(r.timer,null);
  const c=await client();await call(c,'join',{code:r.code,token:joined.token});assert.ok(r.deadline>Date.now());
});

test('leaving host is replaced by a skill-using bot; ownership transfers, revoked token cannot reclaim and last human deletes room',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>1,cardRandom:()=>0,botDelayMs:15});const a=await client(),b=await client();
  const created=await call(a,'create',{name:'甲',rules:'skills'});const joined=await call(b,'join',{code:created.room.code,name:'乙'});
  const r=server.rooms.get(created.room.code);await call(a,'start',{revision:r.revision});
  r.state.players[0].hand=['double'];const before=r.state.players[0].pieces.slice();
  await call(a,'leave');assert.equal(r.members[0].bot,true);assert.equal(r.state.players[0].ai,true);assert.deepEqual(before,[-1,-1,-1,-1]);
  assert.equal((await call(a,'join',{code:r.code,token:created.token})).ok,false);
  for(let i=0;i<30&&r.state.current===0;i++)await wait(10);
  assert.equal(r.state.current,1);assert.equal(r.state.players[0].stats.cardsUsed,1);assert.ok(r.state.players[0].pieces.some(p=>p>0));
  assert.equal(b.room.host,joined.memberId);assert.ok(b.room.members[0].bot);assert.ok(b.room.state.players[0].hand.every(c=>c===null));
  r.state.phase='won';assert.equal((await call(b,'start',{revision:r.revision})).ok,true);assert.equal(r.state.players[0].ai,true);
  await call(b,'leave');assert.equal(server.rooms.has(r.code),false);
});
test('bot takes over a pending move without rerolling; non-current departure does not reset human deadline',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>6,botDelayMs:15});const a=await client(),b=await client();
  const created=await call(a,'create',{name:'甲'});await call(b,'join',{code:created.room.code,name:'乙'});const r=server.rooms.get(created.room.code);
  await call(a,'start',{revision:r.revision});await call(a,'roll',{revision:r.revision});
  await call(a,'leave');for(let i=0;i<20&&r.state.moves===0;i++)await wait(10);
  assert.ok(r.state.moves>0);assert.equal(r.state.players[0].pieces[0],0);
  await call(b,'leave');assert.equal(server.rooms.size,0);
  const c=await client(),d=await client();const next=await call(c,'create',{name:'丙'});await call(d,'join',{code:next.room.code,name:'丁'});
  const room=server.rooms.get(next.room.code);await call(c,'start',{revision:room.revision});const deadline=room.deadline;
  await call(d,'leave');assert.equal(room.deadline,deadline);assert.equal(room.state.current,0);
});

test('online player can move twice with cards and then take the normal turn',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>1,cardRandom:()=>0});const a=await client(),b=await client();
  const made=await call(a,'create',{name:'甲',rules:'skills'});await call(b,'join',{name:'乙',code:made.room.code});
  const r=server.rooms.get(made.room.code);await call(a,'start',{revision:r.revision});
  for(const value of [2,4])assert.equal((await call(a,'card',{revision:r.revision,index:0,args:{piece:0,value}})).ok,true);
  assert.equal(r.state.players[0].hand.length,0);
  assert.equal((await call(a,'roll',{revision:r.revision})).ok,true);assert.equal(r.state.die,1);
  assert.equal((await call(a,'move',{revision:r.revision,piece:0})).ok,true);
  assert.equal(r.state.players[0].pieces[0],5);assert.equal(r.state.current,1);
});

test('pending rewards are private; only owner may discard, including out of turn',async t=>{
 const {server,client}=await fixture(t,{cardRandom:()=>0});const a=await client(),b=await client();
 const made=await call(a,'create',{name:'甲',rules:'skills'});await call(b,'join',{name:'乙',code:made.room.code});
 const r=server.rooms.get(made.room.code);await call(a,'start',{revision:r.revision});
 r.state.players[1].hand=Array(5).fill('dice');r.state.players[1].pendingCards=['shield','missile'];
 assert.equal((await call(a,'discard',{revision:r.revision,index:5})).ok,false);
 assert.equal((await call(b,'discard',{revision:r.revision,index:0})).ok,true);await wait(10);
 assert.deepEqual(a.room.state.players[1].pendingCards,[null]);assert.deepEqual(b.room.state.players[1].pendingCards,['missile']);
 assert.equal(r.state.current,0);assert.equal(r.state.players[1].hand.at(-1),'shield');
 const rev=r.revision;assert.equal((await call(b,'discard',{revision:rev,index:5})).ok,true);
 assert.equal((await call(b,'discard',{revision:rev,index:0})).ok,false);
});
