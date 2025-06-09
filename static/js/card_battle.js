import { CARD_EFFECTS } from "./card_effect.js";
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const urlParams   = new URLSearchParams(location.search);
const ROOM_ID     = urlParams.get("room")   || "demo";
const playerIdStr = urlParams.get("player") || urlParams.get("pid") || "1";

const LS_ACTIVE_SLOT = "activeDeckSlot";
const deckSlotStr = urlParams.get("slot") ||
                    localStorage.getItem(LS_ACTIVE_SLOT) || "1";
const deckSlot    = Math.max(1, Math.min(3, parseInt(deckSlotStr, 10) || 1));

const savedDeckKey = `savedDeck${deckSlot}`;
const savedDeck    = JSON.parse(localStorage.getItem(savedDeckKey) || "[]");

const socket = io(location.origin, { transports: ["websocket"] });

let overlay = document.getElementById("overlay");
if (!overlay) {
  overlay = Object.assign(document.createElement("div"), { id: "overlay" });
  Object.assign(overlay.style, {
    position:"fixed",inset:"0",background:"rgba(0,0,0,.65)",
    color:"#fff",font:"24px/1.4 sans-serif",
    display:"flex",alignItems:"center",justifyContent:"center",
    zIndex:"3000"
  });
  overlay.style.display = "none";
  document.body.appendChild(overlay);
}

const roundSpan   = document.getElementById("round-num");
const turnSpan    = document.getElementById("turn-indicator");
const energyNow   = document.getElementById("energy-value");
const energyMaxEl = document.getElementById("energy-max");
const handDiv     = document.getElementById("hand-zone");
const passBtn     = document.getElementById("btn-pass");

let handToggleBtn = document.getElementById("hand-toggle");
if (!handToggleBtn){
  handToggleBtn = Object.assign(document.createElement("button"),{
    id:"hand-toggle",type:"button",textContent:"▼ 收起手牌",
    className:"hand-toggle"
  });
  document.body.appendChild(handToggleBtn);
}

let scoreBlackEl  = document.getElementById("score-black");
let scoreWhiteEl  = document.getElementById("score-white");
(function injectScoreboard(){
  if (scoreBlackEl && scoreWhiteEl) return;
  const box = document.createElement("div");
  box.id = "score-board";
  Object.assign(box.style,{
    position:"fixed",top:"12px",right:"12px",padding:"8px 12px",
    background:"rgba(0,0,0,.55)",borderRadius:"10px",
    color:"#fff",font:"14px/1.4 sans-serif",userSelect:"none",zIndex:"2000"
  });
  box.innerHTML = `
    <span style="margin-right:10px;">⚫ <b id="score-black">0</b></span>
    <span>⚪ <b id="score-white">0</b></span>`;
  document.body.appendChild(box);
  scoreBlackEl = document.getElementById("score-black");
  scoreWhiteEl = document.getElementById("score-white");
})();

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

let selectedCardId = null;
let selectedCardEl = null;
let pendingParams  = {};
let highlightMap   = [];
let previewStones  = [];

let handCollapsed = false;

socket.on("waiting", m => { overlay.textContent = m; overlay.style.display="flex"; });
socket.on("start",   s => { overlay.style.display="none"; syncState(s); });
socket.on("state",   syncState);
socket.on("hand:update", h => { hand=h; redrawHand(); updateEnergy(); });
socket.on("error", e => toast(e.msg||e));

socket.on("connect", () => {
  socket.emit("join", {
    room   : ROOM_ID,
    player : playerIdStr,
    deck   : savedDeck,
    slot   : deckSlot
  });
});

document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("board");
  ctx    = canvas.getContext("2d");
  GRID_SIZE = canvas.width / (BOARD_SIZE + 1);
  RADIUS    = GRID_SIZE * 0.42;

  injectPreviewBox();

  canvas.addEventListener("click",       onBoardClick);
  canvas.addEventListener("mousemove",   onBoardHover);
  canvas.addEventListener("mouseleave",  () => { previewStones.length=0; redraw(); });
  canvas.addEventListener("contextmenu", onRightClick);

  passBtn?.addEventListener("click", () => sendAction({type:"endTurn"}));
  handToggleBtn.addEventListener("click", toggleHandZone);

  redraw();
  updateScoreBoard();
});

/* 狀態同步  */
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
  updateScoreBoard();
}

function updateEnergy(){
  if (energyNow)   energyNow.textContent  = energy;
  if (energyMaxEl) energyMaxEl.textContent = energyCap;
}

function sendAction(o){ socket.emit("action",{room:ROOM_ID,action:o}); }

function emitPlay(){
  const p = { ...pendingParams };
  if (p.anchor){
    p.x = p.anchor.x;
    p.y = p.anchor.y;
    delete p.anchor;
  }
  sendAction({ type:"playCard", cardId:selectedCardId, params:p });
  clearSelection();
}

function redrawHand(){
  handDiv.innerHTML="";
  hand.forEach(id=>handDiv.appendChild(createCardEl(id)));
}
function createCardEl(id){
  const d=CARD_EFFECTS[id]||{cost:0};
  const el=document.createElement("div");
  el.className="card";
  el.style.backgroundImage = `url('/static/img/cards/${id}.jpg')`;
  el.dataset.id=id;
  //能量標籤
  const tag=document.createElement("span");
  tag.className="cost"; tag.textContent=d.cost; el.appendChild(tag);
  //滑入顯示大圖
  el.onmouseenter=()=>showPreview(id); el.onmouseleave=hidePreview;
  //點擊選取
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
  const card = CARD_EFFECTS[id];
  pendingParams = {
    dir: card.needDir ? (card.dirs ? card.dirs[0] : "h") : undefined
  };
  highlightAnchors(id);
}
function clearSelection(){
  selectedCardEl?.classList.remove("selected");
  selectedCardEl=null; selectedCardId=null;
  pendingParams={}; highlightMap=[]; previewStones=[]; redraw();
}

function toggleHandZone(){
  handCollapsed = !handCollapsed;
  handDiv.classList.toggle("collapsed", handCollapsed);
  handToggleBtn.textContent = handCollapsed ? "▲ 展開手牌" : "▼ 收起手牌";
  clearSelection();
  hidePreview();
}

function injectPreviewBox(){
  if(document.getElementById("card-preview"))return;
  const b=document.createElement("div");
  b.id="card-preview";
  Object.assign(b.style,{
    position:"fixed",right:"24px",bottom:"24px",
    width:"240px",aspectRatio:"2/3",backgroundSize:"cover",
    borderRadius:"12px",boxShadow:"0 8px 24px rgba(0,0,0,.45)",
    opacity:0,transition:"opacity .2s"
  });
  document.body.appendChild(b);
}
function showPreview(id){
  if(handCollapsed) return;
  const b=document.getElementById("card-preview");
  if(b){b.style.backgroundImage = `url('/static/img/cards/${id}.jpg')`; b.style.opacity=1;}
}
function hidePreview(){
  const b=document.getElementById("card-preview");
  if(b) b.style.opacity=0;
}

function redraw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBoard();    // 木紋 / 線條 / 星位
  drawStones();   // 已落子
  drawPreview();  // 半透明預覽
  highlightMap.forEach(([r,c])=>drawHighlight(r,c)); // 合法點高亮
}
function drawBoard(){
  ctx.fillStyle="#deb887";
  ctx.fillRect(0,0,canvas.width,canvas.height);
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
function drawStones(){ board.forEach((row,r)=>row.forEach((v,c)=>v&&drawStone(r,c,v,false))); }

function drawPreview(){ previewStones.forEach(([r,c])=>drawStone(r,c,current,true)); }

function drawStone(r,c,color,ghost=false){
  const x=GRID_SIZE*(c+1),y=GRID_SIZE*(r+1);
  const g=ctx.createRadialGradient(x-RADIUS*.4,y-RADIUS*.4,RADIUS*.1,x,y,RADIUS*1.05);
  if(color===1){
    g.addColorStop(0, ghost ? "rgba(136,136,136,.5)" : "#888");
    g.addColorStop(.3, ghost ? "rgba(68,68,68,.5)" : "#444");
    g.addColorStop(1, ghost ? "rgba(0,0,0,.5)" : "#000");
  }else{
    g.addColorStop(0, ghost ? "rgba(255,255,255,.5)" : "#fff");
    g.addColorStop(.55, ghost ? "rgba(238,238,238,.5)" : "#eee");
    g.addColorStop(1,ghost?"rgba(170,170,170,.5)":"#aaa");
  }
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,RADIUS,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=ghost?"rgba(0,0,0,.25)":"rgba(0,0,0,.5)";
  ctx.stroke();
}
function drawHighlight(r,c){
  const x=GRID_SIZE*(c+1),y=GRID_SIZE*(r+1);
  ctx.fillStyle="rgba(241,165,23,0.6)";
  ctx.beginPath(); ctx.arc(x,y,RADIUS*0.35,0,Math.PI*2); ctx.fill();
}

function onBoardHover(e){
  previewStones.length=0;
  if(!selectedCardId)return;
  const rect=canvas.getBoundingClientRect();
  const c = Math.round((e.clientX - rect.left - GRID_SIZE) / GRID_SIZE);
  const r = Math.round((e.clientY - rect.top  - GRID_SIZE) / GRID_SIZE);
  if(r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE){ redraw(); return; }
  if(!highlightMap.some(([hr,hc])=>hr===r&&hc===c)){ redraw(); return; }

  const dir = pendingParams.dir || "h";
  const eff = CARD_EFFECTS[selectedCardId].effect(board,current,{anchor:{x:c,y:r},dir});
  if(eff.ok && eff.board){
    for(let y=0;y<BOARD_SIZE;y++)
      for(let x=0;x<BOARD_SIZE;x++)
        if(board[y][x]===0 && eff.board[y][x]===current)
          previewStones.push([y,x]);
  }
  redraw();
}
function onBoardClick(e){
  if(!selectedCardId)return;
  const rect=canvas.getBoundingClientRect();
  const c = Math.round((e.clientX - rect.left - GRID_SIZE) / GRID_SIZE);
  const r = Math.round((e.clientY - rect.top  - GRID_SIZE) / GRID_SIZE);
  if(r<0||r>=BOARD_SIZE||c<0||c>=BOARD_SIZE)return;
  if(!highlightMap.some(([hr,hc])=>hr===r&&hc===c))return;
  pendingParams.anchor={x:c,y:r};
  emitPlay();
}
function onRightClick(e){
  if(!selectedCardId) return;
  const card = CARD_EFFECTS[selectedCardId];
  if(!card.needDir)   return;
  e.preventDefault();
  const seq = card.dirs || ["h","v"];
  let idx = seq.indexOf(pendingParams.dir||"h");
  idx = (idx+1)%seq.length;
  pendingParams.dir = seq[idx];
  highlightAnchors(selectedCardId);
}

function highlightAnchors(id){
  highlightMap.length=0;
  previewStones.length=0;
  const dir = pendingParams.dir || "h";
  for(let r=0;r<BOARD_SIZE;r++)
    for(let c=0;c<BOARD_SIZE;c++)
      if(CARD_EFFECTS[id].effect(board,current,{anchor:{x:c,y:r},dir}).ok)
        highlightMap.push([r,c]);
  redraw();
}

function updateScoreBoard(){
  const {black,white} = computeScore();
  if(scoreBlackEl) scoreBlackEl.textContent = black;
  if(scoreWhiteEl) scoreWhiteEl.textContent = white;
}

function computeScore(){
  const visited  = Array.from({length:BOARD_SIZE},()=>Array(BOARD_SIZE).fill(false));
  const groupId  = Array.from({length:BOARD_SIZE},()=>Array(BOARD_SIZE).fill(-1));
  const groups   = [];

  const dir4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const inBoard = (r,c)=>r>=0&&r<BOARD_SIZE&&c>=0&&c<BOARD_SIZE;

  for(let r=0;r<BOARD_SIZE;r++){
    for(let c=0;c<BOARD_SIZE;c++){
      if(board[r][c]===0 || visited[r][c]) continue;
      const color = board[r][c];
      const stones=[], libs=new Set(), stack=[[r,c]];
      visited[r][c]=true;
      while(stack.length){
        const [y,x]=stack.pop();
        stones.push([y,x]);
        groupId[y][x]=groups.length;
        for(const [dy,dx] of dir4){
          const ny=y+dy,nx=x+dx;
          if(!inBoard(ny,nx)) continue;
          const v=board[ny][nx];
          if(v===color && !visited[ny][nx]){
            visited[ny][nx]=true; stack.push([ny,nx]);
          }else if(v===0){
            libs.add(`${ny},${nx}`);
          }
        }
      }
      groups.push({color,stones,libs,safe:false});
    }
  }

  const eyeVisited = Array.from({length:BOARD_SIZE},()=>Array(BOARD_SIZE).fill(false));
  const eyeOwner   = new Map();

  function floodEye(sr,sc){
    const region=[[sr,sc]], queue=[[sr,sc]], adj=new Set();
    eyeVisited[sr][sc]=true;
    while(queue.length){
      const [y,x]=queue.pop();
      for(const [dy,dx] of dir4){
        const ny=y+dy,nx=x+dx;
        if(!inBoard(ny,nx)) continue;
        const v=board[ny][nx];
        if(v===0 && !eyeVisited[ny][nx]){
          eyeVisited[ny][nx]=true; region.push([ny,nx]); queue.push([ny,nx]);
        }else if(v!==0){
          adj.add(v);
        }
      }
    }
    return {region,adj};
  }

  for(let r=0;r<BOARD_SIZE;r++){
    for(let c=0;c<BOARD_SIZE;c++){
      if(board[r][c]===0 && !eyeVisited[r][c]){
        const {region,adj} = floodEye(r,c);
        const owner = (adj.size===1) ? [...adj][0] : 0;
        region.forEach(([y,x])=>eyeOwner.set(`${y},${x}`, owner));
      }
    }
  }

  groups.forEach(g=>{
    let eyeCnt=0;
    g.libs.forEach(l=>{
      if(eyeOwner.get(l)===g.color) eyeCnt++;
    });
    if(eyeCnt>=2 || g.libs.size>1) g.safe=true;
  });

  const terrVis = Array.from({length:BOARD_SIZE},()=>Array(BOARD_SIZE).fill(false));
  let black=0, white=0;

  function floodEmpty(sr,sc){
    const region=[[sr,sc]], queue=[[sr,sc]], neigh=new Set();
    terrVis[sr][sc]=true;
    while(queue.length){
      const [y,x]=queue.pop();
      for(const [dy,dx] of dir4){
        const ny=y+dy,nx=x+dx;
        if(!inBoard(ny,nx)) continue;
        const v=board[ny][nx];
        if(v===0 && !terrVis[ny][nx]){
          terrVis[ny][nx]=true; region.push([ny,nx]); queue.push([ny,nx]);
        }else if(v!==0){
          neigh.add(groupId[ny][nx]);
        }
      }
    }
    return {region,neigh};
  }

  for(let r=0;r<BOARD_SIZE;r++){
    for(let c=0;c<BOARD_SIZE;c++){
      if(board[r][c]!==0 || terrVis[r][c]) continue;
      const {region,neigh} = floodEmpty(r,c);
      const colors = new Set(), allSafe = [...neigh].every(gid=>{
        const g=groups[gid]; colors.add(g.color); return g.safe;
      });
      if(allSafe && colors.size===1){
        const col=[...colors][0];
        if(col===1) black+=region.length; else white+=region.length;
      }
    }
  }
  return {black,white};
}

function toast(m){console.log(m);}

export { board,current,GRID_SIZE };
