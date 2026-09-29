import {COLORS,standings,teamName} from './engine.js';
import {escapeHTML} from './online.js';

export function mountFeedback(){
  const notices=document.createElement('div');notices.id='card-notices';notices.setAttribute('role','status');
  document.querySelector('#skills-panel').before(notices);
  const results=document.createElement('div');results.id='match-results';document.querySelector('#win-description').after(results);
  let lastSeq=0,lastRound=1,timer;
  function render(state){
    if((state.noticeSeq||0)<lastSeq||state.round<lastRound){lastSeq=0;notices.replaceChildren();}
    lastRound=state.round;
    const fresh=(state.notices||[]).filter(n=>n.id>lastSeq);lastSeq=state.noticeSeq||0;
    if(fresh.length){
      notices.innerHTML=fresh.slice(-4).map(n=>{
        const p=state.players.find(p=>p.id===n.player);
        return `<div style="--notice-color:${COLORS[n.player]}"><b>${escapeHTML(p?.name||'玩家')}</b> ${escapeHTML(n.reason)}${n.added?` +${n.added}`:''}${n.pending?` · ${n.pending} 张待选择弃牌`:''}${n.missed?` · 手牌已满${n.added?'，其余不补发':''}`:''}</div>`;
      }).join('');clearTimeout(timer);timer=setTimeout(()=>notices.replaceChildren(),6500);
    }
    if(state.phase==='won'){
      const markup='<p>本局排名 · 按归航数、航程进度排序</p><table><thead><tr><th>玩家</th><th>归航</th><th>击毁</th><th>用卡</th></tr></thead><tbody>'+standings(state).map((p,i)=>`<tr><th><span>${i+1}</span> ${escapeHTML(p.name)}${state.teamMode?' · '+teamName(p.id):''}</th><td>${p.arrived}/4</td><td>${p.captures||0}</td><td>${p.cardsUsed||0}</td></tr>`).join('')+'</tbody></table>';
      if(results.innerHTML!==markup)results.innerHTML=markup;
    }
  }
  function reset(){lastSeq=0;lastRound=1;clearTimeout(timer);notices.replaceChildren();results.replaceChildren();}
  function steal(effect){
    const start=document.querySelector(`[data-seat="${effect.fromPlayer}"]`),panel=document.querySelector('#skills-panel');
    const end=panel?.dataset.owner===String(effect.toPlayer)?panel.querySelector('.skill-hand'):document.querySelector(`[data-seat="${effect.toPlayer}"]`);
    if(!start||!end||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const a=start.getBoundingClientRect(),b=end.getBoundingClientRect(),card=document.createElement('div');
    card.className='flying-card';card.textContent='技能卡';document.body.append(card);
    const animation=card.animate([{left:`${a.left+a.width/2}px`,top:`${a.top}px`,transform:'rotate(-15deg) scale(.6)',opacity:0},{offset:.2,opacity:1},{left:`${b.left+b.width/2}px`,top:`${b.top}px`,transform:'rotate(12deg) scale(1)',opacity:0}],{duration:850,easing:'ease-in-out'});
    animation.finished.finally(()=>card.remove());
  }
  function prime(state){reset();lastSeq=state.noticeSeq||0;lastRound=state.round;}
  return {render,reset,steal,prime};
}
