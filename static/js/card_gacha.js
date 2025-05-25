/****************************************************************
 * card_gacha.js  —— v3.8  (zoom 1.5× & grayscale not-owned)
 ****************************************************************/

/* ========= 參數 ========= */
const TOTAL_CARDS = 200;
const MIN_ID      = 1;
const MAX_ID      = 50;
const STORAGE_KEY = "myCards";
const IMG_DIR     = "/static/img/cards/";

/* socket.io（可選）*/
const socket        = window.socket        || null;
const currentRoomId = window.currentRoomId || null;

/* ========= DOM ID ========= */
const BTN_OPEN_ID  = "btn-open-pack";
const BTN_CLEAR_ID = "btn-clear-cards";
const RESULT_ID    = "result-zone";
const COLL_ID      = "collection-zone";
const PREV_ID      = "preview-card";
const OVERLAY_MASK_ID = "overlay-mask";
const OVERLAY_CARD_ID = "overlay-card";

/* ========= 工具 ========= */
const rand  = () => Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
const gacha = (n = TOTAL_CARDS) => Array.from({ length: n }, rand);

/* ========= localStorage ========= */
const loadColl = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
};
const saveColl = obj => localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));

/* ========= 更新卡庫 ========= */
function addCards(arr) {
  const coll = loadColl();
  arr.forEach(id => (coll[id] = (coll[id] || 0) + 1));
  saveColl(coll);
  dispatchUpdate(coll);
  return coll;
}
function clearCards() { localStorage.removeItem(STORAGE_KEY); dispatchUpdate({}); }
function dispatchUpdate(coll) {
  window.dispatchEvent(new CustomEvent("cards-updated", { detail: coll }));
}

/* ========= 後端同步 ========= */
function commitGachaDraw(cards) {
  if (!socket || !currentRoomId || !cards.length) return;
  socket.emit("gacha:draw", { room: currentRoomId, cards });
}

/* ========= 預覽 ========= */
let $prev = null, $overlayMask = null, $overlayCard = null;

function showPreview(id){
  if(!$prev) return;
  $prev.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  $prev.style.display = "block";
}
const hidePreview = () => $prev && ($prev.style.display="none");

function showOverlay(id){
  if(!$overlayMask || !$overlayCard) return;
  $overlayCard.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  $overlayMask.classList.add("show");          // CSS 內 .show 會把 card scale 1.5×
}
const hideOverlay = () => $overlayMask?.classList.remove("show");

/* ========= Render ========= */
function makeCardDiv(id, qty = null, owned=true){
  const d = document.createElement("div");
  d.className = `card${owned ? "" : " locked"}`;      // 未擁有加 .locked
  d.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  if(owned && qty!==null){
    const b = document.createElement("span");
    b.className="badge"; b.textContent=`×${qty}`;
    d.appendChild(b);
  }
  d.addEventListener("mouseenter", ()=>showPreview(id));
  d.addEventListener("mouseleave", hidePreview);
  d.addEventListener("click", ()=>showOverlay(id));
  return d;
}

/* 抽卡結果區（只有抽到的牌，照 ID 排）*/
function renderIds(arr,parent){
  parent.innerHTML="";
  const counts={};
  arr.forEach(id=>(counts[id]=(counts[id]||0)+1));
  Object.entries(counts)
    .sort((a,b)=>+a[0]-+b[0])
    .forEach(([id,cnt])=>parent.appendChild(makeCardDiv(+id,cnt,true)));
}

/* 持有卡庫：已擁有 ➜ 未擁有 */
function renderCollection(coll,parent){
  parent.innerHTML="";

  /* 已擁有 */
  Object.entries(coll)
    .sort((a,b)=>+a[0]-+b[0])
    .forEach(([id,cnt])=>parent.appendChild(makeCardDiv(+id,cnt,true)));

  /* 未擁有 */
  for(let id=MIN_ID; id<=MAX_ID; id++){
    if(coll[id]) continue;
    parent.appendChild(makeCardDiv(id,null,false));
  }
}

/* ========= DOM Ready ========= */
window.addEventListener("DOMContentLoaded",()=>{
  const btnOpen=document.getElementById(BTN_OPEN_ID);
  const btnClr =document.getElementById(BTN_CLEAR_ID);
  const zoneRes=document.getElementById(RESULT_ID);
  const zoneCol=document.getElementById(COLL_ID);

  $prev        =document.getElementById(PREV_ID);
  $overlayMask =document.getElementById(OVERLAY_MASK_ID);
  $overlayCard =document.getElementById(OVERLAY_CARD_ID);
  $overlayMask?.addEventListener("click",hideOverlay);

  /* 初次載入 */
  zoneCol && renderCollection(loadColl(),zoneCol);

  /* 開包 */
  btnOpen?.addEventListener("click",()=>{
    const cards=gacha();
    addCards(cards);
    commitGachaDraw(cards);

    zoneRes && renderIds(cards,zoneRes);
    zoneCol && renderCollection(loadColl(),zoneCol);
    document.getElementById("result-title")?.classList.remove("hidden");
  });

  /* 清空 */
  btnClr?.addEventListener("click",()=>{
    if(!confirm("確定要清空所有卡牌？此動作無法復原！")) return;
    clearCards();
    zoneRes && (zoneRes.innerHTML="");
    zoneCol && (zoneCol.innerHTML="");
    document.getElementById("result-title")?.classList.add("hidden");
  });
});