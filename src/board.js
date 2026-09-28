import Phaser from 'phaser';
import { planeSvg } from './plane-model.js';
import { COLORS, FINISH, position, rotatePoint, legalPieces, RING } from './engine.js';

const SIZE=950;
const xy=([x,y])=>({x,y});
const color=id=>Phaser.Display.Color.HexStringToColor(COLORS[id]).color;

export class Board extends Phaser.Scene {
  constructor(onPiece) {super('board');this.onPiece=onPiece;this.ready=false;this.tokens=[];this.skillMarkers=[];}
  preload() {this.load.svg('traditional-board','/board.svg',{width:1425,height:1425});}
  create() {
    let loaded=0;
    const onLoad=key=>{
      if(!key.startsWith('plane-'))return;
      if(++loaded===4){this.textures.off(Phaser.Textures.Events.LOAD,onLoad);this.ready=true;if(this.pending)this.sync(this.pending,this.controllableId);}
    };
    this.textures.on(Phaser.Textures.Events.LOAD,onLoad);
    for(let id=0;id<4;id++) {
      const svg=planeSvg(COLORS[id]);
      this.textures.addBase64(`plane-${id}`,`data:image/svg+xml;base64,${btoa(svg)}`);
    }
    this.drawBoard();
  }
  label(x,y,text,size=17,fill='#ffffff') {
    return this.add.text(x,y,text,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:`${size}px`,fontStyle:'bold',color:fill}).setOrigin(.5);
  }
  drawBoard() {
    this.add.image(475,475,'traditional-board').setDisplaySize(SIZE,SIZE);
    const g=this.add.graphics();
    for(let id=0;id<4;id++) {
      const name=['红方机场','黄方机场','蓝方机场','绿方机场'][id];
      const base=rotatePoint([150,150],id);
      this.label(base[0],base[1],name,18,id===1?'#72560e':'#ffffff');
      const launch=xy(position({id},0));
      g.fillStyle(0xffffff).fillCircle(launch.x,launch.y,24);
      g.lineStyle(2,color(id)).strokeCircle(launch.x,launch.y,24);
      this.label(launch.x,launch.y,'起飞',14,COLORS[id]);
      const first=xy(position({id},1));
      const dx=first.x-launch.x,dy=first.y-launch.y,length=Math.hypot(dx,dy);
      const a={x:launch.x+dx/length*27,y:launch.y+dy/length*27};
      const b={x:first.x-dx/length*26,y:first.y-dy/length*26};
      g.lineStyle(3,color(id)).lineBetween(a.x,a.y,b.x,b.y);
      const angle=Math.atan2(dy,dx);
      g.fillStyle(color(id)).fillTriangle(b.x,b.y,b.x-10*Math.cos(angle-.55),b.y-10*Math.sin(angle-.55),b.x-10*Math.cos(angle+.55),b.y-10*Math.sin(angle+.55));
      const flight=xy(position({id},18));
      this.label(flight.x,flight.y,'✈',26,COLORS[id]).setRotation((id+1)*Math.PI/2);
      for(let p=51;p<=FINISH;p++) {
        const point=xy(position({id},p));
        this.label(point.x,point.y,p===FINISH?'终':String(p-50),p===FINISH?18:15,COLORS[id]);
      }
    }
    this.label(475,25,'飞 行 棋',19,'#637462');
    this.label(475,925,'顺时针飞行  ·  四架归航获胜',13,'#7b8978');
  }
  sync(state,controllableId=null) {
    this.pending=state;this.controllableId=controllableId;if(!this.ready)return;
    const legal=legalPieces(state),current=state.players[state.current];
    const activePlayer=!current.ai&&(controllableId===null||current.id===controllableId)&&legal.length?current.id:null;
    const visualKey=JSON.stringify([state.rules,state.barriers,state.players.map(p=>[p.id,p.pieces,p.shields]),activePlayer,activePlayer===null?[]:legal]);
    if(this.visualKey===visualKey)return;
    this.visualKey=visualKey;
    this.tokens.forEach(t=>{this.tweens.killTweensOf(t);t.destroy();});this.tokens=[];
    this.skillMarkers.forEach(m=>m.destroy());this.skillMarkers=[];
    if(this.numberedRules!==state.rules){
      this.cellLabels?.forEach(label=>label.destroy());
      this.cellLabels=state.rules==='skills'?RING.map(([x,y],i)=>this.label(x,y+16,String(i+1),10,'#425845').setDepth(2)):[];
      this.numberedRules=state.rules;
    }
    if(state.rules==='skills'){
      for(const cell of state.barriers){
        const [x,y]=RING[cell],barrier=this.add.container(x,y).setDepth(9),g=this.add.graphics();
        g.fillStyle(0x42200d,.25).fillEllipse(0,20,48,12);
        g.fillStyle(0xffe89a,.9).fillCircle(0,0,26);
        g.lineStyle(3,0xffffff).strokeCircle(0,0,26);
        g.fillStyle(0x654736).fillRoundedRect(-18,0,6,21,2).fillRoundedRect(12,0,6,21,2);
        g.fillStyle(0x432f26).fillRoundedRect(-23,17,16,5,2).fillRoundedRect(7,17,16,5,2);
        g.fillStyle(0xffffff).fillRoundedRect(-25,-16,50,27,4);
        g.fillStyle(0xf46b20).fillRoundedRect(-23,-14,46,23,3);
        for(const left of [-21,-5,11])g.fillStyle(0xffffff).fillTriangle(left,-12,left+9,-12,left,6).fillTriangle(left+9,-12,left+9,6,left,6);
        g.lineStyle(2,0x98390e).strokeRoundedRect(-24,-15,48,25,4);
        barrier.add(g);this.skillMarkers.push(barrier);
      }
    }
    state.players.forEach(player=>player.pieces.forEach((p,i)=>{
      const arrived=p===FINISH;
      const point=xy(position(player,arrived?-1:p,i));
      const overlaps=player.pieces.flatMap((v,n)=>v===p&&p>=0&&!arrived?[n]:[]);
      if(overlaps.length>1){const n=overlaps.indexOf(i);point.x+=(n%2-.5)*19;point.y+=(Math.floor(n/2)-.5)*19;}
      const active=player.id===current.id&&legal.includes(i)&&!current.ai&&(controllableId===null||player.id===controllableId);
      const c=this.add.container(point.x,point.y),disk=this.add.graphics();
      disk.fillStyle(0x14273d,.12).fillEllipse(0,6,48,42);
      disk.fillStyle(0x14273d,.2).fillCircle(0,3,22);
      disk.fillStyle(arrived?0xffffff:color(player.id)).fillCircle(0,0,21);
      disk.lineStyle(active?4:2,arrived?color(player.id):0xffffff).strokeCircle(0,0,21);
      if(!arrived){
        disk.fillStyle(0xffffff,.14).fillEllipse(-3,-8,34,18);
        disk.lineStyle(1,0xffffff,.35).strokeCircle(0,-1,18);
      }
      if(active)disk.lineStyle(3,color(player.id),.8).strokeCircle(0,0,28);
      if(player.shields?.[i]&&!arrived)disk.lineStyle(4,0x68daf2).strokeCircle(0,0,32);
      c.add(disk);
      if(arrived)c.add(this.add.text(0,0,'✓',{fontSize:'27px',fontStyle:'bold',color:COLORS[player.id]}).setOrigin(.5));
      else {
        const icon=this.add.image(0,-1,`plane-${player.id}`).setDisplaySize(46,46).setRotation((player.id+1)*Math.PI/2);
        const number=this.add.text(16,17,String(i+1),{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#ffffff',backgroundColor:COLORS[player.id],padding:{x:3,y:1}}).setOrigin(.5);
        c.add([icon,number]);
      }
      c.setSize(52,52).setDepth(active?20:10).setData({player:player.id,piece:i});
      if(active){let pressed=null;c.setInteractive({useHandCursor:true}).on('pointerdown',pointer=>{pressed=pointer.id;}).on('pointerout',()=>{pressed=null;}).on('pointerup',pointer=>{if(pressed===pointer.id&&pointer.getDistance()<20)this.onPiece(i);pressed=null;});this.tweens.add({targets:c,scale:1.1,duration:650,yoyo:true,repeat:-1});}
      this.tokens.push(c);
    }));
  }
  playEffects(effects=[]){
    if(!this.ready||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(const e of effects){
      if(!e.at)continue;
      const [x,y]=e.at;
      const burst=(text,color)=>{
        const ring=this.add.circle(x,y,20,Phaser.Display.Color.HexStringToColor(color).color,.22).setStrokeStyle(4,Phaser.Display.Color.HexStringToColor(color).color).setDepth(60);
        const label=this.label(x,y-35,text,22,color).setDepth(61).setBackgroundColor('#fffffff0');
        this.tweens.add({targets:ring,scale:2.8,alpha:0,duration:700,onComplete:()=>ring.destroy()});
        this.tweens.add({targets:label,y:y-80,alpha:0,duration:1100,onComplete:()=>label.destroy()});
      };
      if(e.kind==='extra-flight'){
        const [sx,sy]=e.from,ghost=this.add.image(sx,sy,`plane-${e.player}`).setDisplaySize(46,46).setDepth(65).setRotation((e.player+1)*Math.PI/2);
        const points=[...e.route];
        const advance=()=>{const p=points.shift();if(!p){ghost.destroy();burst('额外飞行','#368fa9');return;}
          this.tweens.add({targets:ghost,x:p[0],y:p[1],duration:180,onComplete:advance});};advance();
      }else if(e.kind==='missile'||e.kind==='recycle'){
        const [sx,sy]=e.from,projectile=this.label(sx,sy,e.kind==='missile'?'➤':'✈',38,e.kind==='missile'?'#dd673d':'#6384a5').setDepth(65);
        projectile.setRotation(Math.atan2(y-sy,x-sx));
        this.tweens.add({targets:projectile,x,y,duration:500,ease:'Sine.easeIn',onComplete:()=>{projectile.destroy();burst(e.kind==='recycle'?'他就堵了 +2':e.blocked?'护盾抵挡':'命中！',e.blocked?'#368fa9':'#d96a38');}});
      }else burst(({blocked:'护盾破裂',shield:'护盾已展开',barrier:'城墙',crash:'撞毁！',double:'一起起飞'})[e.kind]||'技能生效',e.kind==='blocked'||e.kind==='shield'?'#368fa9':'#d58a38');
    }
  }
  async animate(player,piece,route) {
    this.visualKey=null;
    const token=this.tokens.find(t=>t.getData('player')===player.id&&t.getData('piece')===piece);if(!token)return;
    this.tweens.killTweensOf(token);token.setScale(1).setDepth(30);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(const p of route){
      if(!token.active)return;
      const point=xy(position(player,p,piece));
      await new Promise(resolve=>{
        const done=()=>{token.off('destroy',done);resolve();};
        token.once('destroy',done);
        this.tweens.add({targets:token,x:point.x,y:point.y,duration:160,ease:'Sine.easeInOut',onComplete:done,onStop:done});
      });
    }
  }
}
export function mountBoard(parent,onPiece) {
  const scene=new Board(onPiece);
  const game=new Phaser.Game({type:Phaser.AUTO,parent,width:SIZE,height:SIZE,transparent:true,antialias:true,input:{touch:{capture:false},mouse:{preventDefaultWheel:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[scene],render:{pixelArt:false},audio:{noAudio:true}});
  return {scene,game};
}
