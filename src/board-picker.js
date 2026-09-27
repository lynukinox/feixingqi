import {position,RING,globalIndex,COLORS,missileTargets} from './engine.js';

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
    if(kind==='missile'){
      heading('选择发射飞机，再确认范围内所有目标（包括友机）');
      for(const o of options)marker(point(actor,o.args.piece),String(o.args.piece+1),COLORS[actor.id],()=>{
        overlay.replaceChildren();
        heading('前后 3 格范围：点击发射飞机确认，红圈内友机也会受伤');
        const center=globalIndex(actor,actor.pieces[o.args.piece]);
        for(let d=-3;d<=3;d++){
          const [x,y]=RING[(center+d+52)%52],dot=document.createElement('i');dot.className='range-cell';dot.style.left=`${x/9.5}%`;dot.style.top=`${y/9.5}%`;overlay.append(dot);
        }
        for(const t of missileTargets(state,actor,o.args.piece)){
          const p=state.players.find(p=>p.id===t.player),[x,y]=point(p,t.piece),dot=document.createElement('i');
          dot.className='range-cell';dot.style.cssText=`left:${x/9.5}%;top:${y/9.5}%;border:3px solid #d44736;background:#e7473f55`;overlay.append(dot);
        }
        marker(point(actor,o.args.piece),'✓',COLORS[actor.id],()=>choose(o.args),'确认范围攻击');
      },`选择自己的${o.args.piece+1}号发射飞机`);
    }
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
