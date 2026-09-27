import {CARDS,cardOptions,RING} from './engine.js';
import {escapeHTML} from './online.js';
import './skills.css';
import {createBoardPicker} from './board-picker.js';

export function mountSkills({getState,getOnline,isBusy,play}) {
  const panel=document.createElement('section');panel.id='skills-panel';panel.className='skills-panel';
  document.querySelector('#piece-actions').after(panel);
  const dialog=document.createElement('dialog');dialog.id='card-dialog';
  dialog.innerHTML='<button class="close" aria-label="取消出牌">×</button><div class="eyebrow">FLIGHT SKILL</div><h2></h2><p class="card-description"></p><form><div id="missile-source-field" hidden><label for="missile-source">第一步：选择自己的发射飞机</label><select id="missile-source"></select></div><label for="card-target">选择目标</label><select id="card-target"></select><div id="barrier-map"></div><p class="modal-note">确认后消耗此卡，本次行动不能再使用其他卡。</p><button class="primary-button" type="submit">确认使用</button></form>';
  document.body.append(dialog);
  const picker=createBoardPicker();
  const boardButton=document.createElement('button');boardButton.id='pick-on-board';boardButton.type='button';boardButton.className='secondary-button';boardButton.textContent='在棋盘上选择目标';dialog.querySelector('form').prepend(boardButton);
  let selection=null,lastKey='';
  dialog.querySelector('.close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(!picker.active)selection=null;});
  const source=dialog.querySelector('#missile-source'),sourceField=dialog.querySelector('#missile-source-field'),confirm=dialog.querySelector('[type=submit]');
  const target=dialog.querySelector('#card-target'),map=dialog.querySelector('#barrier-map');
  function mark(){map.querySelectorAll('[data-option]').forEach(c=>c.classList.toggle('selected',c.dataset.option===target.value));}
  target.onchange=mark;
  dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();if(!selection)return;
    const {index,options}=selection,option=target.value===''?null:options[Number(target.value)];if(!option||confirm.disabled)return;
    dialog.close();await play(index,option.args);
  };
  function open(index){
    const state=getState(),options=cardOptions(state,index),kind=state.players[state.current].hand[index];
    const launchers=state.players[state.current].pieces.flatMap((p,i)=>p>0&&p<=50?[i]:[]);
    if(kind==='missile'?!launchers.length:!options.length)return;
    selection={index,options};
    boardButton.hidden=!['missile','shield','recycle','barrier'].includes(kind);
    boardButton.onclick=()=>{
      picker.begin({kind,state,options,onBack:()=>dialog.showModal(),onPick:args=>{
        if(kind==='missile'){source.value=String(args.piece);source.onchange();}
        target.value=String(selection.options.findIndex(o=>Object.keys(o.args).every(k=>o.args[k]===args[k])));mark();dialog.showModal();
      }});dialog.close();
    };
    dialog.querySelector('h2').textContent=CARDS[kind].name;
    dialog.querySelector('.card-description').textContent=CARDS[kind].description;
    sourceField.hidden=kind!=='missile';confirm.disabled=false;target.disabled=false;
    dialog.querySelector('label[for=card-target]').textContent=kind==='missile'?'第二步：选择五格内的敌机':'选择目标';
    target.innerHTML=options.map((o,i)=>`<option value="${i}">${escapeHTML(o.label)}</option>`).join('');
    if(kind==='missile'){
      source.innerHTML='<option value="">请选择发射飞机</option>'+launchers.map(piece=>`<option value="${piece}">${piece+1} 号飞机</option>`).join('');
      const search=()=>{
        const filtered=source.value===''?[]:options.filter(o=>o.args.piece===Number(source.value));
        selection={index,options:filtered};
        target.innerHTML=filtered.length?filtered.map((o,i)=>`<option value="${i}">${escapeHTML(o.label.split(' → ')[1])}</option>`).join(''):`<option value="">${source.value===''?'请先选择自己的飞机':'这架飞机前后五格内没有可攻击的敌机'}</option>`;
        target.disabled=!filtered.length;confirm.disabled=!filtered.length;
      };
      source.onchange=search;search();
    }
    map.innerHTML=kind==='barrier'?`<p>点击小棋盘选格，也可用上方列表选择。</p><svg viewBox="0 0 950 950" role="group" aria-label="选择路障位置"><image href="/board.svg" width="950" height="950"/>${options.map((o,i)=>{const [x,y]=RING[o.args.cell];return `<g data-option="${i}" role="button" tabindex="0" aria-label="${o.label}"><circle cx="${x}" cy="${y}" r="24"/><text x="${x}" y="${y+7}" text-anchor="middle">${o.args.cell+1}</text></g>`;}).join('')}</svg>`:'';
    map.querySelectorAll('[data-option]').forEach(g=>{
      const choose=()=>{target.value=g.dataset.option;mark();};g.onclick=choose;
      g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};
    });mark();dialog.showModal();
  }
  function render(){
    const state=getState(),online=getOnline(),room=online?.room;
    panel.hidden=state.rules!=='skills'||(room&&!room.state);
    const key=JSON.stringify([state.current,state.phase,state.skillUsed,state.players.map(p=>p.hand),room?.revision,isBusy()]);
    if(key!==lastKey){picker.clear();if(dialog.open)dialog.close();}lastKey=key;
    if(panel.hidden)return;
    const owner=room?state.players[room.members.findIndex(m=>m.id===online.memberId)]:state.players[state.current];
    if(!owner)return;panel.dataset.owner=String(owner.id);
    const canPlay=!isBusy()&&!owner.ai&&state.phase==='roll'&&!state.skillUsed&&(!room||online.canPlay());
    const hidden=!room&&owner.ai;
    const hint=state.phase==='won'?'本局已结束':state.skillUsed?'本次已出牌，请掷骰子':canPlay?'掷骰前可用一张，也可直接掷骰':'等待自己的掷骰阶段出牌';
    panel.innerHTML=`<div class="players-title"><h3>${room?'我的':escapeHTML(owner.name)+'的'}技能卡</h3><span>${owner.hand.length} / 5</span></div><p class="skill-hint">${hint}${state.forcedDie?` · 已指定 ${state.forcedDie} 点`:''}</p><div class="skill-hand">${owner.hand.map((kind,index)=>{
      const card=hidden?null:CARDS[kind],enabled=canPlay&&(kind==='missile'?owner.pieces.some(p=>p>0&&p<=50):cardOptions(state,index).length>0);
      return `<button type="button" class="skill-card" data-kind="${kind||'hidden'}" data-card="${index}" ${enabled?'':'disabled'} title="${card?escapeHTML(card.description):'对手的手牌'}"><span>${card?.icon||'?'}</span><strong>${card?.name||'隐藏手牌'}</strong><small>${enabled?'点击使用':canPlay?'暂无有效目标':'等待使用'}</small></button>`;
    }).join('')||'<p class="skill-empty">暂无手牌，归航或被撞毁可补卡。</p>'}</div><p class="skill-round">第 ${state.round} 轮 · 再完成 ${5-(state.round-1)%5} 轮补卡</p>`;
    panel.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>open(Number(b.dataset.card)));
  }
  return {render};
}
