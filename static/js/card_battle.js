import { CARD_EFFECTS } from "./card_effect.js";

// ---------- 常數 ----------
const BOARD_SIZE = 19;
const MAX_HAND   = 10;
const DEFAULT_COPIES_EACH = 2;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];          // 探索用

// ---------- 全域狀態 ----------
let canvas, ctx, GRID_SIZE, RADIUS;
let board        = Array.from({length:BOARD_SIZE},()=>Array(BOARD_SIZE).fill(0));
let current      = 1;                               // 1=黑 2=白
let energy       = 3;                               // 起始能量

let handDiv, energySpan, drawBtn, passBtn, resetBtn;
let deckCounts = new Map();     // id → 剩餘張數
let hand = [];                  // id[]

// ── 卡牌出牌流程 ──
let selectedCardId = null;      // 使用者點的手牌 id
let selectedCardEl = null;      // 對應的 DOM
let pendingEffect  = null;      // CARD_EFFECTS[id].effect
let pendingParams  = {};        // { anchor, dir }
let highlightMap   = [];        // [[r,c]...]

// ================================================================
//  作圖 & 事件初始化 (DOMContentLoaded)
// ================================================================
document.addEventListener('DOMContentLoaded',()=>{
  /* 抓 DOM */
  canvas     = document.getElementById('board');
  ctx        = canvas.getContext('2d');
  handDiv    = document.getElementById('hand-zone');
  energySpan = document.getElementById('energy-value');
  drawBtn    = document.getElementById('btn-draw');
  passBtn    = document.getElementById('btn-pass');
  resetBtn   = document.getElementById('btn-reset');

  /* 格尺寸 */
  GRID_SIZE = canvas.width / (BOARD_SIZE + 1);
  RADIUS    = GRID_SIZE * 0.42;

  /* 動態插 CSS 與預覽框 */
  injectHandStyle();
  injectPreviewBox();

  /* 事件 */
  canvas.addEventListener('click', onBoardClick);
  canvas.addEventListener('mousemove', onBoardHover);
  canvas.addEventListener('mouseleave', ()=>{ redraw(); });
  drawBtn.addEventListener('click', ()=> drawCard(current));
  passBtn.addEventListener('click', ()=> endTurn());
  resetBtn.addEventListener('click', resetGame);

  /* 初始化遊戲 */
  initDeck();
  dealInitialHand( current );
  dealInitialHand( 3-current );
  updateEnergy();
  redraw();
});

// ================================================================
//  UI：手牌樣式 / 預覽
// ================================================================
function injectHandStyle(){
  const css = `
    #hand-zone{position:fixed;bottom:48px;left:50%;transform:translateX(-50%);display:flex;gap:16px;z-index:1000;}
    #hand-zone .card{width:160px;height:220px;background-size:cover;background-position:center;border-radius:10px;box-shadow:0 3px 6px rgba(0,0,0,.28);cursor:pointer;transition:transform .18s,box-shadow .18s;}
    #hand-zone .card:hover{transform:translateY(-30px) scale(1.25);box-shadow:0 9px 20px rgba(0,0,0,.4);}
    #hand-zone .card.selected{transform:translateY(-60px) scale(1.45);box-shadow:0 14px 30px rgba(0,0,0,.55);}
    #hand-zone .card .cost{position:absolute;top:4px;right:6px;font:bold 20px/1.1 monospace;color:#fff;text-shadow:0 0 3px #000;}
    #card-preview.show{opacity:1;}
    .dir-panel{position:fixed;display:grid;grid-template-columns:repeat(2,40px);gap:4px;background:#222;padding:6px;border-radius:6px;z-index:2000;}
    .dir-panel button{width:40px;height:40px;color:#fff;background:#444;border:none;border-radius:4px;font-size:18px;cursor:pointer;}
    .dir-panel button:hover{background:#666;}
  `;
  const tag=document.createElement('style');tag.textContent=css;document.head.appendChild(tag);
}
function injectPreviewBox(){
  if(document.getElementById('card-preview'))return;
  const box=document.createElement('div');box.id='card-preview';Object.assign(box.style,{position:'fixed',bottom:'12px',right:'12px',width:'160px',height:'240px',backgroundSize:'cover',borderRadius:'10px',boxShadow:'0 4px 12px rgba(0,0,0,.4)',opacity:0,transition:'opacity .2s'});document.body.appendChild(box);
}

// ================================================================
//  牌組 / 抽牌
// ================================================================
function initDeck(){
  const saved = loadSavedDeck();
  if(saved) deckCounts=saved; else {
    for(let id=1;id<=50;id++) deckCounts.set(String(id),DEFAULT_COPIES_EACH);
  }
}
function dealInitialHand(color){ for(let i=0;i<5;i++) drawCard(color); }
function drawCard(color){
  if(hand.length>=MAX_HAND || totalDeckLeft(color)===0) return;
  const pool=[]; deckCounts.forEach((cnt,id)=>{for(let i=0;i<cnt;i++) pool.push(id);});
  const id = pool[Math.floor(Math.random()*pool.length)];
  deckCounts.set(id, deckCounts.get(id)-1); if(deckCounts.get(id)===0) deckCounts.delete(id);
  if(color===current){ hand.push(id); handDiv.appendChild(createCardEl(id)); }
  else {/* 電腦手牌不渲染 */}
}
function totalDeckLeft(){ let n=0; deckCounts.forEach(v=>n+=v); return n; }
function loadSavedDeck(){
  try{ const raw=localStorage.getItem('savedDeck'); if(!raw) return null;
       const obj=JSON.parse(raw); const map=new Map();
       if(Array.isArray(obj)) obj.forEach(id=> map.set(String(id),(map.get(String(id))||0)+1));
       else Object.entries(obj).forEach(([id,cnt])=>{const n=Number(cnt)||0;if(n>0) map.set(String(id),n);});
       return map.size?map:null;
  }catch(e){console.warn('deck 解析錯',e);return null;}
}

// ================================================================
//  手牌 DOM 元素
// ================================================================
function createCardEl(id){
  const data=CARD_EFFECTS[id]||{cost:0};
  const el=document.createElement('div'); el.className='card'; el.style.backgroundImage=`url('/static/img/cards/${id}.jpg')`; el.dataset.id=id;
  /* cost */
  const tag=document.createElement('span'); tag.className='cost'; tag.textContent=data.cost; el.appendChild(tag);
  /* events */
  el.addEventListener('mouseenter',()=>showPreview(id));
  el.addEventListener('mouseleave', hidePreview);
  el.addEventListener('click', ()=>{
    /* 能量檢查 */
    if(energy < data.cost){ toast('能量不足'); return; }
    selectCard(el,id);
  });
  return el;
}
function selectCard(el,id){
  if(selectedCardEl===el){ clearSelection(); return; }
  selectedCardEl?.classList.remove('selected');
  el.classList.add('selected');
  selectedCardEl = el;
  selectedCardId = id;
  pendingEffect  = CARD_EFFECTS[id].effect;
  pendingParams  = {};
  highlightAnchors(id);
}
function clearSelection(){
  selectedCardEl?.classList.remove('selected');
  selectedCardEl=null; selectedCardId=null; pendingEffect=null; pendingParams={}; highlightMap=[]; redraw();
}
function showPreview(id){ const box=document.getElementById('card-preview'); if(box){box.style.backgroundImage=`url('/static/img/cards/${id}.jpg')`; box.classList.add('show');} }
function hidePreview(){ document.getElementById('card-preview')?.classList.remove('show'); }

// ================================================================
//  棋盤繪製
// ================================================================
function redraw(){ ctx.clearRect(0,0,canvas.width,canvas.height); drawBoard(); drawStones(); highlightMap.forEach(([r,c])=> drawHighlight(r,c)); }
function drawBoard(){
  ctx.fillStyle='#deb887'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#000'; ctx.lineWidth=1;
  for(let i=1;i<=BOARD_SIZE;i++){
    ctx.beginPath();ctx.moveTo(GRID_SIZE,GRID_SIZE*i);ctx.lineTo(GRID_SIZE*BOARD_SIZE,GRID_SIZE*i);ctx.stroke();
    ctx.beginPath();ctx.moveTo(GRID_SIZE*i,GRID_SIZE);ctx.lineTo(GRID_SIZE*i,GRID_SIZE*BOARD_SIZE);ctx.stroke();
  }
  if(BOARD_SIZE===19){ [3,9,15].forEach(r=>[3,9,15].forEach(c=>{ ctx.beginPath(); ctx.arc(GRID_SIZE*(c+1),GRID_SIZE*(r+1),RADIUS*0.2,0,Math.PI*2); ctx.fillStyle="#000"; ctx.fill(); })); }
}
function drawStones(){
  for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++) if(board[r][c]) drawStone(r,c,board[r][c]);
}
function drawStone(r,c,color){
  const x=GRID_SIZE*(c+1), y=GRID_SIZE*(r+1);
  const g=ctx.createRadialGradient(x-RADIUS*0.4,y-RADIUS*0.4,RADIUS*0.1,x,y,RADIUS*1.05);
  if(color===1){ g.addColorStop(0,'#888'); g.addColorStop(0.3,'#444'); g.addColorStop(1,'#000'); }
  else         { g.addColorStop(0,'#fff'); g.addColorStop(0.55,'#eee'); g.addColorStop(1,'#aaa'); }
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,RADIUS,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.stroke();
}
function drawHighlight(r,c){ ctx.fillStyle='rgba(255,165,0,.35)'; ctx.fillRect(GRID_SIZE*(c+0.15),GRID_SIZE*(r+0.15),GRID_SIZE*0.7,GRID_SIZE*0.7); }

// ================================================================
//  棋盤互動
// ================================================================
function onBoardHover(e){ if(!selectedCardId) return; /* 只重繪既有 highlight */ }
function onBoardClick(e){
  if(!selectedCardId) return;   // 只有選牌時才可點棋盤
  const rect=canvas.getBoundingClientRect();
  const c=Math.round((e.clientX-rect.left)/GRID_SIZE-1);
  const r=Math.round((e.clientY-rect.top )/GRID_SIZE-1);
  if(r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE) return;
  if(!highlightMap.some(([hr,hc])=>hr===r&&hc===c)) return;  // 非合法 anchor

  pendingParams.anchor={x:c,y:r};
  if(CARD_EFFECTS[selectedCardId].needDir && !pendingParams.dir){
    showDirPanel(e.clientX,e.clientY,dir=>{ pendingParams.dir=dir; tryPlayCard(); });
  }else{ tryPlayCard(); }
}
function tryPlayCard(){
  const cost=CARD_EFFECTS[selectedCardId].cost;
  if(energy<cost){ toast('能量不足'); return; }
  const res=pendingEffect(board,current,pendingParams);
  if(!res.ok){ toast(res.msg||'無法放置'); return; }
  board=res.board;
  applyCaptures();
  energy-=cost; updateEnergy();
  // 從手牌移除 & DOM 刪除
  const idx=hand.indexOf(selectedCardId); if(idx>=0){hand.splice(idx,1);} selectedCardEl.remove();
  clearSelection();
  redraw();
  endTurn();
}
function endTurn(){
  current = 3-current;          // 換手
  energy += 3;                  // 基礎回合補能
  updateEnergy();
  drawCard(current);            // 抽牌給下一手 (如果是電腦可在此呼叫 AI)
  toast(`輪到 ${(current===1?'黑':'白')} 方`);
}

// ================================================================
//  提子
// ================================================================
function applyCaptures(){
  const enemy=3-current; const visited=new Set();
  for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++){
    if(board[r][c]!==enemy||visited.has(`${r},${c}`)) continue;
    const grp=[]; let libs=0;
    flood(r,c);
    if(libs===0) grp.forEach(([rr,cc])=> board[rr][cc]=0);

    function flood(sr,sc){
      const st=[[sr,sc]]; while(st.length){
        const [y,x]=st.pop(); const key=`${y},${x}`; if(visited.has(key)) continue; visited.add(key); grp.push([y,x]);
        for(const [dx,dy] of DIRS){ const ny=y+dy, nx=x+dx; if(ny<0||ny>=BOARD_SIZE||nx<0||nx>=BOARD_SIZE) continue;
          if(board[ny][nx]===0) libs++; else if(board[ny][nx]===enemy) st.push([ny,nx]); }
      }
    }
  }
}

// ================================================================
//  其他工具
// ================================================================
function highlightAnchors(id){
  highlightMap.length=0;
  for(let r=0;r<BOARD_SIZE;r++) for(let c=0;c<BOARD_SIZE;c++){
    const sim=CARD_EFFECTS[id].effect(board,current,{anchor:{x:c,y:r},dir:'h'});
    if(sim.ok) highlightMap.push([r,c]);
  }
  redraw();
}
function showDirPanel(px,py,cb){
  const div=document.createElement('div'); div.className='dir-panel'; div.style.left=px+'px'; div.style.top=py+'px';
  div.innerHTML=`<button data-d="h">─</button><button data-d="v">│</button><button data-d="diag1">＼</button><button data-d="diag2">／</button>`;
  document.body.appendChild(div);
  div.addEventListener('click',e=>{ const d=e.target.dataset.d; if(d){ cb(d); div.remove(); }});
}
function updateEnergy(){ if(energySpan) energySpan.textContent=String(energy); }
function toast(msg){ console.log(msg); /* 可替換成 snackbar */ }

// ================================================================
//  重設
// ================================================================
function resetGame(){ board=Array.from({length:BOARD_SIZE},()=>Array(BOARD_SIZE).fill(0)); energy=3; hand=[]; handDiv.innerHTML=''; clearSelection(); initDeck(); dealInitialHand(current); updateEnergy(); redraw(); }

// ================================================================
//  對外 export (如 AI)  -- 目前無需，可自行刪除
// ================================================================
export { board, current, GRID_SIZE };