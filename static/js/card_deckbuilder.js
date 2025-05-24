/****************************************************************
 * card_deckbuilder.js  —— v3.6  (for your HTML ids)
 ****************************************************************/

/* === 常數 === */
const MAX_CARD_ID = 50;
const MAX_DECK    = 110;                       // ← 依 HTML 更新
const IMG_DIR     = "/static/img/cards/";
const LS_OWNED    = "myCards";
const LS_DECK     = "savedDeck";

/* === 卡片基礎資料（示範能量） === */
const cards = Array.from({ length: MAX_CARD_ID }, (_, i) => ({
  id: i + 1,
  energy: (i % 3) + 1,
}));
const cardMap = new Map(cards.map(c => [c.id, c]));

/* === DOM 變數（init 後指派） === */
let $col, $deck, $cnt, $ener, $prev;

/* === localStorage helpers === */
const loadOwned = () => JSON.parse(localStorage.getItem(LS_OWNED) || "{}");
const saveDeck  = arr  => localStorage.setItem(LS_DECK, JSON.stringify(arr));
const loadDeck  = ()   => JSON.parse(localStorage.getItem(LS_DECK) || "[]");

/* === 卡片元素工廠 === */
function makeCard(id, qty) {
  const div = document.createElement("div");
  div.className      = "card";
  div.dataset.cardId = id;
  if (qty != null) div.dataset.left = qty;
  div.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;

  if (qty != null) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `×${qty}`;
    div.appendChild(badge);
  }
  div.addEventListener("mouseenter", () => showPreview(id));
  div.addEventListener("mouseleave", hidePreview);
  return div;
}

/* === 預覽 === */
function showPreview(id) {
  if (!$prev) return;
  $prev.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  $prev.style.display = "block";
}
function hidePreview() {
  if ($prev) $prev.style.display = "none";
}

/* === 渲染持有卡庫 === */
function renderCollection() {
  if (!$col) return;
  $col.innerHTML = "";
  const owned = loadOwned();
  Object.entries(owned).forEach(([id, cnt]) =>
    $col.appendChild(makeCard(+id, cnt))
  );
}

/* === 渲染牌組（先清空再依 loadDeck 呼 moveCard） === */
function renderDeck() {
  if (!$deck) return;
  $deck.innerHTML = "";
  loadDeck().forEach(id => {
    const src = $col.querySelector(`.card[data-card-id='${id}']`);
    if (src) moveCard(src, $deck, false);
  });
  updateStats();
}

/* === 移動卡片（含堆疊顯示） === */
function moveCard(cardEl, target, update = true) {
  if (!$col || !$deck) return;
  const intoDeck = target === $deck;
  const id = +cardEl.dataset.cardId;

  if (intoDeck) {
    // 牌組已滿檢查
    if ($deck.children.length >= MAX_DECK) {
      alert(`牌組已滿 ${MAX_DECK} 張`);
      return;
    }
    // 調整收藏庫數量
    const left = (+cardEl.dataset.left || 0) - 1;
    cardEl.dataset.left = left;
    const badgeCol = cardEl.querySelector(".badge");
    badgeCol.textContent = `×${left}`;
    if (left === 0) cardEl.style.display = "none";

    // 若牌組已有此卡，則增加堆疊
    let existing = $deck.querySelector(`.card[data-card-id='${id}']`);
    if (existing) {
      let badge = existing.querySelector('.badge');
      let count = parseInt(badge.textContent.slice(1)) + 1;
      badge.textContent = `×${count}`;
    } else {
      // 否則新建卡片並加上 Badge
      const clone = cardEl.cloneNode(true);
      clone.removeChild(clone.querySelector(".badge"));
      clone.removeAttribute("data-left");
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = '×1';
      clone.appendChild(badge);
      clone.addEventListener("mouseenter", () => showPreview(id));
      clone.addEventListener("mouseleave", hidePreview);
      $deck.appendChild(clone);
    }

  } else {
    // 從牌組移回收藏庫
    const src = $col.querySelector(`.card[data-card-id='${id}']`);
    if (!src) return;
    src.style.display = "";
    const left = (+src.dataset.left || 0) + 1;
    src.dataset.left = left;
    src.querySelector(".badge").textContent = `×${left}`;

    // 處理牌組堆疊
    let badge = cardEl.querySelector('.badge');
    let count = parseInt(badge.textContent.slice(1));
    if (count > 1) {
      badge.textContent = `×${count - 1}`;
    } else {
      cardEl.remove();
    }
  }
  if (update) updateStats();
}

/* === 更新統計 === */
function updateStats() {
  if (!$cnt || !$ener || !$deck) return;
  // 計算總張數與能量
  let total = 0;
  let energy = 0;
  [...$deck.children].forEach(c => {
    const id = +c.dataset.cardId;
    const count = parseInt(c.querySelector('.badge').textContent.slice(1));
    total += count;
    energy += cardMap.get(id).energy * count;
  });
  $cnt.textContent  = total;
  $ener.textContent = `總能量：${energy}`;
}

/* === 初始化 === */
function init() {
  /* 1. 抓 DOM */
  $col  = document.getElementById("collection");
  $deck = document.getElementById("deck");
  $cnt  = document.getElementById("deck-count");
  $ener = document.getElementById("energy-total");
  $prev = document.getElementById("preview-card");

  /* 2. 初次渲染 */
  renderCollection();
  renderDeck();
  updateStats();

  /* 3. 點擊事件 */
  document.addEventListener("click", e => {
    const el = e.target.closest(".card");
    if (!el || !$deck) return;
    moveCard(el, el.parentElement === $deck ? $col : $deck);
  });

  /* 4. 功能按鈕 */
  if ($deck) {
    document.getElementById("clear-deck")?.addEventListener("click", () => {
      [...$deck.children].forEach(c => moveCard(c, $col));
    });
    document.getElementById("save-deck")?.addEventListener("click", () => {
      const ids = [];
      [...$deck.children].forEach(c => {
        const id = +c.dataset.cardId;
        const count = parseInt(c.querySelector('.badge').textContent.slice(1));
        for (let i=0; i<count; i++) ids.push(id);
      });
      saveDeck(ids);
      alert("牌組已儲存！");
    });
  }

  /* 5. 同頁抽卡更新 */
  window.addEventListener("cards-updated", renderCollection);

  /* 6. 跨分頁 storage 事件 */
  window.addEventListener("storage", e => {
    if (e.key === LS_OWNED) renderCollection();
  });

  /* 7. 分頁聚焦時刷新一次 */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderCollection();
  });
}

/* === DOM 完成再執行 === */
document.addEventListener("DOMContentLoaded", init);