import {position,RING,globalIndex,COLORS} from './engine.js';

export function createBoardPicker(){
  const board=document.querySelector('#board'),overlay=document.createElement('div'),hint=document.createElement('div');
  overlay.id='board-targets';overlay.hidden=true;hint.id='target-hint';hint.hidden=true;
  board.append(overlay);board.before(hint);
  let active=false;
  function clear(){active=false;overlay.hidden=true;hint.hidden=true;overlay.replaceChildren();document.body.classList.remove('selecting-skill');}
  function begin({kind,state,options,onPick,onBack}){
    active=true;overlay.hidden=false;hint.hidden=false;document.body.classList.add('selecting-skill');
    const actor=state.players[state.current];
    function heading(text){
      hint.replaceChildren();const label=document.createElement('strong');label.textContent=text;hint.append(label);
      const back=document.createElement('button');back.textContent='返回列表';back.onclick=()=>{clear();onBack();};hint.append(back);
    }
    function marker(point,label,color,click,id){
      const button=document.createElement('button');button.className='target-plane';button.type='button';
      button.style.left=`${point[0]/9.5}%`;button.style.top=`${point[1]/9.5}%`;button.style.setProperty('--target-color',color);
      button.textContent=label;button.setAttribute('aria-label',id);button.onclick=click;overlay.append(button);
    }
    function point(player,piece){
      const v=player.pieces[piece],p=position(player,v,piece),stack=player.pieces.flatMap((n,i)=>n===v&&v>=0?[i]:[]);
      if(stack.length>1){const i=stack.indexOf(piece);p[0]+=(i%2-.5)*19;p[1]+=(Math.floor(i/2)-.5)*19;}return p;
    }
    const choose=args=>{clear();onPick(args);};
    function targets(piece){
      overlay.replaceChildren();const filtered=options.filter(o=>o.args.piece===piece);
      heading(filtered.length?'选择高亮敌机，确认导弹目标':'五格内没有敌机，请换一架发射飞机');
      const center=globalIndex(actor,actor.pieces[piece]);
      for(let d=-5;d<=5;d++){
        const [x,y]=RING[(center+d+52)%52],dot=document.createElement('i');dot.className='range-cell';dot.style.left=`${x/9.5}%`;dot.style.top=`${y/9.5}%`;overlay.append(dot);
      }
      sources(false);
      for(const o of filtered){const enemy=state.players.find(p=>p.id===o.args.target);marker(point(enemy,o.args.targetPiece),String(o.args.targetPiece+1),COLORS[enemy.id],()=>choose(o.args),`攻击${enemy.name} ${o.args.targetPiece+1}号飞机`);}
    }
    function sources(reset=true){
      if(reset){overlay.replaceChildren();heading('第一步：点击自己的发射飞机');}
      actor.pieces.forEach((v,i)=>{if(v>0&&v<=50)marker(point(actor,i),String(i+1),COLORS[actor.id],()=>targets(i),`选择自己的${i+1}号发射飞机`);});
    }
    if(kind==='missile')sources();
    else{
      overlay.replaceChildren();heading(kind==='barrier'?'点击高亮空格放置路障':'点击高亮的己方飞机');
      for(const o of options){
        const cell=o.args.cell,piece=o.args.piece;
        marker(cell!==undefined?RING[cell]:point(actor,piece),String((cell??piece)+1),cell!==undefined?'#c87531':COLORS[actor.id],()=>choose(o.args),o.label);
      }
    }
    hint.scrollIntoView({behavior:'smooth',block:'start'});
  }
  return {begin,clear,get active(){return active;}};
}
