/* ==============================================================
 * card_effect.js  —— v4.9
 * --------------------------------------------------------------
 *   • 棋形卡 1–12：支援正確旋轉（象、尖、飛、L、閃電、Y、ㄒ 均已修正）
 *   • 功能牌 13–24：僅做 cost／needDir 定義，效果交給後端
 *   • 魔法牌 25–47：
 *       - 25 / 26 / 27 / 28 / 35 / 40 / 41 / 46 / 47 可在前端試算落點
 *       - 其餘魔法牌先定義 cost，效果交由伺服器權威處理
 *   • 其他未實作編號：預設「單點・能量 1」
 * ============================================================ */

/* === 旋轉序列（0°→90°→180°→270°） === */
const DIR_ORDER = ['r0', 'r90', 'r180', 'r270'];

/* === 基礎工具 === */
const copy   = b => b.map(r => r.slice());                         // 深複製 2D 棋盤
const inside = (b, x, y) => y >= 0 && y < b.length && x >= 0 && x < b[0].length;
const rotateCW = ([dx, dy]) => [-dy, dx];                          // 螢幕座標順時針 90°

/* ---------- 工具：可旋轉固定圖形 ---------- */
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

/* ==================================================
 *                卡牌效果主表
 * ================================================== */
export const CARD_EFFECTS = (() => {
  const effects = {};

  /* ---------- 基本：單點落子 ---------- */
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

  /* ---------- 直 / 橫連兩子 ---------- */
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

  /* ---------- 45° 相鄰兩子（尖） ---------- */
  const makeTip = cost => makeRotPattern([[0, 0], [1, 1]], cost);

  /* ---------- 跳（gap = 中空格數） ---------- */
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

  /* ---------- Knight (飛) ─ 8 向 ---------- */
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

  /* ---------- 1–12 棋形卡 ---------- */
  effects[1]  = single(1);
  effects[2]  = makeLine2(2);
  effects[3]  = makeTip(2);
  effects[4]  = makeJump(1, 2);
  effects[5]  = makeJump(2, 2);
  effects[6]  = makeKnight(2);
  effects[7]  = makeRotPattern([[0,0],[2,2]], 2);
  effects[8]  = makeRotPattern([[0,0],[1,0],[2,0],[2,1]], 4);
  effects[9]  = makeRotPattern([[0,0],[1,0],[1,1],[2,1]], 4);
  effects[10] = makeRotPattern([[-1,-1],[1,-1],[0,2],[0,1]], 4);
  effects[11] = makeRotPattern([[-1,0],[0,0],[1,0],[0,1]], 4);

  /* ---------- 12 投石器 ---------- */
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

  /* ---------- 13–24（功能牌：純定義） ---------- */
  [
    [13,1],[14,0],[15,4],[16,4],[17,3],[18,5],
    [19,1],[20,5],[21,4],[22,4],[23,3],[24,2]
  ].forEach(([id,cost]) => {
    effects[id] = { cost, needDir:false, effect:()=>({ok:true}) };
  });

  /* ============================================================
   *      前端即可試算落點的魔法   25,26,27,28,35,40,41,46,47
   * ============================================================ */

  // 25 斗轉星移 --------------------------------------------------
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

  // 26 爆破魔法：3×3 破壞 ---------------------------------------
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

  // 27 聖火：整行 / 整列破壞 ------------------------------------
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

  // 28 流星群：3 個隨機 3×3 ------------------------------------
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

  // 35 咬：拔除 1 顆敵子 ----------------------------------------
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

  // 40 感化：單點敵子變己子 -------------------------------------
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

  // 41 洗腦：己子中心 3×3 轉化 ----------------------------------
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

  // 46 能量恢復劑 ----------------------------------------------
  effects[46] = { cost:0, needDir:false, effect:()=>({ok:true,energyDelta:+2}) };

  // 47 能量恢復劑（強）-----------------------------------------
  effects[47] = { cost:2, needDir:false, effect:()=>({ok:true,energyDelta:(Math.random()*6|0)+1}) };

  /* ---------- 29~34,36~39,42~44 先定義 cost，效果後端處理 ----- */
  [
    [29,6],[30,3],[31,3],[32,4],[33,6],[34,4],
    [36,6],[37,4],[38,4],[39,4],[42,2],[43,3],[44,2]
  ].forEach(([id,cost])=>{
    effects[id]={cost,needDir:false,effect:()=>({ok:true})};
  });

  /* ---------- 其餘未定義：單點 1 能 -------------------------- */
  Array.from({length:56},(_,i)=>i+1).forEach(id=>{
    effects[id] ??= single(1);
  });

  return effects;
})();
