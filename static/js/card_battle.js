// card_battle.js – 網路版（前端只負責渲染，不自行計算規則）
// ==================================================
// 依賴：
//   1. card_effect.js      – 定義 CARD_EFFECTS 與效果文字
//   2. socket.io client    – 4.x 版本 ESM build
// ==================================================

import { CARD_EFFECTS } from "./card_effect.js";
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

// -------------------- Socket 連線 --------------------
const SERVER_URL = location.hostname === "localhost"
  ? "ws://localhost:5000"
  : "wss://mygo.ddns.net:8000";         // 依你的 DDNS / 反向代理調整
const ROOM_ID = "lobby-001";              // 亦可解析 URL 參數
const myDeck = [1,1,1,1, 100,101,102, /* …共 40 張… */];
const socket = io({
  transports: ["websocket"]   // 保險起見可加，強迫用 WebSocket
});
socket.emit("join", {
  room  : "demo",   // 你網址上的 room
  player: 1,        // 或 2，看網址
  deck  : myDeck    // ←← 一定要傳，而且長度必須 = 40
});
socket.on("state",     syncStateFromServer);
socket.on("join_ok",   ({ player }) => playerId = player);  // 後端回傳自己是黑=1/白=2

// -------------------- 常數 --------------------
const BOARD_SIZE       = 19;
const DIRS             = [[1,0],[-1,0],[0,1],[0,-1]];  // 上下左右
const ENERGY_CAP_MAX   = 6;                            // ‼ 只用於顯示

// -------------------- 全域渲染狀態 --------------------
let canvas, ctx, GRID_SIZE, RADIUS;
let board   = [];          // 由伺服器同步
let current = null;        // 1=黑 / 2=白
let turnCount = 0;
let energyCap = 0;
let energy    = 0;
let hand      = [];
let playerId  = null;      // 加入房間後由伺服器指定

let handDiv, energySpan, passBtn, resetBtn;

// ── 卡牌互動暫存 ──
let selectedCardId = null;
let selectedCardEl = null;
let pendingParams  = {};    // { anchor:{x,y}, dir }
let highlightMap   = [];    // [[r,c]...]

// ================================================================
//  Init (DOMContentLoaded)
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  // 抓 DOM
  canvas     = document.getElementById("board");
  ctx        = canvas.getContext("2d");
  handDiv    = document.getElementById("hand-zone");
  energySpan = document.getElementById("energy-value");
  passBtn    = document.getElementById("btn-pass");
  resetBtn   = document.getElementById("btn-reset");

  // 格尺寸
  GRID_SIZE = canvas.width / (BOARD_SIZE + 1);
  RADIUS    = GRID_SIZE * 0.42;

  // 動態樣式 & 預覽框
  injectHandStyle();
  injectPreviewBox();

  // 事件
  canvas.addEventListener("click", onBoardClick);
  canvas.addEventListener("mousemove", onBoardHover);
  canvas.addEventListener("mouseleave", () => redraw());
  passBtn.addEventListener("click", () => socket.emit("end_turn", { room: ROOM_ID }));
  resetBtn.addEventListener("click", () => socket.emit("reset",    { room: ROOM_ID }));

  redraw();                // 初始先畫空棋盤（等待 server state）
});

// ================================================================
//  Socket 同步
// ================================================================
function syncStateFromServer(srv){
  // 伺服器必須送：board, current, turnCount, energyCap, energy, hands, playerId (可選)
  ({ board, current, turnCount, energyCap, energy } = srv);
  if (srv.playerId !== undefined) playerId = srv.playerId;
  hand = srv.hands?.[playerId] ?? [];

  redraw();
  redrawHand();
  updateEnergyUI();
}

// ================================================================
//  UI：手牌樣式 / 預覽框
// ================================================================
function injectHandStyle(){
  const css = `
    #hand-zone{position:fixed;bottom:48px;left:50%;transform:translateX(-50%);display:flex;gap:16px;z-index:1000;}
    #hand-zone .card{width:160px;height:220px;background-size:cover;background-position:center;border-radius:10px;box-shadow:0 3px 6px rgba(0,0,0,.28);cursor:pointer;transition:transform .18s,box-shadow .18s;position:relative;}
    #hand-zone .card:hover{transform:translateY(-30px) scale(1.25);box-shadow:0 9px 20px rgba(0,0,0,.4);}
    #hand-zone .card.selected{transform:translateY(-60px) scale(1.45);box-shadow:0 14px 30px rgba(0,0,0,.55);}
    #hand-zone .card .cost{position:absolute;top:4px;right:6px;font:bold 20px/1.1 monospace;color:#fff;text-shadow:0 0 3px #000;}
    #card-preview.show{opacity:1;}
    .dir-panel{position:fixed;display:grid;grid-template-columns:repeat(2,40px);gap:4px;background:#222;padding:6px;border-radius:6px;z-index:2000;}
    .dir-panel button{width:40px;height:40px;color:#fff;background:#444;border:none;border-radius:4px;font-size:18px;cursor:pointer;}
    .dir-panel button:hover{background:#666;}
  `;
  const tag = document.createElement("style");
  tag.textContent = css;
  document.head.appendChild(tag);
}
function injectPreviewBox(){
  if (document.getElementById("card-preview")) return;
  const box = document.createElement("div");
  box.id = "card-preview";
  Object.assign(box.style, {
    position:"fixed",bottom:"12px",right:"12px",width:"160px",height:"240px",
    backgroundSize:"cover",borderRadius:"10px",boxShadow:"0 4px 12px rgba(0,0,0,.4)",opacity:0,transition:"opacity .2s"
  });
  document.body.appendChild(box);
}

// ================================================================
//  手牌渲染
// ================================================================
function redrawHand(){
  handDiv.innerHTML = "";
  hand.forEach(id => handDiv.appendChild(createCardEl(id)));
}
function createCardEl(id){
  const data = CARD_EFFECTS[id] || { cost:0 };
  const el   = document.createElement("div");
  el.className = "card";
  el.style.backgroundImage = `url('/static/img/cards/${id}.jpg')`;
  el.dataset.id = id;

  // cost 數字
  const tag = document.createElement("span");
  tag.className  = "cost";
  tag.textContent = data.cost;
  el.appendChild(tag);

  // 事件
  el.addEventListener("mouseenter", () => showPreview(id));
  el.addEventListener("mouseleave", hidePreview);
  el.addEventListener("click", () => {
    if (energy < data.cost) { toast("能量不足"); return; }
    selectCard(el, id);
  });
  return el;
}
function selectCard(el, id){
  if (selectedCardEl === el){ clearSelection(); return; }
  selectedCardEl?.classList.remove("selected");
  el.classList.add("selected");
  selectedCardEl = el;
  selectedCardId = id;
  pendingParams  = {};       // reset
  highlightAnchors(id);
}
function clearSelection(){
  selectedCardEl?.classList.remove("selected");
  selectedCardEl = null;
  selectedCardId = null;
  pendingParams  = {};
  highlightMap   = [];
  redraw();
}
function showPreview(id){
  const box = document.getElementById("card-preview");
  if (box){ box.style.backgroundImage=`url('/static/img/cards/${id}.jpg')`; box.classList.add("show"); }
}
function hidePreview(){ document.getElementById("card-preview")?.classList.remove("show"); }

// ================================================================
//  棋盤繪製
// ================================================================
function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBoard();
  drawStones();
  highlightMap.forEach(([r,c]) => drawHighlight(r,c));
}
function drawBoard(){
  ctx.fillStyle = "#deb887";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 1;
  for (let i=1;i<=BOARD_SIZE;i++){
    ctx.beginPath(); ctx.moveTo(GRID_SIZE,GRID_SIZE*i);            ctx.lineTo(GRID_SIZE*BOARD_SIZE,GRID_SIZE*i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(GRID_SIZE*i,GRID_SIZE);            ctx.lineTo(GRID_SIZE*i,GRID_SIZE*BOARD_SIZE); ctx.stroke();
  }
  // 星位
  if (BOARD_SIZE === 19){ [3,9,15].forEach(r=>[3,9,15].forEach(c=>{
    ctx.beginPath(); ctx.arc(GRID_SIZE*(c+1),GRID_SIZE*(r+1),RADIUS*0.2,0,Math.PI*2); ctx.fillStyle="#000"; ctx.fill();
  })); }
}
function drawStones(){
  board.forEach((row,r) => row.forEach((val,c) => { if (val) drawStone(r,c,val); }));
}
function drawStone(r,c,color){
  const x = GRID_SIZE*(c+1), y = GRID_SIZE*(r+1);
  const g = ctx.createRadialGradient(x-RADIUS*0.4, y-RADIUS*0.4, RADIUS*0.1, x, y, RADIUS*1.05);
  if (color === 1){ g.addColorStop(0,"#888"); g.addColorStop(0.3,"#444"); g.addColorStop(1,"#000"); }
  else             { g.addColorStop(0,"#fff"); g.addColorStop(0.55,"#eee"); g.addColorStop(1,"#aaa"); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x,y,RADIUS,0,Math.PI*2); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.stroke();
}
function drawHighlight(r,c){
  ctx.fillStyle = "rgba(255,165,0,.35)";
  ctx.fillRect(GRID_SIZE*(c+0.15), GRID_SIZE*(r+0.15), GRID_SIZE*0.7, GRID_SIZE*0.7);
}

// ================================================================
//  棋盤互動
// ================================================================
function onBoardHover(e){ if (!selectedCardId) return; /* 需要可視化時再加 */ }
function onBoardClick(e){
  if (!selectedCardId) return;
  const rect = canvas.getBoundingClientRect();
  const c    = Math.round((e.clientX - rect.left) / GRID_SIZE - 1);
  const r    = Math.round((e.clientY - rect.top ) / GRID_SIZE - 1);
  if (r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE) return;
  if (!highlightMap.some(([hr,hc]) => hr===r && hc===c)) return;  // 非合法 anchor

  pendingParams.anchor = { x:c, y:r };
  const needDir = CARD_EFFECTS[selectedCardId].needDir;
  if (needDir && !pendingParams.dir){
    showDirPanel(e.clientX, e.clientY, dir => { pendingParams.dir = dir; emitPlay(); });
  }else{
    emitPlay();
  }
}
function emitPlay(){
  socket.emit("play_card", {
    room  : ROOM_ID,
    player: playerId,
    cardId: selectedCardId,
    params: pendingParams
  });
  clearSelection();
}

// ================================================================
//  客端高亮輔助（不改資料）
// ================================================================
function highlightAnchors(id){
  highlightMap.length = 0;
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++){
    // UI 預估：只用於提示，不影響真正判定
    const ok = CARD_EFFECTS[id].effect(board,current,{anchor:{x:c,y:r},dir:"h"}).ok;
    if (ok) highlightMap.push([r,c]);
  }
  redraw();
}
function showDirPanel(px,py,cb){
  const div = document.createElement("div");
  div.className = "dir-panel";
  div.style.left = px+"px";
  div.style.top  = py+"px";
  div.innerHTML = `
    <button data-d="h">─</button><button data-d="v">│</button>
    <button data-d="diag1">＼</button><button data-d="diag2">／</button>`;
  document.body.appendChild(div);
  div.addEventListener("click", e => {
    const d = e.target.dataset.d;
    if (d){ cb(d); div.remove(); }
  });
}

// ================================================================
//  其他小工具
// ================================================================
function updateEnergyUI(){ if (energySpan) energySpan.textContent = `${energy}/${energyCap}`; }
function toast(msg){ console.log(msg); /* TODO: UX 提示 */ }

// ================================================================
//  匯出（若 AI 需要使用）
// ================================================================
export { board, current, GRID_SIZE };
