/* card_effect.js  —— v4  (1 – 56)
 * -------------------------------------------------------------
 *  ✔ 1 – 12  棋形卡：立即在前端計算並回傳新 board
 *  ✔ 25,26,27,28,35,40,41,46,47：立即可計算的功能／魔法／特殊
 *  ✖ 其餘功能複雜、需跨回合或後端資料 → 先以「單點落子」佔位
 *      佔位卡 id：13‒24,29‒34,36‒39,42‒45,48‒50,51‒56
 *      其效果請移至伺服器後端實作
 * -------------------------------------------------------------
 *  回傳格式：
 *    { ok, board?, energyDelta? }   // 若沒有變動的欄位可省略
 * -------------------------------------------------------------*/

export const CARD_EFFECTS = (() => {
  const effects = {};

  /* ---------- 工具 ---------- */
  const copy = b => b.map(r => r.slice());
  const inside = (b,x,y) => y>=0&&y<b.length&&x>=0&&x<b[0].length;

  /* ---------- 基本模板 ---------- */
  const single = cost => ({
    cost,
    needDir:false,
    effect:(board,color,{anchor})=>{
      if(!anchor) return{ok:false};
      const {x,y}=anchor;
      if(!inside(board,x,y)||board[y][x]!==0) return{ok:false};
      const nb=copy(board); nb[y][x]=color;
      return{ok:true,board:nb};
    }
  });
  const makeLine2 = cost => ({
    cost,
    needDir:true,
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={h:[1,0],v:[0,1]};
      const [dx,dy]=map[dir]||[]; if(dx==null) return{ok:false};
      const {x,y}=anchor, x2=x+dx,y2=y+dy;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c; return{ok:true,board:nb};
    }
  });
  const makeDiag2 = cost => ({
    cost,
    needDir:true,
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={diag1:[1,1],diag2:[1,-1]};
      const [dx,dy]=map[dir]||[]; if(dx==null) return{ok:false};
      const {x,y}=anchor, x2=x+dx,y2=y+dy;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2]) return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c; return{ok:true,board:nb};
    }
  });
  const makeJump = (gap,cost) => ({
    cost,
    needDir:true,
    effect:(b,c,{anchor,dir})=>{
      if(!anchor||!dir) return{ok:false};
      const map={h:[1,0],v:[0,1],diag1:[1,1],diag2:[1,-1]};
      const [dx,dy]=map[dir]||[]; if(dx==null) return{ok:false};
      const {x,y}=anchor, xm=x+dx,ym=y+dy, x2=x+dx*(gap+1),y2=y+dy*(gap+1);
      if(!inside(b,x2,y2)||b[y][x]||b[ym][xm]||b[y2][x2])return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c; return{ok:true,board:nb};
    }
  });
  const makeFly = cost => ({
    cost,
    needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return{ok:false};
      const {x,y}=anchor, x2=x+1,y2=y+1;
      if(!inside(b,x2,y2)||b[y][x]||b[y2][x2])return{ok:false};
      const nb=copy(b); nb[y][x]=nb[y2][x2]=c; return{ok:true,board:nb};
    }
  });
  const makePattern = (pts,cost)=>({
    cost,
    needDir:false,
    effect:(b,c,{anchor})=>{
      if(!anchor) return{ok:false};
      const abs=pts.map(([dx,dy])=>[anchor.x+dx,anchor.y+dy]);
      if(abs.some(([x,y])=>!inside(b,x,y)||b[y][x]))return{ok:false};
      const nb=copy(b); abs.forEach(([x,y])=>nb[y][x]=c); return{ok:true,board:nb};
    }
  });

  /* ---------- 棋形卡 (1‒12) ---------- */
  effects[1]=single(1);
  effects[2]=makeLine2(2);
  effects[3]=makeDiag2(2);
  effects[4]=makeJump(1,2);
  effects[5]=makeJump(2,2);
  effects[6]=makeFly(2);
  // 象 (田字對角)
  effects[7]=makePattern([[0,0],[1,1]],2);
  // L
  effects[8]=makePattern([[0,0],[1,0],[2,0],[2,1]],4);
  // 閃電 (Z)
  effects[9]=makePattern([[0,0],[1,0],[1,1],[2,1]],4);
  // Y
  effects[10]=makePattern([[0,0],[-1,1],[0,1],[1,1]],4);
  // ㄒ (T)
  effects[11]=makePattern([[-1,0],[0,0],[1,0],[0,1]],4);
  // 投石器：隨機 5 顆
  effects[12]={cost:5,needDir:false,effect:(b,c)=>{
    const empty=[]; for(let y=0;y<b.length;y++) for(let x=0;x<b[0].length;x++) if(!b[y][x]) empty.push([x,y]);
    if(empty.length<5) return{ok:false};
    const nb=copy(b); for(let i=0;i<5;i++){const idx=Math.random()*empty.length|0;const [x,y]=empty.splice(idx,1)[0];nb[y][x]=c;} 
    return{ok:true,board:nb}; }};

  /* ---------- 即時可算功能 / 魔法 / 特殊 ---------- */
  // 25 斗轉星移：交換 2 棋子 (需 src/ dst 參數)
  effects[25]={cost:3,needDir:false,effect:(b,c,{src,dst})=>{
    if(!src||!dst) return{ok:false};
    const {x:sx,y:sy}=src,{x:dx,y:dy}=dst;
    if(!inside(b,sx,sy)||!inside(b,dx,dy))return{ok:false};
    if(b[sy][sx]!==c||b[dy][dx]===0||b[dy][dx]===c) return{ok:false};
    const nb=copy(b); const tmp=nb[sy][sx]; nb[sy][sx]=nb[dy][dx]; nb[dy][dx]=tmp;
    return{ok:true,board:nb}; }};

  // 26 爆破：破壞 3x3
  effects[26]={cost:5,needDir:false,effect:(b,_,{anchor})=>{
    if(!anchor) return{ok:false}; const nb=copy(b);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const x=anchor.x+dx,y=anchor.y+dy; if(inside(b,x,y)) nb[y][x]=0;
    }
    return{ok:true,board:nb}; }};

  // 27 聖火：破壞一整行 (dir h/v 必填)
  effects[27]={cost:4,needDir:true,effect:(b,_,{anchor,dir})=>{
    if(!anchor||!dir) return{ok:false}; const nb=copy(b);
    if(dir==='h') for(let x=0;x<b[0].length;x++) nb[anchor.y][x]=0;
    else if(dir==='v') for(let y=0;y<b.length;y++) nb[y][anchor.x]=0;
    else return{ok:false};
    return{ok:true,board:nb}; }};

  // 28 流星群：隨機 3 個 3x3 破壞
  effects[28]={cost:4,needDir:false,effect:(b)=>{
    const nb=copy(b);
    for(let n=0;n<3;n++){
      const ax=Math.floor(Math.random()*(b[0].length-2))+1;
      const ay=Math.floor(Math.random()*(b.length-2))+1;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) nb[ay+dy][ax+dx]=0;
    }
    return{ok:true,board:nb}; }};

  // 35 咬：破壞 1 顆敵棋 (anchor 目標)
  effects[35]={cost:2,needDir:false,effect:(b,c,{anchor})=>{
    if(!anchor) return{ok:false}; const {x,y}=anchor; if(!inside(b,x,y)||!b[y][x]||b[y][x]===c) return{ok:false};
    const nb=copy(b); nb[y][x]=0; return{ok:true,board:nb}; }};

  // 40 感化：將敵棋變友
  effects[40]={cost:3,needDir:false,effect:(b,c,{anchor})=>{
    if(!anchor) return{ok:false}; const {x,y}=anchor; if(!inside(b,x,y)||b[y][x]!==3-c) return{ok:false};
    const nb=copy(b); nb[y][x]=c; return{ok:true,board:nb}; }};

  // 41 洗腦：以己棋為中心轉化周圍 8 格敵棋
  effects[41]={cost:6,needDir:false,effect:(b,c,{anchor})=>{
    if(!anchor) return{ok:false}; const {x,y}=anchor; if(!inside(b,x,y)||b[y][x]!==c) return{ok:false};
    const nb=copy(b);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      if(dx===0&&dy===0)continue; const xx=x+dx,yy=y+dy; if(inside(b,xx,yy)&&b[yy][xx]===3-c) nb[yy][xx]=c;
    }
    return{ok:true,board:nb}; }};

  // 46 能量恢復劑 +2
  effects[46]={cost:0,needDir:false,effect:()=>({ok:true,energyDelta:+2})};
  // 47 強恢復劑 +rand1-6
  effects[47]={cost:2,needDir:false,effect:()=>({ok:true,energyDelta:Math.floor(Math.random()*6)+1})};

  /* ---------- 佔位卡：單點落子 ---------- */
  const placeholderIds=[13,14,15,16,17,18,19,20,21,22,23,24,
    29,30,31,32,33,34,36,37,38,39,42,43,44,45,48,49,50,51,52,53,54,55,56];
  placeholderIds.forEach(id=>{ if(!effects[id]) effects[id]=single(1); });

  return effects;
})();


