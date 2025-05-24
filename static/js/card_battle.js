/****************************************************************
 * card_battle.js  —— v2.3.1
 * - 高亮位置改為交叉點 (intersection)，以小圓圈標示
 ****************************************************************/
import { CARD_EFFECTS } from "./card_effect.js";
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

/* -------------------- 連線 & 參數 -------------------- */
const urlParams   = new URLSearchParams(location.search);
const ROOM_ID     = urlParams.get("room")   || "demo";
const playerIdStr = urlParams.get("player") || urlParams.get("pid") || "1";
const savedDeck   = JSON.parse(localStorage.getItem("savedDeck") || "[]");
const socket      = io(location.origin, { transports: ["websocket"] });

/* -------------------- DOM refs -------------------- */
let overlay = document.getElementById("overlay");
if (!overlay) {
  overlay = Object.assign(document.createElement("div"), { id: "overlay" });
  Object.assign(overlay.style, {
    position:"fixed",inset:"0",background:"rgba(0,0,0,.65)",
    color:"#fff",font:"24px/1.4 sans-serif",display:"flex",
    alignItems:"center",justifyContent:"center",zIndex:"3000",
    display:"none"
  });
  document.body.appendChild(overlay);
}

const roundSpan   = document.getElementById("round-num");
const turnSpan    = document.getElementById("turn-indicator");
const energyNow   = document.getElementById("energy-value");
const energyMaxEl = document.getElementById("energy-max");
const handDiv     = document.getElementById("hand-zone");
const passBtn     = document.getElementById("btn-pass");

/* -------------------- 遊戲狀態 -------------------- */
const BOARD_SIZE = 19;
let GRID_SIZE = 32, RADIUS = 14;

let canvas, ctx;
let board      = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
let current    = 1;
let turnCount  = 1;
let energyCap  = 2;
let energy     = 2;
let hand       = [];
let playerId   = playerIdStr;

/* 手牌選取 / 高亮暫存 */
let selectedCardId = null;
let selectedCardEl = null;
let pendingParams  = {};
let highlightMap   = [];

/* -------------------- Socket 事件 -------------------- */
socket.on("waiting", m => { overlay.textContent = m; overlay.style.display="flex"; });
socket.on("start",   s => { overlay.style.display="none"; syncState(s); });
socket.on("state",   syncState);
socket.on("hand:update", h => { hand=h; redrawHand(); updateEnergy(); });
socket.on("error", e => toast(e.msg||e));

socket.on("connect", () => {
  socket.emit("join", { room:ROOM_ID, player:playerIdStr, deck:savedDeck });
});

/* -------------------- Init -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("board");
  ctx    = canvas.getContext("2d");
  GRID_SIZE = canvas.width / (BOARD_SIZE + 1);
  RADIUS    = GRID_SIZE * 0.42;

  injectPreviewBox();
  canvas.addEventListener("click", onBoardClick);
  canvas.addEventListener("mousemove", onBoardHover);
  canvas.addEventListener("mouseleave", redraw);
  passBtn?.addEventListener("click", () => sendAction({type:"endTurn"}));

  redraw();
});

/* -------------------- 狀態同步 -------------------- */
function syncState(s){
  board      = s.board;
  current    = s.turn;
  turnCount  = s.turnCount;
  energyCap  = s.energyCap[playerIdStr];
  energy     = s.energy[playerIdStr];
  hand       = Array.isArray(s.hands[playerIdStr]) ? s.hands[playerIdStr] : hand;

  if (roundSpan) roundSpan.textContent = turnCount;
  if (turnSpan)  turnSpan.textContent  = (current===+playerIdStr)?"你":"對手";
  updateEnergy();
  redraw();
  redrawHand();
}
function updateEnergy(){
  if (energyNow)  energyNow.textContent  = energy;
  if (energyMaxEl) energyMaxEl.textContent = energyCap;
}

/* -------------------- 行為送出 -------------------- */
function sendAction(o){ socket.emit("action",{room:ROOM_ID,action:o}); }
function emitPlay(){
  const p = { ...pendingParams };

  // 伺服器目前只吃 params.x / params.y
  if (selectedCardId === 1 && p.anchor) {
    p.x = p.anchor.x;
    p.y = p.anchor.y;
    delete p.anchor;
  }

  sendAction({ type: "playCard", cardId: selectedCardId, params: p });
  clearSelection();
}


/* -------------------- 手牌 UI -------------------- */
function redrawHand(){
  handDiv.innerHTML="";
  hand.forEach(id=>handDiv.appendChild(createCardEl(id)));
}
function createCardEl(id){
  const d=CARD_EFFECTS[id]||{cost:0};
  const el=document.createElement("div");
  el.className="card"; el.style.backgroundImage=`url('/static/img/cards/${id}.jpg')`;
  el.dataset.id=id;
  const tag=document.createElement("span");
  tag.className="cost"; tag.textContent=d.cost; el.appendChild(tag);
  el.onmouseenter=()=>showPreview(id); el.onmouseleave=hidePreview;
  el.onclick=()=>{
    if(energy<d.cost){toast("能量不足");return;}
    selectCard(el,id);
  };
  return el;
}
function selectCard(el,id){
  if(selectedCardEl===el){clearSelection();return;}
  selectedCardEl?.classList.remove("selected");
  el.classList.add("selected");
  selectedCardEl=el; selectedCardId=id;
  pendingParams={}; highlightAnchors(id);
}
function clearSelection(){
  selectedCardEl?.classList.remove("selected");
  selectedCardEl=null; selectedCardId=null;
  pendingParams={}; highlightMap=[]; redraw();
}

/* -------------------- 預覽框 -------------------- */
function injectPreviewBox(){
  if(document.getElementById("card-preview"))return;
  const b=document.createElement("div");
  b.id="card-preview";
  Object.assign(b.style,{position:"fixed",right:"24px",bottom:"24px",
    width:"240px",aspectRatio:"2/3",backgroundSize:"cover",
    borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,.45)",
    opacity:0,transition:"opacity .2s"});
  document.body.appendChild(b);
}
function showPreview(id){
  const b=document.getElementById("card-preview");
  if(b){b.style.backgroundImage=`url('/static/img/cards/${id}.jpg')`;b.classList.add("show");}
}
function hidePreview(){document.getElementById("card-preview")?.classList.remove("show");}

/* -------------------- 棋盤繪製 -------------------- */
function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBoard(); drawStones();
  highlightMap.forEach(([r,c])=>drawHighlight(r,c));
}
function drawBoard(){
  ctx.fillStyle="#deb887"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#000"; ctx.lineWidth=1;
  for(let i=1;i<=BOARD_SIZE;i++){
    ctx.beginPath(); ctx.moveTo(GRID_SIZE,GRID_SIZE*i);
    ctx.lineTo(GRID_SIZE*BOARD_SIZE,GRID_SIZE*i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(GRID_SIZE*i,GRID_SIZE);
    ctx.lineTo(GRID_SIZE*i,GRID_SIZE*BOARD_SIZE); ctx.stroke();
  }
  if(BOARD_SIZE===19){
    [3,9,15].forEach(r=>[3,9,15].forEach(c=>{
      ctx.beginPath();
      ctx.arc(GRID_SIZE*(c+1),GRID_SIZE*(r+1),RADIUS*0.2,0,Math.PI*2);
      ctx.fillStyle="#000"; ctx.fill();
    }));
  }
}
function drawStones(){
  board.forEach((row,r)=>row.forEach((v,c)=>v&&drawStone(r,c,v)));
}
function drawStone(r,c,color){
  const x=GRID_SIZE*(c+1),y=GRID_SIZE*(r+1);
  const g=ctx.createRadialGradient(x-RADIUS*.4,y-RADIUS*.4,RADIUS*.1,x,y,RADIUS*1.05);
  if(color===1){g.addColorStop(0,"#888");g.addColorStop(.3,"#444");g.addColorStop(1,"#000");}
  else         {g.addColorStop(0,"#fff");g.addColorStop(.55,"#eee");g.addColorStop(1,"#aaa");}
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,RADIUS,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.5)"; ctx.stroke();
}

/* ======== ★ 新的 Highlight：交叉點小圓圈 ======== */
function drawHighlight(r,c){
  const x=GRID_SIZE*(c+1),y=GRID_SIZE*(r+1);
  ctx.fillStyle="rgba(241, 165, 23, 0.6)";
  ctx.beginPath(); ctx.arc(x,y,RADIUS*0.35,0,Math.PI*2); ctx.fill();
}

/* -------------------- 棋盤互動 -------------------- */
function onBoardHover(_){}
function onBoardClick(e){
  if(!selectedCardId)return;
  const rect=canvas.getBoundingClientRect();
  const c = Math.round((e.clientX - rect.left - GRID_SIZE) / GRID_SIZE);
  const r = Math.round((e.clientY - rect.top  - GRID_SIZE) / GRID_SIZE);
  if(r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE)return;
  if(!highlightMap.some(([hr,hc])=>hr===r&&hc===c))return;

  pendingParams.anchor={x:c,y:r};
  const needDir=CARD_EFFECTS[selectedCardId].needDir;
  if(needDir&&!pendingParams.dir){
    showDirPanel(e.clientX,e.clientY,d=>{pendingParams.dir=d;emitPlay();});
  }else emitPlay();
}

/* -------------------- 高亮計算 -------------------- */
function highlightAnchors(id){
  highlightMap.length=0;
  for(let r=0;r<BOARD_SIZE;r++)
    for(let c=0;c<BOARD_SIZE;c++)
      if(CARD_EFFECTS[id].effect(board,current,{anchor:{x:c,y:r},dir:"h"}).ok)
        highlightMap.push([r,c]);
  redraw();
}

/* -------------------- 方向面板 -------------------- */
function showDirPanel(px,py,cb){
  const d=document.createElement("div");
  d.className="dir-panel";
  Object.assign(d.style,{position:"fixed",left:px+"px",top:py+"px",
    display:"grid",gridTemplateColumns:"repeat(2,40px)",gap:"4px",
    background:"#222",padding:"6px",borderRadius:"6px",zIndex:2000});
  d.innerHTML=`<button data-d="h">─</button><button data-d="v">│</button>
               <button data-d="diag1">＼</button><button data-d="diag2">／</button>`;
  document.body.appendChild(d);
  d.onclick=e=>{const dir=e.target.dataset.d;if(dir){cb(dir);d.remove();}};
}

/* -------------------- 工具 -------------------- */
function toast(m){console.log(m);}
export { board,current,GRID_SIZE };
