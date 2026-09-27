import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomInt} from 'node:crypto';
import {Server} from 'socket.io';
import {loadRooms,saveRooms} from './room-store.js';
import {createState,roll,move,endTurn,legalPieces,chooseAI,chooseAICard,useCard,discardCard,autoDiscard,COLORS} from '../src/engine.js';

export function createGameServer({rollDie=()=>randomInt(1,7),turnMs=60000,cardRandom=max=>randomInt(max),storagePath=null,roomTtlMs=24*60*60*1000,botDelayMs=900}={}) {
  const rooms=new Map(loadRooms(storagePath,roomTtlMs).map(r=>[r.code,r])),root=resolve(fileURLToPath(new URL('../dist',import.meta.url)));
  let closing=false;
  const persist=()=>saveRooms(storagePath,rooms);
  const http=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    try {
      const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
      const file=resolve(root,'.'+(path==='/'?'/index.html':path));
      if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error();
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-store':'public, max-age=300'});
      res.end(req.method==='HEAD'?undefined:await readFile(file));
    }catch{res.writeHead(404);res.end('Not found');}
  });
  const io=new Server(http,{transports:['websocket'],maxHttpBufferSize:8192,serveClient:false,allowRequest:(req,done)=>{
    try{done(null,!req.headers.origin||new URL(req.headers.origin).host===req.headers.host);}catch{done(null,false);}
  }});
  const hostOf=r=>r.members.find(m=>!m.bot&&m.socketId)?.id??r.members.find(m=>!m.bot)?.id;
  function snapshot(r,memberId){
    const state=r.state?structuredClone(r.state):null;
    if(state)state.players.forEach((p,i)=>{if(r.members[i].id!==memberId){p.hand=p.hand.map(()=>null);p.pendingCards=(p.pendingCards||[]).map(()=>null);}});
    return {code:r.code,rules:r.rules,revision:r.revision,host:hostOf(r),status:r.state?'playing':'waiting',members:r.members.map(({id,name,socketId,bot},i)=>({id,name,bot:!!bot,connected:!!socketId,color:r.state?.players[i]?.id??i})),state,logs:r.logs,deadline:r.deadline,lastDie:r.lastDie,event:r.event};
  }
  function publish(r,event=null){
    r.revision++;r.event=event;r.updated=Date.now();persist();
    for(const m of r.members)if(m.socketId)io.to(m.socketId).emit('room',snapshot(r,m.id));
  }
  function log(r,text,id){r.logs.unshift({text,color:COLORS[id]||'#7c8e7d'});r.logs=r.logs.slice(0,12);}
  function arm(r){
    clearTimeout(r.timer);r.timer=null;r.deadline=null;
    if(!r.state||r.state.phase==='won'||!r.members.some(m=>m.socketId))return;
    const bot=!!r.members[r.state.current].bot,delay=bot?botDelayMs:turnMs;
    r.deadline=Date.now()+delay;
    r.timer=setTimeout(()=>{
      autoDiscard(r.state,r.state.players[r.state.current].id);
      if(bot&&r.state.phase==='roll'){
        const chosen=chooseAICard(r.state);
        if(chosen){const actor=r.state.players[r.state.current],result=useCard(r.state,chosen.index,chosen.args,cardRandom);
          if(result){log(r,result.text,actor.id);arm(r);publish(r,{kind:'card',card:result.kind,effects:result.effects});return;}}
      }
      if(!bot)log(r,'操作超时，系统代为完成本次行动');
      if(r.state.phase==='roll')doRoll(r);
      else doMove(r,chooseAI(r.state));
    },delay);r.timer.unref();
  }
  function doRoll(r){
    const actor=r.state.players[r.state.current],value=rollDie();roll(r.state,value);r.lastDie=value;
    log(r,`${actor.name}掷出了 ${value} 点`,actor.id);
    if(!legalPieces(r.state).length){log(r,`${actor.name}暂无可移动飞机，交给下一位`,actor.id);endTurn(r.state,cardRandom);}
    arm(r);publish(r,{kind:'roll',value});
  }
  function doMove(r,piece){
    const actor=r.state.players[r.state.current],result=move(r.state,piece,cardRandom);if(!result)throw Error('请选择可以移动的飞机');
    log(r,`${actor.name}的 ${piece+1} 号飞机${result.from<0?'起飞啦':'完成移动'}${result.flight?'，飞越特别航线':''}${result.captured.length?'，撞回对手飞机':''}${result.blocked.length?'，对手护盾抵挡撞击':''}${result.barrier!==undefined?'，碰到路障，飞机撞毁回机场':''}${result.target===56?'，抵达终点':''}`,actor.id);
    endTurn(r.state,cardRandom);arm(r);publish(r,{kind:'move',player:actor.id,piece,route:result.route,effects:result.effects});
  }
  io.on('connection',socket=>{
    let rateStart=Date.now(),requests=0;
    const getRoom=()=>rooms.get(socket.data.room);
    function handler(event,fn){socket.on(event,(data,ack)=>{
      if(typeof ack!=='function')return;
      try{
        if(Date.now()-rateStart>10000){rateStart=Date.now();requests=0;}
        if(++requests>35)throw Error('操作太频繁，请稍后再试');
        if(!data||typeof data!=='object'||Array.isArray(data))throw Error('请求无效');
        ack({ok:true,...fn(data)});
      }catch(e){ack({ok:false,error:e.message});}
    });}
    function join(r,m){
      if(m.socketId&&m.socketId!==socket.id){const old=io.sockets.sockets.get(m.socketId);if(old){old.data.room=null;old.leave(r.code);old.emit('replaced');}}
      m.socketId=socket.id;socket.data.room=r.code;socket.data.member=m.id;socket.join(r.code);
      if(r.state&&!r.timer)arm(r);publish(r);
      return {token:m.token,memberId:m.id,room:snapshot(r,m.id)};
    }
    function newMember(name){
      if(typeof name!=='string'||!name.trim()||name.trim().length>12||!/^[-\p{L}\p{N}_ .]+$/u.test(name.trim()))throw Error('昵称请用 1–12 个中英文字、数字或空格');
      return {id:randomBytes(8).toString('hex'),token:randomBytes(24).toString('hex'),name:name.trim(),socketId:null};
    }
    handler('create',({name,rules='classic'})=>{
      if(!['classic','skills'].includes(rules))throw Error('玩法无效');
      if(getRoom())throw Error('请先离开当前房间');if(rooms.size>=200)throw Error('房间已满，请稍后重试');
      const m=newMember(name);let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
      const r={code,rules,members:[m],state:null,revision:0,logs:[],updated:Date.now(),timer:null,deadline:null};rooms.set(code,r);return join(r,m);
    });
    handler('join',({code,name,token})=>{
      const r=rooms.get(typeof code==='string'?code.toUpperCase():'');if(!r)throw Error('房间不存在或已过期，请重新创建');
      if(getRoom()&&getRoom()!==r)throw Error('请先离开当前房间');
      const existing=typeof token==='string'?r.members.find(m=>m.token===token):null;
      if(existing){
        const wasBot=!!existing.bot;
        if(wasBot){existing.bot=false;const i=r.members.indexOf(existing);if(r.state)r.state.players[i].ai=false;log(r,`${existing.name}已重连，接回电脑代管的席位`,r.state?.players[i].id);}
        const result=join(r,existing);
        if(wasBot&&r.members[r.state.current]?.id===existing.id){arm(r);publish(r);return {...result,room:snapshot(r,existing.id)};}
        return result;
      }
      if(getRoom())throw Error('你已在房间中');if(r.state)throw Error('这局已经开始，请等待下一局');if(r.members.length>=4)throw Error('房间已满（最多 4 人）');
      const m=newMember(name);r.members.push(m);return join(r,m);
    });
    handler('start',({revision})=>{
      const r=getRoom();if(!r||hostOf(r)!==socket.data.member)throw Error('只有房主可以开始');
      if(revision!==r.revision)throw Error('房间状态已更新，请重试');
      if(r.state&&r.state.phase!=='won')throw Error('对局已经开始');
      if(r.members.length<2||r.members.some(m=>!m.bot&&!m.socketId))throw Error('至少需要 2 人，且所有成员均在线');
      r.state=createState({mode:'local',count:r.members.length,rules:r.rules,rng:cardRandom});r.state.players.forEach((p,i)=>{p.name=r.members[i].name;p.ai=!!r.members[i].bot;});r.logs=[];r.lastDie=null;
      log(r,'所有飞行员已就位，联网对局开始！');arm(r);publish(r,{kind:'start'});return {};
    });
    function authorize(revision,phase){
      const r=getRoom();if(!r?.state)throw Error('对局还未开始');
      if(r.revision!==revision)throw Error('棋盘已更新，请重新操作');
      if(r.members[r.state.current]?.bot||r.members[r.state.current]?.id!==socket.data.member)throw Error('还没轮到你');
      if(r.state.players[r.state.current].pendingCards?.length)throw Error('请先选择弃牌');
      if(r.state.phase!==phase)throw Error('当前不能执行这个操作');return r;
    }
    handler('discard',({revision,index})=>{
      const r=getRoom();if(!r?.state||r.revision!==revision)throw Error('棋盘已更新，请重新操作');
      const seat=r.members.findIndex(m=>m.id===socket.data.member&&!m.bot);
      if(seat<0||!discardCard(r.state,r.state.players[seat].id,index))throw Error('当前不能弃掉这张牌');
      log(r,'已完成弃牌选择',r.state.players[seat].id);publish(r,{kind:'discard'});return {};
    });
    handler('card',({revision,index,args})=>{
      const r=authorize(revision,'roll'),actor=r.state.players[r.state.current];
      const result=useCard(r.state,index,args,cardRandom);
      if(!result)throw Error('此卡当前不可用，请检查目标或等待下次行动');
      if(r.state.phase==='won')arm(r);
      log(r,result.text,actor.id);publish(r,{kind:'card',card:result.kind,effects:result.effects});return {};
    });
    handler('roll',({revision})=>{doRoll(authorize(revision,'roll'));return {};});
    handler('move',({revision,piece})=>{const r=authorize(revision,'choose');if(!Number.isInteger(piece))throw Error('飞机编号无效');doMove(r,piece);return {};});
    handler('leave',()=>{
      const r=getRoom();if(!r)return {};
      const index=r.members.findIndex(m=>m.id===socket.data.member),member=r.members[index];
      socket.leave(r.code);socket.data.room=null;socket.data.member=null;
      if(r.state){
        member.socketId=null;member.bot=true;
        r.state.players[index].ai=true;
        log(r,`${member.name}已离开，电脑接管其飞机与手牌`,r.state.players[index].id);
        if(r.members.every(m=>m.bot)){clearTimeout(r.timer);rooms.delete(r.code);}
        else{if(r.state.current===index||!r.members.some(m=>m.socketId))arm(r);publish(r,{kind:'takeover',player:r.state.players[index].id});}
      }else{
        r.members.splice(index,1);if(!r.members.length)rooms.delete(r.code);else publish(r);
      }
      persist();return {};
    });
    socket.on('disconnect',()=>{if(closing)return;const r=getRoom();if(!r)return;const m=r.members.find(m=>m.id===socket.data.member);if(m?.socketId===socket.id)m.socketId=null;
      if(!r.members.some(m=>m.socketId)){clearTimeout(r.timer);r.timer=null;r.deadline=null;}publish(r);
    });
  });
  const cleanup=setInterval(()=>{for(const [code,r]of rooms)if(!r.members.some(m=>m.socketId)&&Date.now()-r.updated>roomTtlMs){clearTimeout(r.timer);rooms.delete(code);persist();}},60000);cleanup.unref();
  return {http,io,rooms,listen:(port=3001,host='127.0.0.1')=>new Promise(resolve=>http.listen(port,host,()=>resolve(http.address()))),close:async()=>{closing=true;persist();clearInterval(cleanup);for(const r of rooms.values())clearTimeout(r.timer);await new Promise(resolve=>io.close(resolve));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createGameServer({storagePath:process.env.ROOM_STORE||resolve('data/rooms.json')});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
  const address=await server.listen(Number(process.env.PORT)||3001,process.env.HOST||'127.0.0.1');
  console.log(`Cloud Hop online: http://${address.address}:${address.port}`);
}
