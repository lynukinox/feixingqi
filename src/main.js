import './style.css';
import { createState, COLORS, NAMES, FINISH, roll, move, endTurn, legalPieces, chooseAI } from './engine.js';
import { mountBoard } from './board.js';
import { mountOnline, escapeHTML } from './online.js';
import './online.css';

const planeIcon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 2.5 7 7 4v3l-7-2v5l2.5 2v1l-5-1-5 1v-1l2.5-2v-5l-7 2v-3l7-4L12 2Z" fill="currentColor"/></svg>';
const app=document.querySelector('#app');
app.innerHTML=`
  <header class="header"><a class="brand" href="./"><span class="brand-icon">${planeIcon}</span><span>云端飞行棋<small>CLOUD HOP</small></span></a><div class="header-right"><span class="local-badge"><i></i> 本地畅玩</span><button class="icon-button" id="sound" title="开启音效" aria-label="开启音效">♫</button><button class="help-button" id="rules">玩法指南 <span>↗</span></button></div></header>
  <main><section class="intro"><div><div class="eyebrow"><span></span> A LITTLE FLIGHT, A LOT OF FUN</div><h1>快乐，即刻起飞<span>。</span></h1><p>掷出好运，穿过云端。和朋友来一场轻松的飞行棋吧。</p></div><div class="intro-tag"><span>✦</span> 每一程都有小惊喜</div></section>
  <div class="game-layout"><section class="board-panel"><div class="board-toolbar"><div><span class="live-dot"></span><strong>经典飞行棋盘</strong><span class="toolbar-divider"></span><span id="mode-label">人机对战 · 4 位飞行员</span></div><span class="round-label">回合 <b id="turn">01</b></span></div><div id="board" role="img" aria-label="飞行棋棋盘；可使用右侧飞机按钮操作"></div><div class="board-footer"><span>✧ <span id="board-tip">准备好了，就掷出第一颗骰子</span></span><span class="direction">↻ 顺时针飞行</span></div></section>
  <aside><section class="control-panel"><div class="section-label">FLIGHT CONTROL <span>✧</span></div><div class="turn-heading"><span class="player-avatar" id="active-avatar">${planeIcon}</span><div><h2 id="active-name">轮到你起飞</h2><p id="status">掷出 6 点，让飞机出发</p></div></div><div class="dice-area"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div id="dice" class="dice" role="img" aria-label="骰子：等待投掷"></div><span id="dice-caption">好运正在等你</span></div><button id="roll" class="primary-button">掷骰子 <span>↗</span></button><div class="keyboard-tip">按 <kbd>Space</kbd> 也可以掷骰子</div><div id="piece-actions" class="piece-actions" aria-label="选择移动的飞机"></div><div class="divider"></div><div class="players-title"><h3>飞行员名单</h3><span id="player-count">4 PLAYERS</span></div><div id="players"></div><button id="new-game" class="secondary-button"><span>↻</span> 开始新对局</button></section><section class="log-panel"><div class="players-title"><h3>飞行动态</h3><span class="log-dot"></span></div><div id="log" aria-live="polite"></div></section></aside></div>
  <section class="tips"><div><span class="tip-icon">⚄</span><div><h3>掷到 6，即可起飞</h3><p>还能获得一次额外投掷机会</p></div></div><div><span class="tip-icon">↗</span><div><h3>同色跳跃，快人一步</h3><p>落在同色格，向前跳 4 格</p></div></div><div><span class="tip-icon">⚑</span><div><h3>四架归航，赢得胜利</h3><p>让所有飞机率先抵达终点</p></div></div></section>
  <footer><span>${planeIcon} 小小棋盘，大大快乐。 <a href="/BOARD-LICENSE.txt" target="_blank" rel="noopener">棋盘图 © Mliu92 · CC BY-SA 4.0</a></span><span>用一点运气，换一段好时光 <span class="footer-star">✦</span></span></footer></main>
  <dialog id="setup-dialog"><form id="setup-form"><button type="button" class="close" aria-label="关闭">×</button><div class="modal-icon">${planeIcon}</div><div class="eyebrow">READY FOR TAKEOFF</div><h2>开启一段新航程</h2><p>选好飞行伙伴，下一站是快乐。</p><label>对战模式</label><div class="segmented"><label><input type="radio" name="mode" value="ai" checked/><span>人机对战<small>和电脑轻松玩</small></span></label><label><input type="radio" name="mode" value="local"/><span>朋友同屏<small>轮流操作，一起玩</small></span></label></div><label for="count">飞行员人数</label><select id="count" name="count"><option value="2">2 位飞行员</option><option value="3">3 位飞行员</option><option value="4" selected>4 位飞行员</option></select><p class="modal-note">开始新对局会重置当前棋盘。手机联网请点右上角「好友联机」。</p><button class="primary-button" type="submit">准备好了，出发 ↗</button></form></dialog>
  <dialog id="rules-dialog"><button class="close" aria-label="关闭">×</button><div class="eyebrow">HOW TO PLAY</div><h2>你的飞行小手册</h2><p>本局使用以下规则，2–4 位飞行员顺时针轮流行动。</p><ol class="rules-list"><li><b>起飞与连掷</b><span>掷出 6 点可将一架飞机放到独立起飞区，或移动航线上的飞机。掷出 6 点后再掷一次，连续次数不限。</span></li><li><b>移动与跳跃</b><span>点击发光的飞机，或右侧的编号按钮。落在同色外环格时前跳 4 格；起飞区不触发跳跃。</span></li><li><b>特别航线</b><span>落在自己颜色的 ✈ 格（离开起飞区后的第 18 格），可沿虚线飞跃 12 格；同色跳跃也可以衔接这段飞行。</span></li><li><b>撞机与叠机</b><span>落点上的对手飞机返回机场，包括跳跃前的落点和最终落点。经过的格子不撞机；己方飞机可叠放，仍单独移动。</span></li><li><b>精准归航</b><span>绕行后进入同色终点跑道。必须恰好到达中心「终」格；点数过多会向后退回剩余步数。四架全部归航即获胜。</span></li></ol><p class="modal-note">这是便于轻松游玩的统一规则版本；不包含叠机封路、跨线撞机与三次 6 点处罚。</p></dialog>
  <dialog id="win-dialog"><div class="win-art">✦</div><div class="eyebrow">ALL FLIGHTS ARRIVED</div><h2 id="win-title"></h2><p id="win-description"></p><button id="play-again" class="primary-button">再来一局 ↗</button></dialog>
  <div id="announcement" class="sr-only" aria-live="polite"></div>`;

const $=s=>document.querySelector(s);
let state=createState(),busy=false,generation=0,timer=null,sound=false,audio=null,online=null;
let logs=[{text:'欢迎来到云端，祝你一路好运！',color:'#7c8e7d'}];
const {scene}=mountBoard('board',selectPiece);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function beep(freq=520) {
  if(!sound) return;
  try { audio??=new (window.AudioContext||window.webkitAudioContext)(); audio.resume(); const osc=audio.createOscillator(),gain=audio.createGain(); osc.connect(gain);gain.connect(audio.destination);osc.frequency.value=freq;gain.gain.setValueAtTime(.045,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.15);osc.start();osc.stop(audio.currentTime+.15); } catch { /* Sound is optional. */ }
}
function drawDie(n=6) {
  const spots={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}[n];
  $('#dice').innerHTML=Array.from({length:9},(_,i)=>`<i class="${spots.includes(i)?'visible':''}"></i>`).join('');
  $('#dice').setAttribute('aria-label',`骰子：${n} 点`);
}
function log(text,id) { logs.unshift({text,color:COLORS[id]||'#7c8e7d'});logs=logs.slice(0,12); }
function render() {
  const player=state.players[state.current],available=legalPieces(state),human=!player.ai&&(!online?.room||online.canPlay());
  document.documentElement.style.setProperty('--active',COLORS[player.id]);
  $('#active-avatar').style.background=COLORS[player.id];
  $('#active-name').textContent=state.phase==='won'?'全部归航，漂亮！':human?(player.name==='你'?'轮到你起飞':`轮到${player.name}`):`${player.name} 正在飞行`;
  let status=state.phase==='won'?'本次航程已结束':busy?'飞机正在航线上飞行':state.phase==='choose'?(available.length?'选择一架飞机，继续航程':'暂时没有可以移动的飞机'):player.ai?'正在酝酿好运…':'掷出 6 点，让飞机出发';
  $('#status').textContent=status; $('#announcement').textContent=`${$('#active-name').textContent}，${status}`;
  $('#roll').disabled=busy||!human||state.phase!=='roll';
  $('#roll').innerHTML=state.phase==='won'?'航程圆满结束':busy?'飞行中…':player.ai?'等待电脑行动…':state.phase==='choose'?'请先选择飞机':'掷骰子 <span>↗</span>';
  $('#turn').textContent=String(state.turn).padStart(2,'0');
  $('#player-count').textContent=`${state.players.length} PLAYERS`;
  $('#mode-label').textContent=`${state.players.some(p=>p.ai)?'人机对战':'朋友同屏'} · ${state.players.length} 位飞行员`;
  $('#board-tip').textContent=state.phase==='choose'&&human&&available.length?'点击发光的飞机，或使用右侧编号按钮':state.phase==='won'?'所有航程，都值得庆祝':busy?'飞机出发啦，沿途风景正好':'准备好了，就掷出一颗幸运骰子';
  $('#players').innerHTML=state.players.map(p=>`<div class="player-row ${p.id===player.id?'current':''}" style="--player:${COLORS[p.id]}"><span class="small-avatar">${planeIcon}</span><div class="player-info"><strong>${escapeHTML(p.name)}${p.ai?'<span class="ai-badge">AI</span>':''}</strong><span>${NAMES[p.id]}${p.id===player.id?' · 当前回合':''}</span></div><div class="progress-dots" aria-label="${p.pieces.filter(v=>v===FINISH).length} 架已到达">${p.pieces.map(v=>`<i class="${v===FINISH?'arrived':v>=0?'flying':''}"></i>`).join('')}</div><span class="finish-count">${p.pieces.filter(v=>v===FINISH).length}<small>/4</small></span></div>`).join('');
  $('#piece-actions').innerHTML=human&&state.phase==='choose'&&!busy?available.map(i=>`<button data-piece="${i}">${planeIcon} ${i+1} 号${player.pieces[i]<0?'起飞':'移动'}</button>`).join(''):'';
  $('#piece-actions').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectPiece(Number(b.dataset.piece))));
  $('#log').innerHTML=logs.slice(0,4).map((l,i)=>`<div class="log-item ${i?'':'latest'}"><i style="background:${l.color}"></i><p>${escapeHTML(l.text)}</p><span>${i===0?'刚刚':''}</span></div>`).join('');
  $('#new-game').disabled=busy;
  const mine=online?.room?.state?state.players[online.room.members.findIndex(m=>m.id===online.memberId)]?.id:null;
  scene.sync(state,online?.room?(online.canPlay()?mine:-1):null);
  online?.decorate();
}
function scheduleAI() {
  clearTimeout(timer);
  if(!online?.room&&state.phase==='roll'&&state.players[state.current].ai) timer=setTimeout(throwDie,950);
}
async function throwDie() {
  if(online?.room){if(online.canPlay())await online.command('roll');return;}
  if(busy||state.phase!=='roll'||document.querySelector('dialog[open]')) return;
  const token=generation; busy=true;render();$('#dice').classList.add('rolling');
  for(let i=0;i<9;i++) {drawDie(1+Math.floor(Math.random()*6));beep(320+i*40);await delay(65);if(token!==generation)return;}
  const random=new Uint32Array(1);let value;
  do { crypto.getRandomValues(random);value=random[0]; } while(value>=4294967292);
  const n=1+value%6;roll(state,n);drawDie(n);$('#dice').classList.remove('rolling');
  $('#dice-caption').textContent=n===6?'是 6！好运加一程':`${n} 点，向快乐前进`;
  const player=state.players[state.current];log(`${player.name}掷出了 ${n} 点${n===6?'，可以额外掷一次':''}`,player.id);
  busy=false;render();
  if(!legalPieces(state).length) {busy=true;render();await delay(1100);if(token!==generation)return;log(`${player.name}等待起飞，下一位接棒`,player.id);endTurn(state);busy=false;render();scheduleAI();}
  else if(player.ai) {await delay(650);if(token!==generation)return;selectPiece(chooseAI(state));}
}
async function selectPiece(piece) {
  if(online?.room){if(online.canPlay())await online.command('move',{piece});return;}
  if(busy||state.phase!=='choose')return;
  const player=state.players[state.current],token=generation;
  if(!legalPieces(state).includes(piece))return;
  busy=true;
  // Keep pre-move token positions alive while the rules state advances.
  $('#roll').disabled=true;$('#new-game').disabled=true;$('#piece-actions').innerHTML='';
  const result=move(state,piece);
  await scene.animate(player,piece,result.route);if(token!==generation)return;
  beep(result.target===FINISH?880:640);
  let message=result.from<0?`${player.name}的 ${piece+1} 号飞机起飞啦`:`${player.name}的 ${piece+1} 号飞机前进 ${state.die} 格`;
  if(result.jump)message+='，同色跳跃';if(result.flight)message+='，飞越特别航线';if(result.captured.length)message+=`，撞回 ${result.captured.length} 架飞机`;if(result.target===FINISH)message+='，顺利归航！';
  log(message,player.id);
  if(state.phase==='won') {busy=false;render();$('#win-title').textContent=`${player.name==='你'?'你赢啦':player.name+'获胜'}！`;$('#win-description').textContent=`四架飞机全部归航，历经 ${state.turn} 个回合。下一次，也要一起飞。`;$('#win-dialog').showModal();return;}
  endTurn(state);busy=false;render();scheduleAI();
}
$('#roll').addEventListener('click',throwDie);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(!state.players[state.current].ai)throwDie();}});
$('#sound').addEventListener('click',()=>{sound=!sound;$('#sound').classList.toggle('sound-on',sound);$('#sound').title=sound?'关闭音效':'开启音效';$('#sound').setAttribute('aria-label',$('#sound').title);beep();});
function openDialog(id){clearTimeout(timer);$(id).showModal();}
$('#rules').addEventListener('click',()=>openDialog('#rules-dialog'));
$('#new-game').addEventListener('click',()=>openDialog('#setup-dialog'));
document.querySelectorAll('dialog').forEach(d=>{d.querySelector('.close')?.addEventListener('click',()=>d.close());d.addEventListener('close',scheduleAI);d.addEventListener('click',e=>{if(e.target===d&&d.id!=='win-dialog'){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});
$('#setup-form').addEventListener('submit',e=>{e.preventDefault();generation++;clearTimeout(timer);const data=new FormData(e.target);state=createState({mode:data.get('mode'),count:Number(data.get('count'))});busy=false;logs=[];log('新航程已开启，掷出你的第一份好运');$('#setup-dialog').close();drawDie();$('#dice-caption').textContent='好运正在等你';render();scheduleAI();});
$('#play-again').addEventListener('click',()=>{$('#win-dialog').close();if(online?.room)$('#room-card').scrollIntoView({behavior:'smooth'});else openDialog('#setup-dialog');});
drawDie();render();
online=mountOnline({
  apply(room){
    generation++;clearTimeout(timer);busy=false;$('#dice').classList.remove('rolling');
    state=room.state||createState({mode:'local',count:Math.max(2,room.members.length)});
    logs=room.logs.length?room.logs:[{text:'等待好友加入，房主可在至少两人在线时开始',color:'#7c8e7d'}];
    if(room.lastDie){drawDie(room.lastDie);$('#dice-caption').textContent=`${room.lastDie} 点 · 所有人同步`;}
    if(room.event?.kind==='roll')beep(520);
    if(room.state?.phase==='won'){
      const winner=state.players.find(p=>p.id===state.winner);$('#win-title').textContent=`${winner.name}获胜！`;$('#win-description').textContent='四架飞机全部归航！房主可在房间中再开一局。';
      if(!$('#win-dialog').open)$('#win-dialog').showModal();
    }else if($('#win-dialog').open)$('#win-dialog').close();
    render();
  },
  reset(){generation++;clearTimeout(timer);busy=false;state=createState();logs=[];$('#new-game').innerHTML='<span>↻</span> 开始新对局';$('.local-badge').textContent='本地畅玩';if($('#win-dialog').open)$('#win-dialog').close();drawDie();render();},
  refresh:render
});
