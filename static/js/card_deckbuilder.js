/*******************************************************************************
 * Deck Builder  +  Hover Preview
 ******************************************************************************/

/* === 常數 === */
const MAX_ID   = 50;
const MAX_DECK = 40;
const IMG_DIR  = "/static/img/cards/";   // 圖檔路徑（絕對）
const LS_OWNED = "ownedCards";
const LS_DECK  = "savedDeck";

/* === 產生基本資料 === */
const cards = Array.from({length:MAX_ID},(_,i)=>({id:i+1,energy:(i%3)+1}));
const cardMap = new Map(cards.map(c=>[c.id,c]));

/* === DOM === */
const $col   = document.getElementById("collection");
const $deck  = document.getElementById("deck");
const $cnt   = document.getElementById("deck-count");
const $ener  = document.getElementById("energy-total");
const $prev  = document.getElementById("preview-card");

/* === LocalStorage helpers === */
const load = k => JSON.parse(localStorage.getItem(k)||"[]");
const save = (k,v) => localStorage.setItem(k,JSON.stringify(v));

/* === 建立牌縮圖元素 === */
function makeCard(id, qty){
  const div = document.createElement("div");
  div.className = "card";
  div.dataset.cardId = id;
  div.dataset.left   = qty;
  div.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;

  const badge = document.createElement("span");
  badge.className="badge"; badge.textContent=`×${qty}`;
  div.appendChild(badge);

  /* ── 預覽事件 ── */
  div.addEventListener("mouseenter",()=>showPreview(id));
  div.addEventListener("mouseleave",hidePreview);

  return div;
}

/* === 預覽顯示 / 隱藏 === */
function showPreview(id){
  $prev.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  $prev.style.display = "block";
}
function hidePreview(){ $prev.style.display="none"; }

/* === 初始化牌庫 === */
function initCollection(){
  load(LS_OWNED).forEach(o => $col.appendChild(makeCard(o.id,o.qty)));
}

/* === 初始化牌組 === */
function initDeck(){
  load(LS_DECK).forEach(id=>{
    const src=$col.querySelector(`.card[data-card-id='${id}']`);
    if(src) moveCard(src,$deck);
  });
}

/* === 移動卡片 (庫↔組) === */
function moveCard(cardEl,target){
  const inDeck = cardEl.parentElement===$deck;

  if(target===$deck){                           /* 加入牌組 */
    if($deck.children.length>=MAX_DECK){alert("已滿 110 張");return;}
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
  }else{                                        /* 移回牌庫 */
    const id=+cardEl.dataset.cardId;
    const src=$col.querySelector(`.card[data-card-id='${id}']`);
    src.style.display="";
    let left=+src.dataset.left+1;
    src.dataset.left=left;
    src.querySelector(".badge").textContent=`×${left}`;
    cardEl.remove();
  }
  updateStats();
}

/* === 點擊事件 === */
document.addEventListener("click",e=>{
  const el=e.target.closest(".card");
  if(!el) return;
  moveCard(el, el.parentElement===$deck? $col:$deck);
});

/* === 功能按鈕 === */
document.getElementById("clear-deck").onclick=()=>[...$deck.children].forEach(c=>moveCard(c,$col));
document.getElementById("save-deck").onclick=()=>{
  const ids=[...$deck.children].map(c=>+c.dataset.cardId);
  save(LS_DECK,ids); alert("牌組已儲存！");
};

/* === 統計 === */
function updateStats(){
  const ids=[...$deck.children].map(c=>+c.dataset.cardId);
  const energy=ids.reduce((t,id)=>t+cardMap.get(id).energy,0);
  $cnt.textContent=ids.length;
  $ener.textContent=`總能量：${energy}`;
}

/* === init === */
initCollection(); initDeck(); updateStats();
