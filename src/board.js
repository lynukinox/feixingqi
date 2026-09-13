import Phaser from 'phaser';
import { COLORS, FINISH, position, rotatePoint, legalPieces } from './engine.js';

const SIZE=950;
const xy=([x,y])=>({x,y});
const color=id=>Phaser.Display.Color.HexStringToColor(COLORS[id]).color;
const plane='M 0 -18 L 4 -5 L 17 3 L 17 8 L 4 4 L 4 12 L 9 16 L 9 20 L 0 16 L -9 20 L -9 16 L -4 12 L -4 4 L -17 8 L -17 3 L -4 -5 Z';

export class Board extends Phaser.Scene {
  constructor(onPiece) {super('board');this.onPiece=onPiece;this.ready=false;this.tokens=[];}
  preload() {this.load.svg('traditional-board','/board.svg',{width:1425,height:1425});}
  create() {
    let loaded=0;
    const onLoad=key=>{
      if(!key.startsWith('plane-'))return;
      if(++loaded===4){this.textures.off(Phaser.Textures.Events.LOAD,onLoad);this.ready=true;if(this.pending)this.sync(this.pending,this.controllableId);}
    };
    this.textures.on(Phaser.Textures.Events.LOAD,onLoad);
    for(let id=0;id<4;id++) {
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="-24 -24 48 48"><path d="${plane}" fill="white" stroke="${COLORS[id]}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
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
    this.tokens.forEach(t=>{this.tweens.killTweensOf(t);t.destroy();});this.tokens=[];
    const legal=legalPieces(state),current=state.players[state.current];
    state.players.forEach(player=>player.pieces.forEach((p,i)=>{
      const arrived=p===FINISH;
      const point=xy(position(player,arrived?-1:p,i));
      const overlaps=player.pieces.flatMap((v,n)=>v===p&&p>=0&&!arrived?[n]:[]);
      if(overlaps.length>1){const n=overlaps.indexOf(i);point.x+=(n%2-.5)*19;point.y+=(Math.floor(n/2)-.5)*19;}
      const active=player.id===current.id&&legal.includes(i)&&!current.ai&&(controllableId===null||player.id===controllableId);
      const c=this.add.container(point.x,point.y),disk=this.add.graphics();
      disk.fillStyle(0x17291c,.19).fillCircle(0,4,22);
      disk.fillStyle(arrived?0xffffff:color(player.id)).fillCircle(0,0,21);
      disk.lineStyle(active?4:2,arrived?color(player.id):0xffffff).strokeCircle(0,0,21);
      if(active)disk.lineStyle(3,color(player.id),.8).strokeCircle(0,0,28);
      c.add(disk);
      if(arrived)c.add(this.add.text(0,0,'✓',{fontSize:'27px',fontStyle:'bold',color:COLORS[player.id]}).setOrigin(.5));
      else {
        const icon=this.add.image(0,-1,`plane-${player.id}`).setDisplaySize(42,42).setRotation((player.id+1)*Math.PI/2);
        const number=this.add.text(16,17,String(i+1),{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#ffffff',backgroundColor:COLORS[player.id],padding:{x:3,y:1}}).setOrigin(.5);
        c.add([icon,number]);
      }
      c.setSize(52,52).setDepth(active?20:10).setData({player:player.id,piece:i});
      if(active){c.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.onPiece(i));this.tweens.add({targets:c,scale:1.1,duration:650,yoyo:true,repeat:-1});}
      this.tokens.push(c);
    }));
  }
  async animate(player,piece,route) {
    const token=this.tokens.find(t=>t.getData('player')===player.id&&t.getData('piece')===piece);if(!token)return;
    this.tweens.killTweensOf(token);token.setScale(1).setDepth(30);
    for(const p of route){const point=xy(position(player,p,piece));await new Promise(resolve=>this.tweens.add({targets:token,x:point.x,y:point.y,duration:160,ease:'Sine.easeInOut',onComplete:resolve}));}
  }
}
export function mountBoard(parent,onPiece) {
  const scene=new Board(onPiece);
  const game=new Phaser.Game({type:Phaser.AUTO,parent,width:SIZE,height:SIZE,transparent:true,antialias:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[scene],render:{pixelArt:false},audio:{noAudio:true}});
  return {scene,game};
}
