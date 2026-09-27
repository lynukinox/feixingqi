import {existsSync,readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';

// Persist outside dist: snapshots contain seat tokens and private hands.
export function loadRooms(path,ttl){
  if(!path||!existsSync(path))return [];
  const data=JSON.parse(readFileSync(path,'utf8'));
  if(data.version!==1||!Array.isArray(data.rooms))throw Error('房间存档格式无效，请保留文件并检查版本');
  return data.rooms.filter(r=>Date.now()-r.updated<ttl).map(r=>{
    if(!/^[0-9A-F]{6}$/.test(r.code)||!Array.isArray(r.members)||!r.members.length)throw Error('房间存档损坏');
    if(r.state)r.state.players.forEach(p=>p.stats??={captures:0,destroyed:0,cardsUsed:0});
    return {...r,event:null,timer:null,deadline:null,members:r.members.map(m=>({...m,socketId:null}))};
  });
}
export function saveRooms(path,rooms){
  if(!path)return;
  const data={version:1,rooms:[...rooms.values()].map(({timer,event,deadline,...r})=>({...r,members:r.members.map(m=>({...m,socketId:null}))}))};
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path+'.tmp',JSON.stringify(data),'utf8');
  renameSync(path+'.tmp',path);
}
