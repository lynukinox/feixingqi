import {CARDS,rotatePoint} from './engine.js';
import {cardArt} from './card-art.js';
import './card-playback.css';

export function mountCardPlayback(){
  const overlay=document.createElement('div');overlay.id='card-playback';overlay.setAttribute('aria-live','polite');
  document.querySelector('#board').append(overlay);
  const queues=new Map();let epoch=0;
  async function run(player,queue){
    const started=epoch;
    while(queue.length&&started===epoch){
      const kind=queue.shift(),card=CARDS[kind];if(!card)continue;
      const toast=document.createElement('div');toast.className='airport-card';toast.dataset.kind=kind;toast.dataset.player=String(player);
      const [x,y]=rotatePoint([150,155],player);toast.style.left=`${x/9.5}%`;toast.style.top=`${y/9.5}%`;
      const icon=document.createElement('span');icon.className='airport-card-art';icon.innerHTML=cardArt(kind);
      const text=document.createElement('span'),label=document.createElement('small'),name=document.createElement('strong');
      label.textContent='使用技能卡';name.textContent=card.name;text.append(label,name);toast.append(icon,text);overlay.append(toast);
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const animation=toast.animate(reduced?[{opacity:1},{opacity:1}]:[
        {opacity:0,transform:'translate(-50%,-35%) scale(.9)'},
        {offset:.15,opacity:1,transform:'translate(-50%,-50%) scale(1)'},
        {offset:.8,opacity:1,transform:'translate(-50%,-50%) scale(1)'},
        {opacity:0,transform:'translate(-50%,-65%) scale(.98)'}
      ],{duration:2000,easing:'ease-out'});
      toast._animation=animation;
      try{await animation.finished;}catch{/* Reset cancels a previous game's effects. */}
      toast.remove();
    }
    if(started===epoch)queues.delete(player);
  }
  return {
    show({player,card}){
      if(!Number.isInteger(player)||player<0||player>3||!CARDS[card])return;
      if(queues.has(player)){queues.get(player).push(card);return;}
      const queue=[card];queues.set(player,queue);void run(player,queue);
    },
    reset(){epoch++;queues.clear();for(const el of overlay.children)el._animation?.cancel();overlay.replaceChildren();}
  };
}
