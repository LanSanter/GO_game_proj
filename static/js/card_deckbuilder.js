// card_deckbuilder.js  —— v1.2 (跨分頁同步 + 防呆)
// ------------------------------------------------------------
// 1. 與 card_gacha.js 共用 localStorage『myCards』，同頁面靠
//    "cards-updated" 事件同步；跨分頁靠 window "storage" 事件同步。
// 2. 所有關鍵元素 ID 抽成常數，若頁面缺元素則停止初始化並警示。
// ------------------------------------------------------------

/* === (可依 HTML 調整) 元素 ID 常數 === */
const ID_COLLECTION = "collection";   // 庫存區 <ul>
const ID_DECK       = "deck";         // 牌組區 <ul>
const ID_CNT        = "deck-count";   // 已選張數 <span>
const ID_ENERGY     = "energy-total"; // 總能量   <span>
const ID_PREVIEW    = "preview-card"; // 右下預覽 <div>
const BTN_CLEAR_ID  = "clear-deck";   // 清空牌組 <button>
const BTN_SAVE_ID   = "save-deck";    // 儲存牌組 <button>

/* === 其他常數 === */
const MAX_CARD_ID = 50;
const MAX_DECK    = 40;
const IMG_DIR     = "/static/img/cards/";
const LS_OWNED    = "myCards";   // 與 card_gacha.js 共用
const LS_DECK     = "savedDeck";

/* === DOM 取節點（若缺少則停止腳本） === */
const $col  = document.getElementById(ID_COLLECTION);
const $deck = document.getElementById(ID_DECK);
const $cnt  = document.getElementById(ID_CNT);
const $ener = document.getElementById(ID_ENERGY);
const $prev = document.getElementById(ID_PREVIEW);

if(!($col && $deck && $cnt && $ener && $prev)){
  console.warn("[deckbuilder] 部分必需元素不存在，腳本已跳過初始化。");
  return;
}

/* === LocalStorage helpers === */
const load = k => JSON.parse(localStorage.getItem(k)||"{}");
const save = (k,v) => localStorage.setItem(k,JSON.stringify(v));

/* === 產生基本資料 (id → 能量) === */
const cards   = Array.from({length:MAX_CARD_ID}, (_,i)=>({id:i+1,energy:(i%3)+1}));
const cardMap = new Map(cards.map(c=>[c.id,c]));

/* === 建立牌縮圖元素 === */
function makeCard(id, qty){
  const div = document.createElement("div");
  div.className = "card";
  div.dataset.cardId = id;
  div.dataset.left   = qty;
  div.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;

  const badge = document.createElement("span");
  badge.className="badge";
  badge.textContent=`×${qty}`;
  div.appendChild(badge);

  div.addEventListener("mouseenter",()=>showPreview(id));
  div.addEventListener("mouseleave",hidePreview);
  return div;
}

/* === 預覽 === */
function showPreview(id){
  $prev.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  $prev.style.display = "block";
}
function hidePreview(){ $prev.style.display="none"; }

/* === 渲染庫存 === */
function refreshCollection(myCards){
  $col.innerHTML = "";
  Object.entries(myCards).forEach(([id,qty])=>{
    if(qty>0) $col.appendChild(makeCard(+id,qty));
  });
}

/* === 初始化牌組 === */
function initDeck(){
  const ids = JSON.parse(localStorage.getItem(LS_DECK)||"[]");
  ids.forEach(id=>{
    const src = $col.querySelector(`.card[data-card-id='${id}']`);
    if(src) moveCard(src,$deck);
  });
}

/* === 移動卡片 (庫 ↔ 組) === */
function moveCard(cardEl,target){
  if(target===$deck){
    if($deck.children.length>=MAX_DECK){alert("已達上限 40 張");return;}
    let left=+cardEl.dataset.left-1;
    cardEl.dataset.left=left;
    cardEl.querySelector(".badge").textContent=`×${left}`;
    if(left===0) cardEl.style.display="none";
    const clone=cardEl.cloneNode(true);
    clone.removeChild(clone.querySelector(".badge"));
    clone.removeAttribute("data-left");
    clone.addEventListener("mouseenter",()=>showPreview(cardEl.dataset.cardId));
    clone.addEventListener("mouseleave",hidePreview);
    $deck.appendChild(clone);
  }else{
    const id=+cardEl.dataset.cardId;
    const src=$col.querySelector(`.card[data-card-id='${id}']`);
    if(src){
      src.style.display="";
      let left=+src.dataset.left+1;
      src.dataset.left=left;
      src.querySelector(".badge").textContent=`×${left}`;
    }
    cardEl.remove();
  }
  updateStats();
}

/* === 點擊移動 === */
document.addEventListener("click",e=>{
  const el=e.target.closest(".card");
  if(!el) return;
  moveCard(el, el.parentElement===$deck? $col:$deck);
});

/* === 功能按鈕 === */
const $btnClear = document.getElementById(BTN_CLEAR_ID);
const $btnSave  = document.getElementById(BTN_SAVE_ID);
if($btnClear) $btnClear.onclick=()=>[...$deck.children].forEach(c=>moveCard(c,$col));
if($btnSave)  $btnSave.onclick=()=>{
  const ids=[...$deck.children].map(c=>+c.dataset.cardId);
  localStorage.setItem(LS_DECK,JSON.stringify(ids));
  alert("牌組已儲存！");
};

/* === 統計 === */
function updateStats(){
  const ids=[...$deck.children].map(c=>+c.dataset.cardId);
  const energy=ids.reduce((t,id)=>t+cardMap.get(id).energy,0);
  $cnt.textContent=ids.length;
  $ener.textContent=`總能量：${energy}`;
}

/* === 同步牌組庫存檢查 === */
function syncDeckAfterChange(){
  [...$deck.children].forEach(c=>{
    const id = +c.dataset.cardId;
    const left = +($col.querySelector(`.card[data-card-id='${id}']`)?.dataset.left||0);
    if(left<0) moveCard(c,$col);
  });
  updateStats();
}

/* === 初始化流程 === */
refreshCollection(load(LS_OWNED));
initDeck();
updateStats();

/* === 同頁面即時事件 === */
window.addEventListener("cards-updated", e=>{
  refreshCollection(e.detail);
  syncDeckAfterChange();
});

/* === 跨分頁同步 storage 事件 === */
window.addEventListener("storage", e=>{
  if(e.key===LS_OWNED){
    refreshCollection(load(LS_OWNED));
    syncDeckAfterChange();
  }
});

