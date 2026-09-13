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
test('rooms enforce capacity, input validation and no late joins; explicit leave closes active game',async t=>{
  const {server,client}=await fixture(t);const clients=await Promise.all(Array.from({length:5},client));
  assert.equal((await call(clients[0],'create',{name:'<img onerror=x>'})).ok,false);
  const created=await call(clients[0],'create',{name:'玩家1'});const code=created.room.code;
  for(let i=1;i<4;i++)assert.equal((await call(clients[i],'join',{code,name:`玩家${i+1}`})).ok,true);
  assert.equal((await call(clients[4],'join',{code,name:'多余玩家'})).ok,false);
  await call(clients[0],'start',{revision:server.rooms.get(code).revision});
  assert.equal((await call(clients[4],'join',{code,name:'迟到'})).ok,false);
  await call(clients[1],'leave');assert.equal(server.rooms.has(code),false);
});
test('operation timeout advances a stalled game and resume rearms a fully disconnected room',async t=>{
  const {server,client}=await fixture(t,{rollDie:()=>1,turnMs:90});const a=await client(),b=await client();
  const created=await call(a,'create',{name:'甲'}),joined=await call(b,'join',{code:created.room.code,name:'乙'});const r=server.rooms.get(created.room.code);
  await call(a,'start',{revision:r.revision});await wait(115);assert.ok(r.state.turn>=2);
  a.disconnect();b.disconnect();await wait(30);assert.equal(r.timer,null);
  const c=await client();await call(c,'join',{code:r.code,token:joined.token});assert.ok(r.deadline>Date.now());
});
