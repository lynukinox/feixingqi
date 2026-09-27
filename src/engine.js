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
  dice: {name:'定点骰子',icon:'⚄',description:'指定下一次骰子为 1–6 点；6 点照常起飞、连掷。'},
  barrier: {name:'路障',icon:'⊥',description:'在公共航道空格放置路障。经过或落在该格的第一架飞机停下，路障消失；跳飞跨过不受影响，停下不再跳飞。'},
  missile: {name:'导弹',icon:'➶',description:'以己方飞机为发射点，攻击公共航道前后 5 格内一架敌机，送回机场；护盾可抵挡。'},
  shield: {name:'护盾',icon:'◇',description:'保护一架已起飞的己方飞机，抵挡一次撞机或导弹；每架最多一个。'},
  disrupt: {name:'干扰',icon:'ϟ',description:'指定一名有手牌的对手，随机弃掉对方一张卡。'},
  recycle: {name:'回收',icon:'↶',description:'撤回一架已起飞、未归航的己方飞机，抽两张卡；不算撞毁。'},
  double: {name:'双机起飞',icon:'⇈',description:'机场内两架飞机直接起飞；只剩一架也可使用，随后照常掷骰。'},
  steal: {name:'窃取',icon:'⇄',description:'随机偷取一名对手的一张卡；先消耗此卡，再获得偷来的卡。'}
};
export const CARD_KEYS=Object.keys(CARDS);
export function randomIndex(max) {
  const data=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;
  do {crypto.getRandomValues(data);} while(data[0]>=limit);
  return data[0]%max;
}
export function drawCards(state,player,count=1,rng=randomIndex,reason='补卡') {
  if(state.rules!=='skills')return;
  const before=player.hand.length;
  for(let i=0;i<count&&player.hand.length<5;i++)player.hand.push(CARD_KEYS[rng(CARD_KEYS.length)]);
  state.noticeSeq=(state.noticeSeq||0)+1;state.notices??=[];
  state.notices.push({id:state.noticeSeq,player:player.id,reason,added:player.hand.length-before,missed:count-(player.hand.length-before)});
  state.notices=state.notices.slice(-24);
}
export function createState({ mode = 'ai', count = 4, rules = 'classic', rng=randomIndex } = {}) {
  const ids = count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  const state={ rules: rules === 'skills' ? 'skills' : 'classic', skillUsed:false, forcedDie:null, barriers:[], round:1,
    players: ids.map((id,i)=>({id,name:mode==='ai'?(i===0?'你':`电脑 ${i}`):`玩家 ${i+1}`,ai:mode==='ai'&&i>0,pieces:[-1,-1,-1,-1],hand:[],shields:[false,false,false,false],stats:{captures:0,destroyed:0,cardsUsed:0}})),
    current:0,die:null,phase:'roll',winner:null,turn:1,moves:0 };
  state.players.forEach(p=>drawCards(state,p,2,rng,'开局发卡'));return state;
}
const onRing=p=>p>0&&p<=50;
export function cardOptions(state,index) {
  const actor=state.players[state.current];
  if(state.rules!=='skills'||state.phase!=='roll'||state.skillUsed||!Number.isInteger(index))return [];
  const kind=actor.hand[index],options=[];
  const add=(args,label)=>options.push({args,label});
  if(kind==='dice')for(let value=1;value<=6;value++)add({value},`${value} 点`);
  if(kind==='barrier')for(let cell=0;cell<52;cell++){
    if(!state.barriers.includes(cell)&&!state.players.some(p=>p.pieces.some(v=>onRing(v)&&globalIndex(p,v)===cell)))add({cell},`公共航道 ${cell+1} 号格`);
  }
  if(kind==='shield'||kind==='recycle')actor.pieces.forEach((v,piece)=>{
    if(v>=0&&v<FINISH&&(kind!=='shield'||!actor.shields[piece]))add({piece},`${piece+1} 号飞机${actor.shields[piece]?'（有护盾）':''}`);
  });
  if(kind==='double'&&actor.pieces.includes(-1))add({},`起飞 ${Math.min(2,actor.pieces.filter(v=>v<0).length)} 架飞机`);
  for(const enemy of state.players){
    if(enemy.id===actor.id)continue;
    if((kind==='disrupt'||kind==='steal')&&enemy.hand.length)add({target:enemy.id},`${enemy.name}（${enemy.hand.length} 张卡）`);
    if(kind==='missile')actor.pieces.forEach((v,piece)=>{
      if(!onRing(v))return;
      enemy.pieces.forEach((w,targetPiece)=>{
        if(!onRing(w))return;
        const d=Math.abs(globalIndex(actor,v)-globalIndex(enemy,w));
        if(Math.min(d,52-d)<=5)add({piece,target:enemy.id,targetPiece},`${piece+1} 号 → ${enemy.name} ${targetPiece+1} 号${enemy.shields[targetPiece]?'（有护盾）':''}`);
      });
    });
  }
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
  if(kind==='dice'){state.forcedDie=a.value;result.text+=`，下一次为 ${a.value} 点`;}
  if(kind==='barrier'){result.effects.push({kind:'barrier',at:RING[a.cell]});state.barriers.push(a.cell);result.text+=`，设在 ${a.cell+1} 号格`;}
  if(kind==='shield'){result.effects.push({kind:'shield',at:result.from});actor.shields[a.piece]=true;result.text+=`，保护 ${a.piece+1} 号飞机`;}
  if(kind==='missile'){const at=position(enemy,enemy.pieces[a.targetPiece],a.targetPiece),captured=hit(state,enemy,a.targetPiece,rng);if(captured)actor.stats.captures++;result.effects.push({kind:'missile',from:result.from,at,blocked:!captured});result.text+=`，${enemy.name}的 ${a.targetPiece+1} 号飞机${captured?'被击回机场':'护盾抵挡了攻击'}`;}
  if(kind==='recycle'){actor.pieces[a.piece]=-1;actor.shields[a.piece]=false;drawCards(state,actor,2,rng,'回收奖励');result.effects.push({kind:'recycle',from:result.from,at:position(actor,-1,a.piece)});}
  if(kind==='double'){result.effects.push({kind:'double',at:position(actor,0)});actor.pieces.flatMap((v,i)=>v<0?[i]:[]).slice(0,2).forEach(i=>actor.pieces[i]=0);}
  if(kind==='disrupt'||kind==='steal'){
    const [card]=enemy.hand.splice(rng(enemy.hand.length),1);
    if(kind==='steal'){actor.hand.push(card);result.effects.push({kind:'steal',fromPlayer:enemy.id,toPlayer:actor.id});}
    result.text+=`，${enemy.name}${kind==='steal'?'被偷走':'失去'}一张卡`;
  }
  return result;
}
export function chooseAICard(state) {
  if(state.rules!=='skills'||state.phase!=='roll'||state.skillUsed)return null;
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
  return state.players[state.current].pieces.flatMap((p, i) => p !== FINISH && (p >= 0 || state.die === 6) ? [i] : []);
}
export function roll(state, value) {
  if (state.phase !== 'roll' || !Number.isInteger(value) || value < 1 || value > 6) return false;
  state.die = state.forcedDie ?? value;
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
  if (p === 18) { p = 30; route.push(p); flight = true; }
  else if (p > 0 && p <= 46 && p % 4 === 2) {
    p += 4; route.push(p); jump = true;
    if (p === 18) { p = 30; route.push(p); flight = true; }
  }
  return { target: p, route, jump, flight };
}
export function planMove(state,player,progress,die) {
  const result=previewMove(progress,die);
  const stop=result.route.findIndex(p=>onRing(p)&&state.barriers.includes(globalIndex(player,p)));
  if(stop>=0){
    result.route=result.route.slice(0,stop+1);result.target=result.route.at(-1);
    result.barrier=globalIndex(player,result.target);result.jump=false;result.flight=false;
  }
  return result;
}
export function move(state, piece, rng=randomIndex) {
  if (!legalPieces(state).includes(piece)) return null;
  const player = state.players[state.current];
  const steps=state.die;
  const result = planMove(state,player,player.pieces[piece],steps);
  if(result.barrier!==undefined)state.barriers.splice(state.barriers.indexOf(result.barrier),1);
  result.from = player.pieces[piece];
  result.captured = [];
  result.blocked = [];
  result.effects = [];
  const protectedPieces=new Set();
  // Only landing squares collide. Ordinary transit and flight crossings are safe.
  const landing = [result.route[Math.min(steps, result.route.length) - 1], result.target];
  for (const p of new Set(landing)) {
    if (p === 0 || p > 50) continue;
    for (const enemy of state.players) {
      if (enemy.id === player.id) continue;
      enemy.pieces.forEach((enemyP, i) => {
        if (enemyP > 0 && enemyP <= 50 && globalIndex(enemy, enemyP) === globalIndex(player, p)) {
          const key=`${enemy.id}:${i}`;
          if(protectedPieces.has(key))return;
          if(enemy.shields?.[i]){enemy.shields[i]=false;protectedPieces.add(key);result.blocked.push({player:enemy.id,piece:i});result.effects.push({kind:'blocked',at:position(enemy,enemyP,i)});return;}
          hit(state,enemy,i,rng);player.stats.captures++;
          result.captured.push({ player: enemy.id, piece: i });
        }
      });
    }
  }
  player.pieces[piece] = result.target;
  if(result.target===FINISH){player.shields[piece]=false;drawCards(state,player,1,rng,'归航奖励');}
  if(result.barrier!==undefined)result.effects.push({kind:'barrier',at:RING[result.barrier]});
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
        const route=planMove(state,enemy,p,die);
        const landings=new Set([route.route[Math.min(die,route.route.length)-1],route.target].filter(onRing).map(v=>globalIndex(enemy,v)));
        const loss=own.pieces.reduce((sum,v,i)=>sum+(onRing(v)&&landings.has(globalIndex(own,v))?(own.shields[i]?10:planeValue(v)-(state.rules==='skills'&&own.hand.length<5?7:0)):0),0);
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
