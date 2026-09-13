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
export function createState({ mode = 'ai', count = 4 } = {}) {
  const ids = count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  return { players: ids.map((id, i) => ({ id, name: mode === 'ai' ? (i === 0 ? '你' : `电脑 ${i}`) : `玩家 ${i + 1}`, ai: mode === 'ai' && i > 0, pieces: [-1,-1,-1,-1] })), current: 0, die: null, phase: 'roll', winner: null, turn: 1, moves: 0 };
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
  state.die = value;
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
export function move(state, piece) {
  if (!legalPieces(state).includes(piece)) return null;
  const player = state.players[state.current];
  const result = previewMove(player.pieces[piece], state.die);
  result.from = player.pieces[piece];
  result.captured = [];
  // Only landing squares collide. Ordinary transit and flight crossings are safe.
  const landing = [result.route[Math.min(state.die, result.route.length) - 1], result.target];
  for (const p of new Set(landing)) {
    if (p === 0 || p > 50) continue;
    for (const enemy of state.players) {
      if (enemy.id === player.id) continue;
      enemy.pieces.forEach((enemyP, i) => {
        if (enemyP > 0 && enemyP <= 50 && globalIndex(enemy, enemyP) === globalIndex(player, p)) {
          enemy.pieces[i] = -1;
          result.captured.push({ player: enemy.id, piece: i });
        }
      });
    }
  }
  player.pieces[piece] = result.target;
  state.moves++;
  if (player.pieces.every(p => p === FINISH)) { state.winner = player.id; state.phase = 'won'; }
  else state.phase = 'moving';
  return result;
}
export function endTurn(state) {
  if (state.phase === 'won') return;
  if (state.phase === 'roll' || (state.phase === 'choose' && legalPieces(state).length)) return;
  if (state.die !== 6) { state.current = (state.current + 1) % state.players.length; state.turn++; }
  state.die = null;
  state.phase = 'roll';
}
export function chooseAI(state) {
  const player = state.players[state.current];
  return legalPieces(state).map(piece => {
    const p = player.pieces[piece], result = previewMove(p, state.die);
    let score = result.target === FINISH ? 1000 : result.target + (p === -1 ? 30 : 0) + (result.flight ? 35 : 0);
    for (const enemy of state.players) if (enemy.id !== player.id) {
      for (const enemyP of enemy.pieces) if (result.target > 0 && result.target <= 50 && enemyP > 0 && enemyP <= 50 && globalIndex(enemy, enemyP) === globalIndex(player, result.target)) score += 70;
    }
    return { piece, score };
  }).sort((a,b) => b.score - a.score)[0]?.piece;
}
