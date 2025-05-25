/****************************************************************
 * card_deckbuilder.js  —— v4.01
 * - 110 張上限
 * - 速攻 / 終盤制霸 模板
 * - 清空牌組：回收所有卡並重置 savedDeck
 ****************************************************************/

/* === 基本常數 === */
const MAX_CARD_ID = 60;          // 若有更高編號請調大
const MAX_DECK    = 110;
const IMG_DIR     = "/static/img/cards/";
const LS_OWNED    = "myCards";
const LS_DECK     = "savedDeck";

/* === 速攻模板 === */
const AGGRO_TEMPLATE = {
  1:  8,  2: 6,  3: 6,  4: 6,  5: 6,  6: 4,  7: 6,  8: 4,  9: 2,
 10: 10, 11: 4, 12: 4, 13: 4, 14: 8, 15: 4, 16: 4,
 17: 4, 18: 4, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 24: 4, 25: 2
}; // 110

/* === 終盤制霸模板（請依實際 ID 調整） === */
const FINISHER_TEMPLATE = {
 10:10, 11:6, 12:4, 26:4, 13:4, 27:2, 14:6, 15:4,
 17:4, 28:4, 23:4, 29:4, 21:4, 22:4, 19:4, 20:2, 30:2,
 16:4, 31:2, 32:2,
 33:4, 18:4, 34:4, 24:4, 8:4, 9:4, 35:2, 25:2, 36:2
}; // 110

/* === 卡片能量示例 === */
const cards = Array.from({ length: MAX_CARD_ID }, (_, i) => ({
  id: i + 1,
  energy: (i % 3) + 1,
}));
const cardMap = new Map(cards.map(c => [c.id, c]));

/* === DOM refs === */
let $col, $deck, $cnt, $ener, $prev;

/* === localStorage helpers === */
const loadOwned = () => JSON.parse(localStorage.getItem(LS_OWNED) || "{}");
const saveDeck  = arr => localStorage.setItem(LS_DECK, JSON.stringify(arr));
const loadDeck  = () => JSON.parse(localStorage.getItem(LS_DECK) || "[]");

/* === utils === */
const sortCards = c => [...c.children]
  .sort((a, b) => +a.dataset.cardId - +b.dataset.cardId)
  .forEach(el => c.appendChild(el));

const deckTotal = () =>
  [...$deck.children]
    .reduce((s, c) => s + parseInt(c.querySelector(".badge").textContent.slice(1)), 0);

/* === 建立卡片元素 === */
function makeCard(id, qty) {
  const d = document.createElement("div");
  d.className = "card";
  d.dataset.cardId = id;
  if (qty != null) {
    d.dataset.left = qty;
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = `×${qty}`;
    d.appendChild(b);
  }
  d.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  d.addEventListener("mouseenter", () => showPreview(id));
  d.addEventListener("mouseleave", hidePreview);
  return d;
}

/* === 預覽 === */
function showPreview(id) {
  if ($prev) {
    $prev.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
    $prev.style.display = "block";
  }
}
function hidePreview() { $prev && ($prev.style.display = "none"); }

/* === 渲染收藏 === */
function renderCollection() {
  $col.innerHTML = "";
  Object.entries(loadOwned())
    .sort((a, b) => +a[0] - +b[0])
    .forEach(([id, cnt]) => $col.appendChild(makeCard(+id, cnt)));
  sortCards($col);
}

/* === 渲染牌組 === */
function renderDeck() {
  $deck.innerHTML = "";
  loadDeck().sort((a, b) => a - b).forEach(id => {
    const src = $col.querySelector(`.card[data-card-id='${id}']`);
    if (src) moveCard(src, $deck, false);
  });
  sortCards($deck);
  updateStats();
}

/* === 移動卡片 === */
function moveCard(card, target, update = true) {
  const intoDeck = target === $deck;
  const id = +card.dataset.cardId;

  if (intoDeck) {
    if (deckTotal() >= MAX_DECK) {
      alert(`牌組已滿 ${MAX_DECK} 張`);
      return;
    }
    // 收藏 -1
    const left = (+card.dataset.left || 0) - 1;
    card.dataset.left = left;
    card.querySelector(".badge").textContent = `×${left}`;
    if (left === 0) card.style.display = "none";

    // Deck +
    let ex = $deck.querySelector(`.card[data-card-id='${id}']`);
    if (ex) {
      const b = ex.querySelector(".badge");
      b.textContent = `×${parseInt(b.textContent.slice(1)) + 1}`;
    } else {
      const clone = card.cloneNode(true);
      clone.removeChild(clone.querySelector(".badge"));
      clone.removeAttribute("data-left");
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = "×1";
      clone.appendChild(b);
      clone.addEventListener("mouseenter", () => showPreview(id));
      clone.addEventListener("mouseleave", hidePreview);

      let placed = false;
      for (const child of $deck.children) {
        if (+child.dataset.cardId > id) {
          $deck.insertBefore(clone, child);
          placed = true;
          break;
        }
      }
      if (!placed) $deck.appendChild(clone);
    }
  } else {
    // 從 Deck 移回
    const src = $col.querySelector(`.card[data-card-id='${id}']`);
    if (!src) return;
    src.style.display = "";
    const left = (+src.dataset.left || 0) + 1;
    src.dataset.left = left;
    src.querySelector(".badge").textContent = `×${left}`;

    const b = card.querySelector(".badge");
    const cnt = parseInt(b.textContent.slice(1));
    if (cnt > 1) {
      b.textContent = `×${cnt - 1}`;
    } else {
      card.remove();
    }
  }

  if (update) {
    sortCards($col);
    sortCards($deck);
    updateStats();
  }
}

/* === 套用模板 === */
function applyTemplate(TPL, name) {
  const owned = loadOwned();
  const miss = [];
  for (const [id, need] of Object.entries(TPL)) {
    if ((owned[id] || 0) < need) miss.push(`ID ${id} ×${need - (owned[id] || 0)}`);
  }
  if (miss.length) {
    alert(`缺少以下卡片，無法載入「${name}」：\n` + miss.join("\n"));
    return;
  }
  // 清空 deck
  [...$deck.children].forEach(c => moveCard(c, $col, false));
  // 匯入
  for (const [id, qty] of Object.entries(TPL)) {
    for (let i = 0; i < qty; i++) {
      const src = $col.querySelector(`.card[data-card-id='${id}']`);
      if (src) moveCard(src, $deck, true);
    }
  }
  saveDeck(Object.entries(TPL).flatMap(([id, q]) => Array(q).fill(+id)));
  alert(`已載入「${name}」牌組！`);
}

/* === 統計 === */
function updateStats() {
  let tot = 0, ener = 0;
  [...$deck.children].forEach(c => {
    const id = +c.dataset.cardId;
    const cnt = parseInt(c.querySelector(".badge").textContent.slice(1));
    tot += cnt;
    ener += (cardMap.get(id)?.energy || 0) * cnt;
  });
  $cnt.textContent = tot;
  $ener.textContent = `總能量：${ener}`;
}

/* === 初始化 === */
function init() {
  $col  = document.getElementById("collection");
  $deck = document.getElementById("deck");
  $cnt  = document.getElementById("deck-count");
  $ener = document.getElementById("energy-total");
  $prev = document.getElementById("preview-card");

  renderCollection();
  renderDeck();
  updateStats();

  /* 點擊卡片搬移 */
  document.addEventListener("click", e => {
    const el = e.target.closest(".card");
    if (el) moveCard(el, el.parentElement === $deck ? $col : $deck);
  });

  /* ==== 功能按鈕 ==== */
  // 清空牌組
  document.getElementById("clear-deck")?.addEventListener("click", () => {
    if (!$deck.children.length) return;
    if (!confirm("確定要清空牌組？")) return;
    [...$deck.children].forEach(c => moveCard(c, $col, false));
    sortCards($col);
    updateStats();
    saveDeck([]);                       // ← 直接將 savedDeck 重置為空
    alert("牌組已清空！");
  });

  // 儲存
  document.getElementById("save-deck")?.addEventListener("click", () => {
    const ids = [];
    [...$deck.children].forEach(c => {
      const id = +c.dataset.cardId;
      const cnt = parseInt(c.querySelector(".badge").textContent.slice(1));
      ids.push(...Array(cnt).fill(id));
    });
    saveDeck(ids);
    alert("牌組已儲存！");
  });

  // 模板
  document.getElementById("btn-load-aggro")
    ?.addEventListener("click", () => applyTemplate(AGGRO_TEMPLATE, "速攻"));
  document.getElementById("btn-load-finisher")
    ?.addEventListener("click", () => applyTemplate(FINISHER_TEMPLATE, "終盤制霸"));

  /* 同步收藏 */
  window.addEventListener("cards-updated", renderCollection);
  window.addEventListener("storage", e => { if (e.key === LS_OWNED) renderCollection(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderCollection();
  });
}

document.addEventListener("DOMContentLoaded", init);
