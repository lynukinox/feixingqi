import {io} from 'socket.io-client';
import QRCode from 'qrcode';

export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountOnline({apply,reset,refresh}) {
  const $=s=>document.querySelector(s);
  const saved=()=>{try{return JSON.parse(sessionStorage.getItem('flight-room'));}catch{return null;}};
  const remember=data=>{try{if(data)sessionStorage.setItem('flight-room',JSON.stringify(data));else sessionStorage.removeItem('flight-room');}catch{}};
  let socket=null,room=null,memberId=null,pending=false,connected=false,leaving=false;
  $('.header-right').insertAdjacentHTML('afterbegin','<button id="online-open" class="online-open">好友联机 ↗</button>');
  $('.control-panel').insertAdjacentHTML('beforebegin','<section id="room-card" class="room-card" hidden></section>');
  document.body.insertAdjacentHTML('beforeend',`<dialog id="online-dialog"><button class="close" aria-label="关闭">×</button><div class="eyebrow">FLY TOGETHER, ANYWHERE</div><h2>和好友一起飞</h2><p>各用自己的手机，加入同一个房间。</p><label for="online-name">你的昵称</label><input id="online-name" maxlength="12" autocomplete="nickname" placeholder="输入昵称"/><label for="online-rules">新房间玩法</label><select id="online-rules"><option value="classic">经典模式</option><option value="skills">技能模式 · 8 种技能卡</option></select><button id="room-create" class="primary-button">创建好友房间</button><div class="online-or">或加入好友的房间</div><label for="room-code">6 位房间号</label><div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="例如 A2B3C4"/><button id="room-join" class="primary-button">加入</button></div><p id="online-error" class="online-error" role="status"></p><p class="modal-note">2–4 人实时对战。刷新会自动重连；每次操作限时 60 秒，超时由系统代走。</p></dialog><div id="online-toast" role="status" hidden></div>`);
  $('#online-name').value=`飞行员${Math.floor(Math.random()*900+100)}`;
  function message(text){$('#online-error').textContent=text;$('#online-toast').textContent=text;$('#online-toast').hidden=!text;clearTimeout(message.timer);message.timer=setTimeout(()=>{$('#online-toast').hidden=true;},5000);}
  function request(event,data){return new Promise((resolve,reject)=>{
    if(!socket?.connected)return reject(Error('网络未连接，正在重试，请稍后再试'));
    socket.timeout(8000).emit(event,data,(error,result)=>{if(error)reject(Error('连接超时，请等待重连后再试'));else if(!result?.ok)reject(Error(result?.error||'操作失败'));else resolve(result);});
  });}
  function update(next){room=next;leaving=false;apply(next,memberId);draw();}
  function connect(){
    if(socket)return;
    socket=io({transports:['websocket'],reconnection:true,reconnectionDelay:700,reconnectionDelayMax:4000,timeout:8000});
    socket.on('connect',async()=>{
      connected=true;const previous=saved();
      if(previous){try{const result=await request('join',previous);memberId=result.memberId;remember({...previous,token:result.token});update(result.room);}catch(e){remember(null);room=null;memberId=null;reset();message(e.message);}}
      draw();refresh();
    });
    socket.on('disconnect',()=>{connected=false;draw();refresh();});
    socket.on('connect_error',()=>{connected=false;draw();if($('#online-dialog').open)$('#online-error').textContent='暂时连接不上游戏服务，请稍后重试。';refresh();});
    socket.on('room',next=>{if(memberId&&(!room||next.code===room.code))update(next);});
    const closed=text=>{remember(null);room=null;memberId=null;reset();draw();message(text);};
    socket.on('closed',data=>closed(data.message));socket.on('replaced',()=>{socket.disconnect();closed('这个席位已在另一个页面登录');});
  }
  function draw(){
    document.body.classList.toggle('online-playing',!!room?.state);
    const card=$('#room-card');card.hidden=!room;
    $('#room-create').disabled=pending;$('#room-join').disabled=pending;
    if(!room)return;
    const host=room.host===memberId,waiting=!room.state,won=room.state?.phase==='won';
    card.innerHTML=`<div class="players-title"><h3>${room.rules==='skills'?'技能':'经典'}房间 <b>${room.code}</b></h3><span class="net-status">${connected?'● 已连接':'○ 重连中'}</span></div><div class="room-members">${room.members.map(m=>`<div><i style="background:${['#e7473f','#f4c534','#3289dc','#22a361'][m.color]}"></i><span>${escapeHTML(m.name)}${m.id===memberId?'（你）':''}</span><small>${m.id===room.host?'房主 · ':''}${m.bot?'电脑接管':m.connected?'在线':'离线'}</small></div>`).join('')}</div><p class="room-hint">${waiting?'把链接或房间号发给好友，至少 2 人即可开始。':won?'航程结束，房主可以再开一局。':'主动离开由电脑接管；网络中断仍可刷新重连。'}</p><div id="turn-clock"></div><div class="room-buttons"><button id="room-invite">邀请好友</button>${host&&(waiting||won)?`<button id="room-start" ${pending||!connected||room.members.length<2||room.members.some(m=>!m.bot&&!m.connected)?'disabled':''}>${won?'再开一局':'开始对局'}</button>`:''}<button id="room-leave">离开</button></div><div id="invite-details" hidden><input id="invite-link" readonly aria-label="好友邀请链接"/><canvas id="invite-qr" aria-label="扫码加入房间"></canvas><button id="copy-invite">复制邀请链接</button></div>`;
    $('#room-start')?.addEventListener('click',()=>command('start'));
    $('#room-leave').addEventListener('click',async()=>{
      if(!leaving){leaving=true;$('#room-leave').textContent=room.state?'确认离开，由电脑接管':'确认离开';return;}
      try{if(connected)await request('leave',{});remember(null);room=null;memberId=null;history.replaceState(null,'',location.pathname);reset();draw();}catch(e){message(e.message);}
    });
    $('#room-invite').addEventListener('click',async()=>{
      const link=new URL(location.href);link.search='';link.searchParams.set('room',room.code);link.hash='';
      $('#invite-details').hidden=false;$('#invite-link').value=link.href;
      await QRCode.toCanvas($('#invite-qr'),link.href,{width:150,margin:1,color:{dark:'#285e4d',light:'#ffffff'}});
    });
    $('#copy-invite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#invite-link').value);message('邀请链接已复制，发给好友即可');}catch{$('#invite-link').select();message('请长按上方链接复制');}});
    tick();
  }
  function tick(){const el=$('#turn-clock');if(el)el.textContent=room?.deadline?`本次操作剩余 ${Math.max(0,Math.ceil((room.deadline-Date.now())/1000))} 秒`:'';}
  setInterval(tick,1000);
  async function command(event,data={}){
    if(pending||!room||!connected)return;
    pending=true;draw();refresh();
    try{await request(event,{...data,revision:room.revision});}catch(e){message(e.message);}finally{pending=false;draw();refresh();}
  }
  async function enter(event){
    if(pending)return;connect();pending=true;draw();$('#online-error').textContent='正在连接…';
    try{
      if(!socket.connected)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off('connect',onConnect);reject(Error('无法连接游戏服务，请稍后重试'));},8500);function onConnect(){clearTimeout(timer);resolve();}socket.once('connect',onConnect);});
      const name=$('#online-name').value.trim(),code=$('#room-code').value.trim().toUpperCase();
      const result=await request(event,{name,code,rules:$('#online-rules').value});memberId=result.memberId;remember({code:result.room.code,token:result.token,name});
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());update(result.room);message('已进入房间，邀请好友一起玩吧');
    }catch(e){message(e.message);}finally{pending=false;draw();refresh();}
  }
  $('#online-open').addEventListener('click',()=>{if(room){$('#room-card').scrollIntoView({behavior:'smooth',block:'center'});return;}$('#online-dialog').showModal();connect();});
  $('#online-dialog .close').addEventListener('click',()=>$('#online-dialog').close());
  $('#room-create').addEventListener('click',()=>enter('create'));$('#room-join').addEventListener('click',()=>enter('join'));
  $('#room-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^0-9A-F]/g,'');});
  const api={get room(){return room;},get memberId(){return memberId;},get connected(){return connected;},canPlay(){return !!room?.state&&connected&&!pending&&room.members[room.state.current]?.id===memberId;},command,decorate(){
    if(!room)return;
    $('#new-game').disabled=true;$('#new-game').textContent='联网对局中 · 离开房间后可单机';
    $('.local-badge').textContent=connected?'● 好友联机':'○ 正在重连';
    $('#mode-label').textContent=`${room.rules==='skills'?'技能':'经典'} · 联网 ${room.code}`;
    if(!room.state){$('#roll').disabled=true;$('#roll').textContent='等待房主开始';$('#active-name').textContent='等待好友加入';$('#status').textContent=`房间号 ${room.code} · ${room.members.length}/4 人`;$('#piece-actions').innerHTML='';}
    else if(!connected){$('#roll').disabled=true;$('#roll').textContent='重连中…';$('#status').textContent='网络暂时中断，正在恢复对局';}
    else if(!api.canPlay()&&room.state.phase!=='won'){$('#roll').disabled=true;const bot=room.members[room.state.current]?.bot;$('#roll').textContent=pending?'同步中…':bot?'电脑正在行动…':'等待好友行动';$('#status').textContent=bot?'电脑已接管离开的玩家，正在思考':'轮到好友操作，请稍候';}
  }};
  const invite=new URLSearchParams(location.search).get('room');
  if(saved())connect();else if(invite){$('#room-code').value=invite.slice(0,6).toUpperCase();$('#online-dialog').showModal();connect();}
  return api;
}
