/****************************************************************
 * card_deckbuilder.js  —— v4.10 (multi-deck)
 * -------------------------------------------------------------
 * 變更摘要：
 *   • 新增 3 個可儲存的牌組槽 (savedDeck1 ~ savedDeck3)。
 *   • 以 UI 按鈕 / 下拉選單切換 currentSlot，獨立載入 / 儲存。
 *   • 可選擇自動切槽時先儲存當前牌組（預設開啟，可關閉）。
 *   • 其餘功能（拖曳、模板匯入、清空等）保持相容。
 ****************************************************************/

/* === 基本常數 === */
const MAX_CARD_ID = 60;
const MAX_DECK    = 110;
const IMG_DIR     = "/static/img/cards/";
const LS_OWNED    = "myCards";
const LS_DECK_PREFIX = "savedDeck";   // localStorage key prefix
const TOTAL_SLOTS = 3;                 // 可用牌組槽數 (1..TOTAL_SLOTS)

/* === 範例模板 === */
const AGGRO_TEMPLATE = {
  1:8,2:6,3:6,4:6,5:6,6:4,7:6,8:4,9:2,
 10:10,11:4,12:4,13:4,14:8,15:4,16:4,
 17:4,18:4,19:2,20:2,21:2,22:2,23:2,24:4,25:2
}; // 110
const FINISHER_TEMPLATE = { /* ← 依實際 ID 調整 */ };

/* === 卡片能量 (示例) === */
const cards   = Array.from({length: MAX_CARD_ID}, (_,i)=>({id:i+1,energy:(i%3)+1}));
const cardMap = new Map(cards.map(c=>[c.id,c]));

/* === Deck Slot 狀態 === */
let currentSlot = 1;                  // 目前操作中的槽 (1-based)
let autoSaveOnSwitch = true;          // 切換牌組前自動儲存

/* === DOM refs === */
let $col,$deck,$cnt,$ener,$prev,$slotBtns,$slotTag;

/* === localStorage helpers === */
const loadOwned = ()=>JSON.parse(localStorage.getItem(LS_OWNED)||"{}");
const deckKey   = slot => `${LS_DECK_PREFIX}${slot}`;
const saveDeck  = (arr,slot=currentSlot)=>localStorage.setItem(deckKey(slot),JSON.stringify(arr));
const loadDeck  = (slot=currentSlot)=>JSON.parse(localStorage.getItem(deckKey(slot))||"[]");

/* === utils === */
const sortCards = c=>[...c.children]
  .sort((a,b)=>+a.dataset.cardId-+b.dataset.cardId)
  .forEach(el=>c.appendChild(el));

const deckTotal = ()=>
  [...$deck.children].reduce((s,c)=>s+ +c.querySelector(".badge").textContent.slice(1),0);

/* === 元素工廠 === */
function makeCard(id,qty){
  const d=document.createElement("div");
  d.className="card"; d.dataset.cardId=id;
  if(qty!=null){
    d.dataset.left=qty;
    const b=document.createElement("span");
    b.className="badge"; b.textContent=`×${qty}`;
    d.appendChild(b);
  }
  d.style.backgroundImage=`url('${IMG_DIR}${id}.jpg')`;
  d.addEventListener("mouseenter",()=>showPreview(id));
  d.addEventListener("mouseleave",hidePreview);
  return d;
}

/* === 預覽 === */
const showPreview=id=>{ if($prev){$prev.style.backgroundImage=`url('${IMG_DIR}${id}.jpg')`; $prev.style.display="block";} };
const hidePreview=()=>{$prev&&($prev.style.display="none");};

/* === 渲染 === */
function renderCollection(){
  $col.innerHTML="";
  Object.entries(loadOwned()).sort((a,b)=>+a[0]-+a[0])
    .forEach(([id,cnt])=>$col.appendChild(makeCard(+id,cnt)));
  sortCards($col);
}
function renderDeck(){
  $deck.innerHTML="";
  loadDeck().sort((a,b)=>a-b).forEach(id=>{
    const src=$col.querySelector(`.card[data-card-id='${id}']`);
    if(src) moveCard(src,$deck,false);
  });
  sortCards($deck); updateStats();
  updateSlotIndicator();
}

/* === 移動卡片 === */
function moveCard(card,target,update=true){
  const intoDeck = target===$deck;
  const id=+card.dataset.cardId;

  if(intoDeck){
    if(deckTotal()>=MAX_DECK){ alert(`牌組已滿 ${MAX_DECK} 張`); return; }
    const left=(+card.dataset.left||0)-1;
    card.dataset.left=left;
    card.querySelector(".badge").textContent=`×${left}`;
    if(left===0) card.style.display="none";

    let ex=$deck.querySelector(`.card[data-card-id='${id}']`);
    if(ex){
      const b=ex.querySelector(".badge");
      b.textContent=`×${+b.textContent.slice(1)+1}`;
    }else{
      const clone=card.cloneNode(true);
      clone.removeChild(clone.querySelector(".badge"));
      const b=document.createElement("span");
      b.className="badge"; b.textContent="×1";
      clone.appendChild(b);
      clone.addEventListener("mouseenter",()=>showPreview(id));
      clone.addEventListener("mouseleave",hidePreview);
      let placed=false;
      for(const child of $deck.children){
        if(+child.dataset.cardId>id){$deck.insertBefore(clone,child);placed=true;break;}
      }
      if(!placed) $deck.appendChild(clone);
    }
  }else{                           // 從 deck 放回 collection
    const src=$col.querySelector(`.card[data-card-id='${id}']`);
    if(!src) return;
    src.style.display="";
    const left=(+src.dataset.left||0)+1;
    src.dataset.left=left;
    src.querySelector(".badge").textContent=`×${left}`;

    const b=card.querySelector(".badge");
    const cnt=+b.textContent.slice(1);
    if(cnt>1){ b.textContent=`×${cnt-1}`; }
    else{ card.remove(); }
  }
  if(update){ sortCards($col); sortCards($deck); updateStats(); }
}

/* === 清空牌組 === */
function clearDeck(){
  if(!$deck.children.length) return;
  if(!confirm("確定要清空牌組？")) return;
  while($deck.children.length){ moveCard($deck.children[0],$col,false); }
  sortCards($col); updateStats();
  saveDeck([]); alert("牌組已清空！");
}

/* === 模板匯入 === */
function applyTemplate(TPL,name){
  const owned=loadOwned(), miss=[];
  for(const [id,need] of Object.entries(TPL)){
    if((owned[id]||0)<need) miss.push(`ID ${id} ×${need-(owned[id]||0)}`);
  }
  if(miss.length){ alert(`缺少以下卡片，無法載入「${name}」：\n`+miss.join("\n")); return; }
  clearDeck();
  for(const [id,qty] of Object.entries(TPL)){
    for(let i=0;i<qty;i++){
      const src=$col.querySelector(`.card[data-card-id='${id}']`);
      if(src) moveCard(src,$deck,true);
    }
  }
  saveDeck(Object.entries(TPL).flatMap(([id,q])=>Array(q).fill(+id)));
  alert(`已載入「${name}」牌組！`);
}

/* === 統計 === */
function updateStats(){
  let tot=0,ener=0;
  [...$deck.children].forEach(c=>{
    const id=+c.dataset.cardId;
    const cnt=+c.querySelector(".badge").textContent.slice(1);
    tot+=cnt; ener+=(cardMap.get(id)?.energy||0)*cnt;
  });
  $cnt.textContent=tot;
  $ener.textContent=`總能量：${ener}`;
}

/* === Slot 相關 === */
function saveCurrentDeck(){
  const ids=[];
  [...$deck.children].forEach(c=>{
    const id=+c.dataset.cardId;
    const cnt=+c.querySelector(".badge").textContent.slice(1);
    ids.push(...Array(cnt).fill(id));
  });
  saveDeck(ids);
}
function switchSlot(n){
  if(n===currentSlot) return;
  if(n<1||n>TOTAL_SLOTS) return;
  if(autoSaveOnSwitch) saveCurrentDeck();
  currentSlot=n;
  renderDeck();
}
function updateSlotIndicator(){
  $slotBtns.forEach(btn=>{
    btn.classList.toggle("active",+btn.dataset.slot===currentSlot);
  });
  if($slotTag) $slotTag.textContent=`牌組 ${currentSlot}`;
}

/* === 初始化 === */
function init(){
  $col  = document.getElementById("collection");
  $deck = document.getElementById("deck");
  $cnt  = document.getElementById("deck-count");
  $ener = document.getElementById("energy-total");
  $prev = document.getElementById("preview-card");
  $slotBtns = document.querySelectorAll("[data-slot]");
  $slotTag  = document.getElementById("slot-tag");

  /* — Deck Slots — */
  $slotBtns.forEach(btn=>{
    btn.addEventListener("click",e=>switchSlot(+e.currentTarget.dataset.slot));
  });

  renderCollection(); renderDeck(); updateStats();

  document.addEventListener("click",e=>{
    const el=e.target.closest(".card");
    if(el) moveCard(el,el.parentElement===$deck?$col:$deck);
  });

  document.getElementById("clear-deck")?.addEventListener("click",clearDeck);
  document.getElementById("save-deck") ?.addEventListener("click",()=>{ saveCurrentDeck(); alert(`牌組 ${currentSlot} 已儲存！`); });
  document.getElementById("btn-load-aggro")   ?.addEventListener("click",()=>applyTemplate(AGGRO_TEMPLATE,"速攻"));
  document.getElementById("btn-load-finisher")?.addEventListener("click",()=>applyTemplate(FINISHER_TEMPLATE,"終盤制霸"));

  window.addEventListener("cards-updated",renderCollection);
  window.addEventListener("storage",e=>{ if(e.key===LS_OWNED) renderCollection(); });
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") renderCollection(); });
}
document.addEventListener("DOMContentLoaded",init);
