/* card_effect.js  —— v4.4  (unify 尖‧飛‧象 with 跳 behavior)
 * -------------------------------------------------------------
 *  ✔ 2「長」  dirs:['h','v']                     ─ 直↔橫
 *  ✔ 3「尖」  dirs:['diag1','diag2']             ─ ↘ ↗
 *  ✔ 4,5 跳   dirs:['h','v','diag1','diag2']     ─ 最完整
 *  ✔ 6「飛」  dirs:['ur','ru','ul','lu','dr','rd','dl','ld']  ─ 馬步 8 向
 *  ✔ 7「象」  dirs:['diag1','diag2','diag3','diag4']          ─ 田字對角四向
 * -------------------------------------------------------------
 *  即時可算卡：25,26,27,28,35,40,41,46,47
 * -------------------------------------------------------------
 */

export const CARD_EFFECTS = (() => {
  const effects = {};

  /* ---------- 共用工具 ---------- */
  const copy   = b => b.map(r => r.slice());
  const inside = (b,x,y) => y>=0&&y<b.length&&x>=0&&x<b[0].length;

  /* ---------- 基本模板 ---------- */
  const single = cost => ({
    cost, needDir:false,
    effect:(board,color,{anchor})=>{
      if(!anchor) return{ok:false};
      const {x,y}=anchor;
      if(!inside(board,x,y)||board[y][x]!==0) return{ok:false};
      const nb=copy(board); nb[y][x]=color;
      return{ok:true,board:nb};
    }
  });

  /* ---------- 直 or 橫 兩子 ---------- */
  const makeLine2 = cost => ({
    cost, needDir:true, dirs:['h','v'],
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={h:[1,0],v:[0,1]};
      const vec=map[dir]; if(!vec) return{ok:false};
      const {x,y}=anchor, [dx,dy]=vec, x2=x+dx, y2=y+dy;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c;
      return{ok:true,board:nb};
    }
  });

  /* ---------- 45° 相鄰兩子 (尖) ---------- */
  const makeDiagAdjacent = cost => ({
    cost, needDir:true, dirs:['diag1','diag2'],
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={diag1:[1,1],diag2:[1,-1]};
      const vec=map[dir]; if(!vec) return{ok:false};
      const {x,y}=anchor, [dx,dy]=vec, x2=x+dx, y2=y+dy;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c;
      return{ok:true,board:nb};
    }
  });

  /* ---------- 跳類 (中空 gap) ---------- */
  const makeJump = (gap,cost) => ({
    cost, needDir:true, dirs:['h','v','diag1','diag2'],
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={h:[1,0],v:[0,1],diag1:[1,1],diag2:[1,-1]};
      const vec=map[dir]; if(!vec) return{ok:false};
      const {x,y}=anchor, [dx,dy]=vec,
            xm=x+dx, ym=y+dy,
            x2=x+dx*(gap+1), y2=y+dy*(gap+1);
      if(!inside(b,x2,y2)||b[y][x]||b[ym][xm]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c;
      return{ok:true,board:nb};
    }
  });

  /* ---------- Knight L 形 (飛) ---------- */
  const makeKnight = cost => ({
    cost, needDir:true,
    dirs:['ur','ru','ul','lu','dr','rd','dl','ld'],
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={
        ur:[ 1,-2], ru:[ 2,-1], ul:[-1,-2], lu:[-2,-1],
        dr:[ 1, 2], rd:[ 2, 1], dl:[-1, 2], ld:[-2, 1]
      };
      const vec=map[dir]; if(!vec) return{ok:false};
      const {x,y}=anchor, [dx,dy]=vec, x2=x+dx, y2=y+dy;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c;
      return{ok:true,board:nb};
    }
  });

  /* ---------- 田字對角 (象) ---------- */
  const makeElephant = cost => ({
    cost, needDir:true, dirs:['diag1','diag2','diag3','diag4'],
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={
        diag1:[ 1, 1],  // ↘
        diag2:[ 1,-1],  // ↗
        diag3:[-1, 1],  // ↙
        diag4:[-1,-1]   // ↖
      };
      const vec=map[dir]; if(!vec) return{ok:false};
      const {x,y}=anchor, [dx,dy]=vec, x2=x+dx, y2=y+dy;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c;
      return{ok:true,board:nb};
    }
  });

  const makePattern = (pts,cost)=>({
    cost, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return{ok:false};
      const abs=pts.map(([dx,dy])=>[anchor.x+dx,anchor.y+dy]);
      if(abs.some(([x,y])=>!inside(b,x,y)||b[y][x])) return{ok:false};
      return{ok:true,board:nb};
    }
  });

  /* ---------- 棋形卡 (1‒12) ---------- */
  effects[1]  = single(1);            // 棋
  effects[2]  = makeLine2(2);         // 長
  effects[3]  = makeDiagAdjacent(2);  // 尖
  effects[4]  = makeJump(1,2);        // 跳
  effects[5]  = makeJump(2,2);        // 大跳
  effects[6]  = makeKnight(2);        // 飛
  effects[7]  = makeElephant(2);      // 象
  effects[8]  = makePattern([[0,0],[1,0],[2,0],[2,1]],4);           // L
  effects[9]  = makePattern([[0,0],[1,0],[1,1],[2,1]],4);           // 閃電
  effects[10] = makePattern([[0,0],[-1,1],[0,1],[1,1]],4);          // Y
  effects[11] = makePattern([[-1,0],[0,0],[1,0],[0,1]],4);          // ㄒ

  /* ---------- 12 投石器 ---------- */
  effects[12] = {
    cost:5, needDir:false,
    effect:(b,c)=>{
      const empty=[]; for(let y=0;y<b.length;y++) for(let x=0;x<b[0].length;x++)
        if(!b[y][x]) empty.push([x,y]);
      if(empty.length<5) return{ok:false};
      const nb=copy(b);
      for(let i=0;i<5;i++){
        const idx=Math.random()*empty.length|0;
        const [x,y]=empty.splice(idx,1)[0];
        nb[y][x]=c;
      }
      return{ok:true,board:nb};
    }
  };

  /* ---------- 即時可算卡 (25,26,27,28,35,40,41,46,47) ---------- */
  // 25 斗轉星移：交換 2 棋子
  effects[25] = {
    cost:3, needDir:false,
    effect:(b,c,{src,dst})=>{
      if(!src||!dst) return{ok:false};
      const {x:sx,y:sy}=src,{x:dx,y:dy}=dst;
      if(!inside(b,sx,sy)||!inside(b,dx,dy)) return{ok:false};
      if(b[sy][sx]!==c||b[dy][dx]===0||b[dy][dx]===c) return{ok:false};
      const nb=copy(b); const tmp=nb[sy][sx]; nb[sy][sx]=nb[dy][dx]; nb[dy][dx]=tmp;
      return{ok:true,board:nb};
    }
  };

  // 26 爆破：3×3
  effects[26] = {
    cost:5, needDir:false,
    effect:(b,_,{anchor})=>{
      if(!anchor) return{ok:false};
      const nb=copy(b);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const x=anchor.x+dx, y=anchor.y+dy;
        if(inside(b,x,y)) nb[y][x]=0;
      }
      return{ok:true,board:nb};
    }
  };

  // 27 聖火：一整行 / 列
  effects[27] = {
    cost:4, needDir:true, dirs:['h','v'],
    effect:(b,_,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const nb=copy(b);
      if(dir==='h')      for(let x=0;x<b[0].length;x++) nb[anchor.y][x]=0;
      else if(dir==='v') for(let y=0;y<b.length;y++)   nb[y][anchor.x]=0;
      else return{ok:false};
      return{ok:true,board:nb};
    }
  };

  // 28 流星群：三個 3×3
  effects[28] = {
    cost:4, needDir:false,
    effect:(b)=>{
      const nb=copy(b);
      for(let n=0;n<3;n++){
        const ax=Math.floor(Math.random()*(b[0].length-2))+1;
        const ay=Math.floor(Math.random()*(b.length-2))+1;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) nb[ay+dy][ax+dx]=0;
      }
      return{ok:true,board:nb};
    }
  };

  // 35 咬
  effects[35] = {
    cost:2, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return{ok:false};
      const {x,y}=anchor;
      if(!inside(b,x,y)||!b[y][x]||b[y][x]===c) return{ok:false};
      const nb=copy(b); nb[y][x]=0;
      return{ok:true,board:nb};
    }
  };

  // 40 感化
  effects[40] = {
    cost:3, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return{ok:false};
      const {x,y}=anchor;
      if(!inside(b,x,y)||b[y][x]!==3-c) return{ok:false};
      const nb=copy(b); nb[y][x]=c;
      return{ok:true,board:nb};
    }
  };

  // 41 洗腦
  effects[41] = {
    cost:6, needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return{ok:false};
      const {x,y}=anchor;
      if(!inside(b,x,y)||b[y][x]!==c) return{ok:false};
      const nb=copy(b);
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const xx=x+dx, yy=y+dy;
        if(inside(b,xx,yy)&&b[yy][xx]===3-c) nb[yy][xx]=c;
      }
      return{ok:true,board:nb};
    }
  };

  // 46 / 47 能量
  effects[46] = { cost:0, needDir:false, effect:() => ({ok:true,energyDelta:+2}) };
  effects[47] = { cost:2, needDir:false, effect:() => ({ok:true,energyDelta:Math.floor(Math.random()*6)+1}) };

  /* ---------- 佔位卡 ---------- */
  [
    13,14,15,16,17,18,19,20,21,22,23,24,
    29,30,31,32,33,34,36,37,38,39,42,43,44,45,
    48,49,50,51,52,53,54,55,56
  ].forEach(id => { effects[id] ??= single(1); });

  return effects;
})();