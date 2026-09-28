export const COLORS = ['#e7473f', '#f4c534', '#3289dc', '#22a361'];
export const NAMES = ['红方', '黄方', '蓝方', '绿方'];
export const FINISH = 56;
export function rotatePoint([x,y], turns) {
  for(let i=0;i<turns;i++) [x,y]=[950-y,x];
  return [Number(x.toFixed(2)),Number(y.toFixed(2))];
}
// Coordinates use the actual 950 × 950 board, including both halves of each inner bend.
const QUARTER = [
  [123.48,323.48],[175,300],[225,300],[278.7,319.29],[319.29,278.7],
  [300,225],[300,175],[323.48,123.48],[375,100],[425,100],[475,85],[525,100],[575,100]
];
export const RING = Array.from({length:4},(_,id)=>QUARTER.map(p=>rotatePoint(p,id))).flat();
export const tileColor = index => (index+3)%4;
export const CARDS = {
  dice: {name:'定点骰子',icon:'⚄',description:'选择一架飞机立即执行 1–6 点的额外移动；2、4、6 点可起飞，不消耗正常掷骰，6 点不额外连掷。'},
  barrier: {name:'城墙',icon:'⊥',description:'在公共航道空格放置城墙。经过或落在该格的第一架飞机立即撞毁回机场，城墙消失；护盾可抵挡一次并停在该格，跳飞跨过不触发。'},
  missile: {name:'爆爆爆',icon:'➶',description:'选择己方公共航道飞机，击毁前后 3 格内所有其他飞机，包括友机和同格飞机；发射飞机不受影响，护盾可抵挡。'},
  shield: {name:'护盾',icon:'◇',description:'保护一架已起飞的己方飞机，抵挡一次撞机、爆爆爆或城墙；抵挡撞机时敌机停在目标格前一格，不触发追加跳跃或撞机；每架最多一个。'},
  disrupt: {name:'过河拆桥',icon:'ϟ',description:'指定一名有手牌的对手，随机弃掉对方一张卡。'},
  recycle: {name:'他就堵了',icon:'↶',description:'撤回一架已起飞、未归航的己方飞机，抽两张卡；不算撞毁。'},
  double: {name:'一起起飞',icon:'⇈',description:'机场内所有飞机直接起飞，进入起飞区；随后照常出牌、掷骰。'},
  triple: {name:'强行顶',icon:'×3',description:'下一次实际移动的骰点步数乘 3，可配合定点骰子；最多叠加两张（×3、×9），移动一次消耗全部加成，起飞不消耗，跳跃距离不翻倍。仅正常掷出 6 点奖励连掷。'},
  retreat: {name:'退退退退',icon:'↤',description:'指定己方或敌方一架已进入航道、未归航的飞机倒退 4 格；可消耗自己的一层或两层强行顶变为 12 或 36 格。落点正常撞机，护盾与城墙生效；同色格反向跳跃、飞跃线反向飞行，最多退至起飞区，不占正常掷骰。'},
  steal: {name:'顺手牵羊',icon:'⇄',description:'随机偷取一名对手的一张卡；先消耗此卡，再获得偷来的卡。'}
};
export const CARD_KEYS=Object.keys(CARDS);
export const tripleLayers=player=>Math.min(2,Math.max(0,Number(player.triple)||0));
export const moveMultiplier=player=>3**tripleLayers(player);
export function randomIndex(max) {
  const data=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;
  do {crypto.getRandomValues(data);} while(data[0]>=limit);
  return data[0]%max;
}
export function drawCards(state,player,count=1,rng=randomIndex,reason='补卡') {
  if(state.rules!=='skills')return;
  const before=player.hand.length;
  player.pendingCards??=[];
  for(let i=0;i<count;i++){
    const card=CARD_KEYS[rng(CARD_KEYS.length)];
    if(player.hand.length<5&&!player.pendingCards.length)player.hand.push(card);
    else player.pendingCards.push(card);
  }
  if(player.ai)autoDiscard(state,player.id);
  state.noticeSeq=(state.noticeSeq||0)+1;state.notices??=[];
  state.notices.push({id:state.noticeSeq,player:player.id,reason,added:player.hand.length-before,missed:0,pending:player.pendingCards.length});
  state.notices=state.notices.slice(-24);
}
// Pending rewards stay separate from the five-card hand and remain private.
export function discardCard(state,id,index){
  const p=state.players.find(p=>p.id===id);
  if(state.rules!=='skills'||!p||!Number.isInteger(index)||index<0)return false;
  const pending=p.pendingCards??=[];
  if(pending.length){
    if(index>p.hand.length)return false;
    if(index===p.hand.length)pending.shift();
    else {p.hand.splice(index,1);p.hand.push(pending.shift());}
    while(p.hand.length<5&&pending.length)p.hand.push(pending.shift());
    return true;
  }
  if(state.players[state.current].id!==id||state.phase!=='roll'||index>=p.hand.length)return false;
  p.hand.splice(index,1);return true;
}
export function autoDiscard(state,id){
  const p=state.players.find(p=>p.id===id);
  while(p?.pendingCards?.length){
    // A timeout keeps the existing hand; bots prefer flexible cards.
    let index=p.hand.length;
    if(p.ai){
      const values={dice:9,shield:7,missile:7,steal:6,double:p.pieces.includes(-1)?6:0,recycle:3,barrier:4,disrupt:2,triple:8,retreat:6};
      const choices=[...p.hand,p.pendingCards[0]];
      index=choices.reduce((best,c,i)=>(values[c]??0)<(values[choices[best]]??0)?i:best,choices.length-1);
    }
    discardCard(state,id,index);
  }
}
export function createState({ mode = 'ai', count = 4, rules = 'classic', rng=randomIndex } = {}) {
  const ids = count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  const state={ matchId:crypto.randomUUID(), rules: rules === 'skills' ? 'skills' : 'classic', skillUsed:false, forcedDie:null, barriers:[], round:1,
    players: ids.map((id,i)=>({id,name:mode==='ai'?(i===0?'你':`电脑 ${i}`):`玩家 ${i+1}`,ai:mode==='ai'&&i>0,pieces:[-1,-1,-1,-1],hand:[],pendingCards:[],triple:false,shields:[false,false,false,false],stats:{captures:0,destroyed:0,cardsUsed:0}})),
    current:0,die:null,phase:'roll',winner:null,turn:1,moves:0 };
  state.players.forEach(p=>drawCards(state,p,2,rng,'开局发卡'));return state;
}
const onRing=p=>p>0&&p<=50;
export function missileTargets(state,actor,piece){
  if(!Number.isInteger(piece)||!onRing(actor.pieces[piece]))return [];
  const center=globalIndex(actor,actor.pieces[piece]),targets=[];
  for(const player of state.players)player.pieces.forEach((v,i)=>{
    if(!onRing(v)||(player.id===actor.id&&i===piece))return;
    const distance=Math.abs(globalIndex(player,v)-center);
    if(Math.min(distance,52-distance)<=3)targets.push({player:player.id,piece:i});
  });
  return targets;
}
export function cardOptions(state,index) {
  const actor=state.players[state.current];
  if(state.rules!=='skills'||state.phase!=='roll'||actor.pendingCards?.length||!Number.isInteger(index))return [];
  const kind=actor.hand[index],options=[];
  const add=(args,label)=>options.push({args,label});
  if(kind==='dice')actor.pieces.forEach((v,piece)=>{
    for(let value=1;value<=6;value++)if(v<FINISH&&(v>=0||value%2===0))add({piece,value},`${piece+1} 号飞机 · ${v<0?'起飞':`前进 ${value*moveMultiplier(actor)} 格`}（${value} 点）`);
  });
  if(kind==='retreat')for(const p of state.players)p.pieces.forEach((v,piece)=>{if(v>0&&v<FINISH)add({target:p.id,piece},`${p.name} ${piece+1} 号飞机 · 倒退 ${4*moveMultiplier(actor)} 格`);});
  if(kind==='triple'&&tripleLayers(actor)<2)add({},`下一次实际移动 ×${3**(tripleLayers(actor)+1)}（可配合定点骰子）`);
  if(kind==='barrier')for(let cell=0;cell<52;cell++){
    if(!state.barriers.includes(cell)&&!state.players.some(p=>p.pieces.some(v=>onRing(v)&&globalIndex(p,v)===cell)))add({cell},`公共航道 ${cell+1} 号格`);
  }
  if(kind==='shield'||kind==='recycle')actor.pieces.forEach((v,piece)=>{
    if(v>=0&&v<FINISH&&(kind!=='shield'||!actor.shields[piece]))add({piece},`${piece+1} 号飞机${actor.shields[piece]?'（有护盾）':''}`);
  });
  if(kind==='double'&&actor.pieces.includes(-1))add({},`起飞 ${actor.pieces.filter(v=>v<0).length} 架飞机`);
  for(const enemy of state.players){
    if(enemy.id===actor.id)continue;
    if((kind==='disrupt'||kind==='steal')&&enemy.hand.length)add({target:enemy.id},`${enemy.name}（${enemy.hand.length} 张卡）`);
  }
  if(kind==='missile')actor.pieces.forEach((v,piece)=>{
    if(!onRing(v))return;
    const targets=missileTargets(state,actor,piece);
    if(!targets.length)return;
    const names=targets.map(t=>{
      const p=state.players.find(p=>p.id===t.player);
      return `${p.id===actor.id?'友机':p.name} ${t.piece+1} 号${p.shields[t.piece]?'（护盾抵挡）':''}`;
    });
    add({piece},`${piece+1} 号发射 → ${names.join('、')}`);
  });
  return options;
}
function hit(state,enemy,piece,rng) {
  if(enemy.shields[piece]){enemy.shields[piece]=false;return false;}
  enemy.pieces[piece]=-1;enemy.stats.destroyed++;drawCards(state,enemy,1,rng,'撞毁补偿');return true;
}
export function useCard(state,index,args={},rng=randomIndex) {
  if(!args||typeof args!=='object'||Array.isArray(args))return null;
  const option=cardOptions(state,index).find(o=>Object.keys(o.args).every(k=>o.args[k]===args[k]));
  if(!option)return null;
  const actor=state.players[state.current],kind=actor.hand[index],a=option.args;
  actor.hand.splice(index,1);state.skillUsed=true;actor.stats.cardsUsed++;
  const result={kind,actor:actor.id,args:{...a},effects:[],text:`${actor.name}使用了「${CARDS[kind].name}」`};
  const enemy=state.players.find(p=>p.id===a.target);
  if(a.piece!==undefined)result.from=position(actor,actor.pieces[a.piece],a.piece);
  if(kind==='dice'||kind==='retreat'){
    const movingPlayer=kind==='retreat'?enemy:actor,previousDie=state.die;
    result.from=position(movingPlayer,movingPlayer.pieces[a.piece],a.piece);
    const multiplier=kind==='retreat'?moveMultiplier(actor):1;
    if(kind==='retreat')actor.triple=false;
    state.die=kind==='retreat'?4:a.value;state.phase='choose';
    const movement=move(state,a.piece,rng,kind==='retreat'?{player:movingPlayer,direction:-1,multiplier}:null);
    result.movement={...movement,piece:a.piece};
    result.effects.push({kind:'extra-flight',from:result.from,route:movement.route.map(v=>position(movingPlayer,v,a.piece)),at:position(movingPlayer,movement.route.at(-1),a.piece),player:movingPlayer.id},...movement.effects);
    state.die=previousDie;
    if(state.phase!=='won')state.phase='roll';
    result.text+=`，${movingPlayer.name} ${a.piece+1} 号飞机${kind==='retreat'?`倒退 ${movement.steps} 格`:movement.from<0?'立即起飞':`额外前进 ${movement.steps} 格`}${movement.destroyed?'，碰到城墙被击回机场':movement.barrierBlocked?'，护盾抵消城墙，停在该格':''}，${state.phase==='won'?'全部归航！':'仍可正常出牌、掷骰'}`;
  }
  if(kind==='triple'){actor.triple=tripleLayers(actor)+1;result.text+=`，下一次实际移动步数 ×${moveMultiplier(actor)}（${actor.triple}/2 层）`;}
  if(kind==='barrier'){result.effects.push({kind:'barrier',at:RING[a.cell]});state.barriers.push(a.cell);result.text+=`，设在 ${a.cell+1} 号格`;}
  if(kind==='shield'){result.effects.push({kind:'shield',at:result.from});actor.shields[a.piece]=true;result.text+=`，保护 ${a.piece+1} 号飞机`;}
  if(kind==='missile'){
    // Snapshot the whole blast before moving planes or awarding replacement cards.
    const targets=missileTargets(state,actor,a.piece);let enemies=0,friends=0,blocked=0;
    for(const target of targets){
      const victim=state.players.find(p=>p.id===target.player),at=position(victim,victim.pieces[target.piece],target.piece);
      const captured=hit(state,victim,target.piece,rng);
      if(captured){if(victim.id===actor.id)friends++;else {enemies++;actor.stats.captures++;}}else blocked++;
      result.effects.push({kind:'missile',from:result.from,at,blocked:!captured});
    }
    result.text+=`，击毁敌机 ${enemies} 架、友机 ${friends} 架${blocked?`，${blocked} 架被护盾保护`:''}`;
  }
  if(kind==='recycle'){actor.pieces[a.piece]=-1;actor.shields[a.piece]=false;drawCards(state,actor,2,rng,'他就堵了奖励');result.effects.push({kind:'recycle',from:result.from,at:position(actor,-1,a.piece)});}
  if(kind==='double'){result.effects.push({kind:'double',at:position(actor,0)});actor.pieces.flatMap((v,i)=>v<0?[i]:[]).forEach(i=>actor.pieces[i]=0);}
  if(kind==='disrupt'||kind==='steal'){
    const [card]=enemy.hand.splice(rng(enemy.hand.length),1);
    if(kind==='steal'){actor.hand.push(card);result.effects.push({kind:'steal',fromPlayer:enemy.id,toPlayer:actor.id});}
    while(enemy.hand.length<5&&enemy.pendingCards?.length)enemy.hand.push(enemy.pendingCards.shift());
    result.text+=`，${enemy.name}${kind==='steal'?'被偷走':'失去'}一张卡`;
  }
  return result;
}
export function chooseAICard(state) {
  if(state.rules!=='skills'||state.phase!=='roll'||state.players[state.current].pendingCards?.length)return null;
  const player=state.players[state.current],baseline=expectedMoveValue(state,player.id);
  let best=null,score=baseline+2;
  // Evaluate each distinct card and each legal target; unknown draws are valued by count only.
  for(const kind of new Set(player.hand)){
    const index=player.hand.indexOf(kind);
    for(const option of cardOptions(state,index)){
      const next=structuredClone(state);
      // Random steals/discards should not let the bot peek at an opponent's card faces.
      next.players.filter(p=>p.id!==player.id).forEach(p=>p.hand=p.hand.map(()=>null));
      if(!useCard(next,index,option.args,()=>0))continue;
      const value=expectedMoveValue(next,player.id);
      if(value>score){score=value;best={index,args:option.args};}
    }
  }
  return best;
}
export function globalIndex(player, progress) { return (player.id * 13 + progress - 1 + 52) % 52; }
export function position(player, progress, piece = 0) {
  if (progress < 0) {
    return rotatePoint([100 + piece % 2 * 100,100 + Math.floor(piece / 2) * 100],player.id);
  }
  if (progress === 0) return rotatePoint([85,275],player.id);
  if (progress <= 50) return RING[globalIndex(player, progress)];
  return rotatePoint([178.7 + (progress-51)*50,475],player.id);
}
export function legalPieces(state) {
  if (state.phase !== 'choose') return [];
  return state.players[state.current].pieces.flatMap((p, i) => p !== FINISH && (p >= 0 || state.die % 2 === 0) ? [i] : []);
}
export function roll(state, value) {
  if (state.players[state.current].pendingCards?.length || state.phase !== 'roll' || !Number.isInteger(value) || value < 1 || value > 6) return false;
  state.die = value;
  state.forcedDie = null;
  state.phase = 'choose';
  return true;
}
export function previewMove(progress, die) {
  if (progress < 0) return { target: 0, route: [0], jump: false, flight: false };
  const route = [];
  let p = progress, direction = 1;
  for (let i = 0; i < die; i++) {
    if (p === FINISH) direction = -1;
    p += direction;
    route.push(p);
  }
  let jump = false, flight = false;
  if (p === 18) { p = 30; route.push(p); flight = true; p = 34; route.push(p); jump = true; }
  else if (p > 0 && p <= 46 && p % 4 === 2) {
    p += 4; route.push(p); jump = true;
    if (p === 18) { p = 30; route.push(p); flight = true; }
  }
  return { target: p, route, jump, flight };
}
function previewRetreat(progress,steps) {
  const route=Array.from({length:Math.min(progress,steps)},(_,i)=>progress-i-1);
  let p=Math.max(0,progress-steps),jump=false,flight=false;
  if(p===30){p=18;route.push(p);flight=true;p=14;route.push(p);jump=true;}
  else if(onRing(p)&&p%4===2){
    p=Math.max(0,p-4);route.push(p);jump=true;
    if(p===30){p=18;route.push(p);flight=true;}
  }
  return {target:p,route,jump,flight};
}
function crossesFlight(route){
  return route.some((p,i)=>(p===18&&route[i+1]===30)||(p===30&&route[i+1]===18));
}
export function planMove(state,player,progress,die,direction=1) {
  const result=direction===-1?previewRetreat(progress,die):previewMove(progress,die);
  const stop=result.route.findIndex(p=>onRing(p)&&state.barriers.includes(globalIndex(player,p)));
  if(stop>=0){
    result.route=result.route.slice(0,stop+1);result.target=result.route.at(-1);
    result.barrier=globalIndex(player,result.target);result.jump=false;result.flight=false;
  }
  // A shielded landing blocks the whole landing, before any capture at that cell.
  for(let i=Math.min(die,result.route.length)-1;i<result.route.length;i++){
    const p=result.route[i];
    if(!onRing(p)||(result.barrier!==undefined&&globalIndex(player,p)===result.barrier))continue;
    let defender=null;
    for(const enemy of state.players){
      if(enemy.id===player.id)continue;
      const piece=enemy.pieces.findIndex((v,n)=>onRing(v)&&globalIndex(enemy,v)===globalIndex(player,p)&&enemy.shields[n]);
      if(piece>=0){defender={player:enemy.id,piece};break;}
    }
    if(!defender)continue;
    result.shieldStop=defender;result.target=p-direction;result.route=result.route.slice(0,i);
    if(result.route.at(-1)!==result.target)result.route.push(result.target);
    delete result.barrier;
    if(onRing(result.target)&&state.barriers.includes(globalIndex(player,result.target)))result.barrier=globalIndex(player,result.target);
    result.flight=crossesFlight(result.route);
    result.jump=false;break;
  }
  return result;
}
function crossesHomePlane(player,route,enemy,progress){
  // Either direction of the flight crosses the opposite colour's third home-lane cell.
  return enemy.id===(player.id+2)%4&&progress===53&&crossesFlight(route);
}
export function move(state, piece, rng=randomIndex,extra=null) {
  if (!extra&&!legalPieces(state).includes(piece)) return null;
  const player = extra?.player||state.players[state.current];
  const multiplier=extra?extra.multiplier:player.pieces[piece]>=0?moveMultiplier(player):1;
  const boosted=multiplier>1;
  const steps=state.die*multiplier;
  if(boosted&&!extra)player.triple=false;
  const result = planMove(state,player,player.pieces[piece],steps,extra?.direction||1);
  if(result.barrier!==undefined)state.barriers.splice(state.barriers.indexOf(result.barrier),1);
  result.steps=steps;result.boosted=boosted;
  result.from = player.pieces[piece];
  result.captured = [];
  result.blocked = [];
  result.effects = [];
  const protectedPieces=new Set();
  if(result.shieldStop){
    const defender=state.players.find(p=>p.id===result.shieldStop.player),i=result.shieldStop.piece;
    defender.shields[i]=false;result.blocked.push(result.shieldStop);
    protectedPieces.add(`${defender.id}:${i}`);
    result.effects.push({kind:'blocked',at:position(defender,defender.pieces[i],i)});
  }
  function strike(enemy,i){
    const key=`${enemy.id}:${i}`;
    if(protectedPieces.has(key))return;
    const at=position(enemy,enemy.pieces[i],i);
    if(!hit(state,enemy,i,rng)){
      protectedPieces.add(key);result.blocked.push({player:enemy.id,piece:i});result.effects.push({kind:'blocked',at});return;
    }
    player.stats.captures++;result.captured.push({player:enemy.id,piece:i});
  }
  // Ordinary transit is safe; flight crossings additionally hit the intersected home cell.
  const landing = result.route.slice(Math.min(steps, result.route.length) - 1);
  for (const p of new Set(landing)) {
    if (p === 0 || p > 50 || (result.shieldStop&&p===result.target) || (result.barrier!==undefined&&globalIndex(player,p)===result.barrier)) continue;
    for (const enemy of state.players) {
      if (enemy.id === player.id) continue;
      enemy.pieces.forEach((enemyP, i) => {
        if (enemyP > 0 && enemyP <= 50 && globalIndex(enemy, enemyP) === globalIndex(player, p)) {
          strike(enemy,i);
        }
      });
    }
  }
  for(const enemy of state.players){
    if(enemy.id===player.id)continue;
    enemy.pieces.forEach((p,i)=>{if(crossesHomePlane(player,result.route,enemy,p))strike(enemy,i);});
  }
  player.pieces[piece] = result.target;
  if(result.target===FINISH){player.shields[piece]=false;drawCards(state,player,1,rng,'归航奖励');}
  if(result.barrier!==undefined){
    if(player.shields[piece]){
      player.shields[piece]=false;result.barrierBlocked=true;
      result.effects.push({kind:'blocked',at:RING[result.barrier]});
    }else{
      player.pieces[piece]=-1;player.stats.destroyed++;
      result.destroyed=true;result.target=-1;
      drawCards(state,player,1,rng,'城墙撞毁补偿');
      result.effects.push({kind:'crash',at:RING[result.barrier]});
    }
  }
  state.moves++;
  if (player.pieces.every(p => p === FINISH)) { state.winner = player.id; state.phase = 'won'; }
  else state.phase = 'moving';
  return result;
}
export function endTurn(state,rng=randomIndex) {
  if (state.phase === 'won') return;
  if (state.phase === 'roll' || (state.phase === 'choose' && legalPieces(state).length)) return;
  if (state.die !== 6) {
    state.current = (state.current + 1) % state.players.length; state.turn++;
    if(state.current===0){state.round++;if((state.round-1)%5===0)state.players.forEach(p=>drawCards(state,p,1,rng,'五轮补卡'));}
  }
  state.die = null;
  state.skillUsed=false;state.forcedDie=null;
  state.phase = 'roll';
}
const planeValue=p=>p<0?0:p===FINISH?195:p>=51?125+(p-51)*8:12+p*1.8;
function positionValue(state,id){
  const own=state.players.find(p=>p.id===id);
  if(own.pieces.every(p=>p===FINISH))return 100000;
  if(state.players.some(p=>p.id!==id&&p.pieces.every(v=>v===FINISH)))return -100000;
  let value=0;
  for(const p of state.players){
    const weight=p.id===id?1:-.48;
    value+=weight*(p.pieces.reduce((sum,v)=>sum+planeValue(v),0)+p.hand.length*7+p.shields.filter(Boolean).length*10);
  }
  // Expected damage from each opponent's best collision on its next die roll.
  // Real routes account for flight/jump landings, barriers, shared squares and shields.
  for(const enemy of state.players){
    if(enemy.id===id)continue;
    let expected=0;
    for(let die=1;die<=6;die++){
      let worst=0;
      for(const p of enemy.pieces){
        if(p<0||p===FINISH)continue;
        const steps=die*moveMultiplier(enemy),route=planMove(state,enemy,p,steps);
        const landings=new Set(route.route.slice(Math.min(steps,route.route.length)-1).filter(v=>onRing(v)&&(route.barrier===undefined||globalIndex(enemy,v)!==route.barrier)).map(v=>globalIndex(enemy,v)));
        const loss=own.pieces.reduce((sum,v,i)=>sum+((onRing(v)&&landings.has(globalIndex(own,v))||crossesHomePlane(enemy,route.route,own,v))?(own.shields[i]?10:planeValue(v)-(state.rules==='skills'&&own.hand.length<5?7:0)):0),0);
        worst=Math.max(worst,loss);
      }
      expected+=worst/6;
    }
    value-=expected*(state.die===6?.55:.9);
  }
  return value;
}
function moveCandidates(state,id){
  return legalPieces(state).map(piece=>{
    const next=structuredClone(state);move(next,piece,()=>0);
    return {piece,next,score:positionValue(next,id)};
  });
}
function expectedMoveValue(state,id){
  let sum=0;
  const dice=state.forcedDie?[state.forcedDie]:[1,2,3,4,5,6];
  for(const die of dice){
    const next=structuredClone(state);next.phase='roll';next.forcedDie=null;roll(next,die);
    const choices=moveCandidates(next,id);
    sum+=choices.length?Math.max(...choices.map(c=>c.score)):positionValue(next,id);
  }
  return sum/dice.length;
}
export function chooseAI(state) {
  const id=state.players[state.current].id,candidates=moveCandidates(state,id);
  for(const choice of candidates){
    // Six grants a bonus action: look one roll ahead without inventing future skill draws.
    if(state.die===6&&choice.next.phase!=='won'){
      const continuation=structuredClone(choice.next);continuation.phase='roll';continuation.forcedDie=null;
      choice.score+=.65*(expectedMoveValue(continuation,id)-choice.score);
    }
  }
  candidates.sort((a,b)=>b.score-a.score||a.piece-b.piece);
  return candidates[0]?.piece;
}

export function standings(state){
  return state.players.map(p=>({id:p.id,name:p.name,arrived:p.pieces.filter(v=>v===FINISH).length,progress:p.pieces.reduce((n,v)=>n+Math.max(0,v),0),...p.stats}))
    .sort((a,b)=>b.arrived-a.arrived||b.progress-a.progress);
}
