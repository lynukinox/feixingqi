const colors = [
  {id:'red', name:'红方', start:29, launch:[34,66], launchRotation:135, base:[[7.2,85.6],[16.8,85.6],[7.2,94.24],[16.8,94.24]]},
  {id:'blue', name:'蓝方', start:4, launch:[66,34], launchRotation:-45, base:[[83.2,9.6],[92.8,9.6],[83.2,18.24],[92.8,18.24]]},
  {id:'green', name:'绿方', start:17, launch:[66,66], launchRotation:45, base:[[77.8,85.6],[87.4,85.6],[77.8,94.24],[87.4,94.24]]},
  {id:'yellow', name:'黄方', start:43, launch:[34,34], launchRotation:-135, base:[[7.2,9.6],[16.8,9.6],[7.2,18.24],[16.8,18.24]]}
];

const board = document.querySelector('#board');
const dice = document.querySelector('#dice');
const rollBtn = document.querySelector('#rollBtn');
let playfield;
let current = 0;
let rolled = null;
let waiting = false;
let gameOver = false;
let planes = [];

const BOARD_GRID = 17;
const grid = n => (n + 0.5) * (100 / BOARD_GRID);

// One shared 52-cell road. Each quarter bends around an airport before
// continuing to the next side, leaving the central home lanes independent.
const quarterRoute = [
  [8,0],[9,0],[10,0],[11,0],
  [12,1],[12,2],[12,3],
  [13,4],[14,4],[15,4],
  [16,5],[16,6],[16,7],[16,8]
];
const rotatePoint = ([x,y]) => [BOARD_GRID-1-y,x];
const quarters = [quarterRoute];
for(let i=1;i<4;i++) quarters.push(quarters[i-1].map(rotatePoint));
const trackGrid = [
  ...quarters[0],
  ...quarters[1].slice(1),
  ...quarters[2].slice(1),
  ...quarters[3].slice(1,-1)
];
function shiftAirportCells([x,y]){
  if(y===4 && x>=1 && x<=3) x+=0.5;
  if(x===4 && y>=1 && y<=3) y+=0.5;
  if(y===4 && x>=13 && x<=15) x-=0.5;
  if(x===12 && y>=1 && y<=3) y+=0.5;
  if(y===12 && x>=1 && x<=3) x+=0.5;
  if(x===4 && y>=13 && y<=15) y-=0.5;
  if(y===12 && x>=13 && x<=15) x-=0.5;
  if(x===12 && y>=13 && y<=15) y-=0.5;
  return [x,y];
}
const path = trackGrid.map(shiftAirportCells).map(([x,y]) => [grid(x),grid(y)]);
const HOME_START = path.length;
const GOAL_PROGRESS = HOME_START + 6;
const finishPath = {
  red:[15,14,13,12,11,10].map(y => [grid(8),grid(y)]),
  blue:[1,2,3,4,5,6].map(y => [grid(8),grid(y)]),
  green:[15,14,13,12,11,10].map(x => [grid(x),grid(8)]),
  yellow:[1,2,3,4,5,6].map(x => [grid(x),grid(8)])
};

function sidePanel(side, topColor, bottomColor, tallies){
  return '<div class="side-panel '+side+'">'+
    '<span class="side-plane top" style="--plane-color:var(--'+topColor+')">✈</span>'+
    '<div class="side-tallies">'+tallies.map(color => '<i style="--tally:var(--'+color+')"></i>').join('')+'</div>'+
    '<span class="side-plane bottom" style="--plane-color:var(--'+bottomColor+')">✈</span>'+
  '</div>';
}

function makeBoard(){
  board.innerHTML =
    sidePanel('left','yellow','red',['yellow','yellow','yellow','yellow','red','red','red','blue','blue','blue'])+
    sidePanel('right','blue','green',['blue','blue','blue','blue','blue','green','green','green','green','green'])+
    '<div class="playfield" id="playfield"></div>';
  playfield = document.querySelector('#playfield');

  colors.forEach(color => {
    const base = document.createElement('div');
    base.className = 'base '+color.id;
    base.innerHTML = '<strong class="base-mark">'+color.name+'机场</strong>'+'<i class="hangar">✈</i>'.repeat(4);
    playfield.append(base);
  });

  colors.forEach(color => {
    const pad = document.createElement('div');
    pad.className = 'launch-pad '+color.id;
    pad.style.left = color.launch[0]+'%';
    pad.style.top = color.launch[1]+'%';
    pad.style.setProperty('--launch-rotation',color.launchRotation+'deg');
    pad.innerHTML = '<span>✈</span><b>起飞</b>';
    pad.title = color.name+'独立起飞位';
    pad.setAttribute('aria-label',color.name+'独立起飞位');
    playfield.append(pad);
  });

  const svgNS = 'http://www.w3.org/2000/svg';
  const routeSvg = document.createElementNS(svgNS,'svg');
  routeSvg.classList.add('route-underlay');
  routeSvg.setAttribute('viewBox','0 0 100 100');
  routeSvg.setAttribute('preserveAspectRatio','none');
  const routePoints = path.concat([path[0]]).map(point => point[0]+','+point[1]).join(' ');
  ['route-outline','route-fill'].forEach(className => {
    const line = document.createElementNS(svgNS,'polyline');
    line.setAttribute('class',className);
    line.setAttribute('points',routePoints);
    routeSvg.append(line);
  });
  colors.forEach(color => {
    const connector = document.createElementNS(svgNS,'line');
    connector.setAttribute('class','launch-connector '+color.id);
    connector.setAttribute('x1',color.launch[0]);
    connector.setAttribute('y1',color.launch[1]);
    connector.setAttribute('x2',path[color.start][0]);
    connector.setAttribute('y2',path[color.start][1]);
    routeSvg.append(connector);
  });
  playfield.append(routeSvg);

  const tilePalette = ['blue','green','red','yellow'];

  path.forEach(([x,y],index) => {
    const cell = document.createElement('div');
    cell.className = 'cell '+tilePalette[index % tilePalette.length]+(index===colors.find(color => color.id==='red').start ? ' red-entry' : '');
    cell.style.left = x+'%';
    cell.style.top = y+'%';
    playfield.append(cell);
  });

  colors.forEach(color => finishPath[color.id].forEach(([x,y]) => {
    const cell = document.createElement('div');
    cell.className = 'cell home '+((color.id==='red'||color.id==='blue')?'vertical ':'horizontal ')+color.id;
    cell.style.left = x+'%';
    cell.style.top = y+'%';
    playfield.append(cell);
  }));

  [['red','horizontal'],['green','horizontal'],['blue','vertical'],['yellow','vertical']].forEach(([color,direction]) => {
    const shortcut = document.createElement('i');
    shortcut.className = 'shortcut '+color+' '+direction;
    playfield.append(shortcut);
  });

  const goal = document.createElement('div');
  goal.className = 'goal';
  goal.textContent = '终点';
  playfield.append(goal);
}

function pos(plane){
  const color = colors.find(item => item.id === plane.color);
  if(plane.progress < 0) return color.base[plane.id];
  if(plane.progress === 0) return color.launch;
  if(plane.progress >= GOAL_PROGRESS) return [50,50];
  if(plane.progress >= HOME_START) return finishPath[plane.color][plane.progress-HOME_START];
  return path[(color.start+plane.progress-1)%path.length];
}

function draw(){
  playfield.querySelectorAll('.plane').forEach(element => element.remove());
  planes.forEach(plane => {
    const [x,y] = pos(plane);
    const element = document.createElement('button');
    element.className = 'plane '+plane.color+(waiting && canMove(plane) ? ' selectable' : '');
    element.style.left = x+'%';
    element.style.top = y+'%';
    element.title = colors.find(color => color.id === plane.color).name+(plane.id+1)+'号机';
    element.textContent = '✈';
    element.onclick = () => move(plane);
    playfield.append(element);
  });
  document.querySelector('#players').innerHTML = colors.map((color,index) =>
    '<div class="player '+(index===current?'active ':'')+color.id+'">'+color.name+' · '+planes.filter(plane => plane.color===color.id && plane.progress>=GOAL_PROGRESS).length+'/4 到达</div>'
  ).join('');
}

function canMove(plane){
  return plane.color===colors[current].id && rolled!==null && (plane.progress<0 ? rolled===6 : plane.progress+rolled<=GOAL_PROGRESS);
}

function tell(text){
  document.querySelector('#status').textContent = text;
  const toast = document.querySelector('#toast');
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'),1600);
}

function roll(){
  if(waiting || gameOver) return;
  rollBtn.disabled = true;
  dice.classList.add('rolling');
  setTimeout(() => {
    rolled = Math.ceil(Math.random()*6);
    dice.textContent = rolled;
    dice.classList.remove('rolling');
    if(!planes.some(canMove)){
      tell(colors[current].name+' 掷出 '+rolled+'，没有可移动的飞机');
      setTimeout(next,700);
    }else{
      waiting = true;
      tell(colors[current].name+' 掷出 '+rolled+'，请选择一架飞机');
      draw();
    }
  },380);
}

function move(plane){
  if(!waiting || !canMove(plane)) return;
  waiting = false;
  plane.progress = plane.progress<0 ? 0 : plane.progress+rolled;
  if(plane.progress>0 && plane.progress<HOME_START){
    const landing = (colors.find(color => color.id===plane.color).start+plane.progress-1)%path.length;
    planes.forEach(other => {
      const otherColor = colors.find(color => color.id===other.color);
      const otherLanding = (otherColor.start+other.progress-1)%path.length;
      if(other.color!==plane.color && other.progress>0 && other.progress<HOME_START && otherLanding===landing) other.progress=-1;
    });
  }
  draw();
  if(planes.filter(item => item.color===plane.color && item.progress>=GOAL_PROGRESS).length===4){
    gameOver = true;
    rollBtn.disabled = true;
    tell('🎉 '+colors[current].name+' 获胜！');
    return;
  }
  if(rolled===6){
    rollBtn.disabled = false;
    tell(colors[current].name+' 掷出 6，再来一次！');
  }else{
    setTimeout(next,300);
  }
}

function next(){
  waiting = false;
  current = (current+1)%4;
  rolled = null;
  rollBtn.disabled = false;
  document.querySelector('#turnTitle').textContent = colors[current].name;
  tell('轮到'+colors[current].name+'掷骰子');
  draw();
}

function reset(){
  current = 0;
  rolled = null;
  waiting = false;
  gameOver = false;
  planes = colors.flatMap(color => Array.from({length:4},(_,id) => ({color:color.id,id,progress:-1})));
  dice.textContent = '?';
  rollBtn.disabled = false;
  document.querySelector('#turnTitle').textContent = '红方';
  tell('新游戏开始，红方先行');
  draw();
}

makeBoard();
reset();
rollBtn.onclick = roll;
document.querySelector('#restartBtn').onclick = reset;
