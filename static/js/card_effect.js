const DIR_ORDER = ['r0', 'r90', 'r180', 'r270'];

const copy   = b => b.map(r => r.slice());
const inside = (b, x, y) => y >= 0 && y < b.length && x >= 0 && x < b[0].length;
const rotateCW = ([dx, dy]) => [-dy, dx];

const makeRotPattern = (basePts, cost) => ({
  cost,
  needDir: true,
  dirs: DIR_ORDER,
  effect: (b, c, { anchor, dir }) => {
    if (!anchor || !dir) return { ok: false };
    const rot = DIR_ORDER.indexOf(dir);
    if (rot === -1) return { ok: false };

    let pts = basePts;
    for (let i = 0; i < rot; i++) pts = pts.map(rotateCW);

    const nb = copy(b);
    for (const [dx, dy] of pts) {
      const x = anchor.x + dx, y = anchor.y + dy;
      if (!inside(b, x, y) || nb[y][x]) return { ok: false };
      nb[y][x] = c;
    }
    return { ok: true, board: nb };
  }
});

export const CARD_EFFECTS = (() => {
  const effects = {};

  const single = cost => ({
    cost, needDir: false,
    effect: (b, c, { anchor }) => {
      if (!anchor) return { ok: false };
      const { x, y } = anchor;
      if (!inside(b, x, y) || b[y][x]) return { ok: false };
      const nb = copy(b); nb[y][x] = c;
      return { ok: true, board: nb };
    }
  });

  const makeLine2 = cost => ({
    cost, needDir: true, dirs: ['h', 'v'],
    effect: (b, c, { anchor, dir }) => {
      if (!anchor || !dir) return { ok: false };
      const vec = dir === 'h' ? [1, 0] : [0, 1];
      const { x, y } = anchor, [dx, dy] = vec,
            x2 = x + dx, y2 = y + dy;
      if (!inside(b, x2, y2) || b[y][x] || b[y2][x2]) return { ok: false };
      const nb = copy(b); nb[y][x] = nb[y2][x2] = c;
      return { ok: true, board: nb };
    }
  });

  const makeTip = cost => makeRotPattern([[0, 0], [1, 1]], cost);

  const makeJump = (gap, cost) => ({
    cost,
    needDir: true,
    dirs: ['h', 'v', 'diag1', 'diag2'],
    effect: (b, c, { anchor, dir }) => {
      if (!anchor || !dir) return { ok: false };
      const map = { h: [1, 0], v: [0, 1], diag1: [1, 1], diag2: [1, -1] };
      const vec = map[dir]; if (!vec) return { ok: false };

      const { x, y } = anchor, [dx, dy] = vec,
            xm = x + dx,   ym = y + dy,
            x2 = x + dx * (gap + 1), y2 = y + dy * (gap + 1);
      if (!inside(b, x2, y2) || b[y][x] || b[ym][xm] || b[y2][x2]) return { ok: false };

      const nb = copy(b); nb[y][x] = nb[y2][x2] = c;
      return { ok: true, board: nb };
    }
  });

  const makeKnight = cost => ({
    cost,
    needDir: true,
    dirs: ['ur', 'ru', 'ul', 'lu', 'dr', 'rd', 'dl', 'ld'],
    effect: (b, c, { anchor, dir }) => {
      if (!anchor || !dir) return { ok: false };
      const m = {
        ur: [1, -2], ru: [2, -1], ul: [-1, -2], lu: [-2, -1],
        dr: [1,  2], rd: [2,  1], dl: [-1,  2], ld: [-2,  1]
      };
      const vec = m[dir]; if (!vec) return { ok: false };
      const { x, y } = anchor, [dx, dy] = vec,
            x2 = x + dx, y2 = y + dy;
      if (!inside(b, x2, y2) || b[y][x] || b[y2][x2]) return { ok: false };
      const nb = copy(b); nb[y][x] = nb[y2][x2] = c;
      return { ok: true, board: nb };
    }
  });

  effects[1]  = single(1);
  effects[2]  = makeLine2(2);
  effects[3]  = makeTip(2);
  effects[4]  = makeJump(1, 2);
  effects[5]  = makeJump(2, 2);
  effects[6]  = makeKnight(2);
  effects[7]  = makeRotPattern([[0,0],[2,2]], 2);
  effects[8]  = makeRotPattern([[0,0],[1,0],[2,0],[2,1]], 4);
  effects[9]  = makeRotPattern([[0,0],[1,0],[1,1],[2,1]], 4);
  effects[10] = makeRotPattern([[-1,-1],[1,-1],[0,0],[0,1]], 4);
  effects[11] = makeRotPattern([[-1,0],[0,0],[1,0],[0,1]], 4);

  effects[12] = {
    cost: 5,
    needDir: false,
    effect: (b, c) => {
      const empty = [];
      for (let y = 0; y < b.length; y++)
        for (let x = 0; x < b[0].length; x++)
          if (!b[y][x]) empty.push([x, y]);
      if (empty.length < 5) return { ok: false };
      const nb = copy(b);
      for (let i = 0; i < 5; i++) {
        const idx = Math.random() * empty.length | 0;
        const [ex, ey] = empty.splice(idx, 1)[0];
        nb[ey][ex] = c;
      }
      return { ok: true, board: nb };
    }
  };

  [
    [13,1],[14,0],[15,4],[16,4],[17,3],[18,5],
    [19,1],[20,5],[21,4],[22,4],[23,3],[24,2]
  ].forEach(([id,cost]) => {
    effects[id] = { cost, needDir:false, effect:()=>({ok:true}) };
  });

  effects[25] = {
    cost: 3, needDir: false,
    effect: (b, c, { src, dst }) => {
      if (!src || !dst) return { ok:false };
      const {x:sx,y:sy} = src, {x:dx,y:dy} = dst;
      if (!inside(b,sx,sy)||!inside(b,dx,dy)) return { ok:false };
      if (b[sy][sx]!==c || b[dy][dx]===0 || b[dy][dx]===c) return { ok:false };
      const nb = copy(b);
      [nb[sy][sx], nb[dy][dx]] = [nb[dy][dx], nb[sy][sx]];
      return { ok:true, board:nb };
    }
  };

  effects[26] = {
    cost:5, needDir:false,
    effect:(b,_,{anchor})=>{
      if(!anchor) return {ok:false};
      const nb=copy(b);
      for(let dy=-1;dy<=1;dy++)
        for(let dx=-1;dx<=1;dx++){
          const x=anchor.x+dx,y=anchor.y+dy;
          if(inside(b,x,y)) nb[y][x]=0;
        }
      return {ok:true,board:nb};
    }
  };

  effects[27] = {
    cost:4, needDir:true, dirs:['h','v'],
    effect:(b,_,{anchor,dir})=>{
      if(!anchor||!dir) return {ok:false};
      const nb=copy(b);
      if(dir==='h')     for(let x=0;x<b[0].length;x++) nb[anchor.y][x]=0;
      else if(dir==='v')for(let y=0;y<b.length;y++)    nb[y][anchor.x]=0;
      else return {ok:false};
      return {ok:true,board:nb};
    }
  };

  effects[28] = {
    cost:4, needDir:false,
    effect:b=>{
      const nb=copy(b);
      for(let n=0;n<3;n++){
        const ax = 1 + (Math.random()*(b[0].length-2)|0);
        const ay = 1 + (Math.random()*(b.length-2)|0);
        for(let dy=-1;dy<=1;dy++)
          for(let dx=-1;dx<=1;dx++)
            nb[ay+dy][ax+dx]=0;
      }
      return {ok:true,board:nb};
    }
  };

  effects[35] = {
    cost:2, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return {ok:false};
      const {x,y}=anchor;
      if(!inside(b,x,y)||b[y][x]===0||b[y][x]===c) return {ok:false};
      const nb=copy(b); nb[y][x]=0;
      return {ok:true,board:nb};
    }
  };

  effects[40] = {
    cost:3, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return {ok:false};
      const {x,y}=anchor;
      if(!inside(b,x,y)||b[y][x]!==3-c) return {ok:false};
      const nb=copy(b); nb[y][x]=c;
      return {ok:true,board:nb};
    }
  };

  effects[41] = {
    cost:6, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return {ok:false};
      const {x,y}=anchor;
      if(!inside(b,x,y)||b[y][x]!==c) return {ok:false};
      const nb=copy(b);
      for(let dy=-1;dy<=1;dy++)
        for(let dx=-1;dx<=1;dx++){
          const xx=x+dx,yy=y+dy;
          if(inside(b,xx,yy)&&nb[yy][xx]===3-c) nb[yy][xx]=c;
        }
      return {ok:true,board:nb};
    }
  };

  effects[46] = { cost:0, needDir:false, effect:()=>({ok:true,energyDelta:+2}) };

  effects[47] = { cost:2, needDir:false, effect:()=>({ok:true,energyDelta:(Math.random()*6|0)+1}) };

  [
    [45,2],
    [48,5],
    [49,4],
    [50,4]
  ].forEach(([id,cost])=>{
    effects[id]={cost,needDir:false,effect:()=>({ok:true})};
  });

  [
    [29,6],[30,3],[31,3],[32,4],[33,6],[34,4],
    [36,6],[37,4],[38,4],[39,4],[42,2],[43,3],[44,2]
  ].forEach(([id,cost])=>{
    effects[id] ??= {cost,needDir:false,effect:()=>({ok:true})};
  });

  Array.from({length:56},(_,i)=>i+1).forEach(id=>{
    effects[id] ??= single(1);
  });

  return effects;
})();
