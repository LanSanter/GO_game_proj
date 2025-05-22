// card_gacha.js  —— v3.3 (顯示卡圖 .jpg + 數量徽章)
// ------------------------------------------------------------
// 功能：
//   1. 「開啟卡包」(#btn-open-pack) → 隨機抽 100 張 (ID 1‒50)，
//      寫入 localStorage『myCards』並觸發全域事件『cards-updated』。
//   2. 「清空卡牌」(#btn-clear-cards) → 移除 localStorage『myCards』、
//      清畫面、同樣觸發『cards-updated』。
//   3. 初次載入與每次更新都在 #collection-zone 渲染持有卡庫，
//      格式與 deckbuilder 一致：背景卡圖 + 數量 Badge。
// ------------------------------------------------------------

const TOTAL_CARDS = 100;
const MIN_ID      = 1;
const MAX_ID      = 50;
const STORAGE_KEY = "myCards";

const IMG_DIR     = "/static/img/cards/"; // .jpg 圖檔路徑

// === DOM 元素 ID ===
const BTN_OPEN_ID  = "btn-open-pack";
const BTN_CLEAR_ID = "btn-clear-cards";
const RESULT_ID    = "result-zone";
const COLL_ID      = "collection-zone";

// ---------- 工具 ----------
const rand  = () => Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
const gacha = (n = TOTAL_CARDS) => Array.from({ length: n }, rand);

function loadColl() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveColl(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}
function addCards(arr) {
  const coll = loadColl();
  arr.forEach((id) => (coll[id] = (coll[id] || 0) + 1));
  saveColl(coll);
  dispatchUpdate(coll);
  return coll;
}
function clearCards() {
  localStorage.removeItem(STORAGE_KEY);
  dispatchUpdate({});
}
function dispatchUpdate(coll) {
  window.dispatchEvent(new CustomEvent("cards-updated", { detail: coll }));
}

// ---------- Render ----------
function makeCardDiv(id, qty = null) {
  const d = document.createElement("div");
  d.className = "card";
  d.style.backgroundImage = `url('${IMG_DIR}${id}.jpg')`;
  if (qty !== null) {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = `×${qty}`;
    d.appendChild(b);
  }
  return d;
}

function renderIds(arr, parent) {
  parent.innerHTML = "";
  arr.forEach((id) => parent.appendChild(makeCardDiv(id)));
}
function renderCollection(coll, parent) {
  parent.innerHTML = "";
  Object.entries(coll).forEach(([id, cnt]) => {
    parent.appendChild(makeCardDiv(+id, cnt));
  });
}

// ---------- DOM Ready ----------
window.addEventListener("DOMContentLoaded", () => {
  const btnOpen = document.getElementById(BTN_OPEN_ID);
  const btnClr  = document.getElementById(BTN_CLEAR_ID);
  const zoneRes = document.getElementById(RESULT_ID);
  const zoneCol = document.getElementById(COLL_ID);

  // 初次載入渲染累積卡庫
  if (zoneCol) renderCollection(loadColl(), zoneCol);

  // 開啟卡包
  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      const cards = gacha();            // 抽出 100 張
      addCards(cards);                  // 更新庫存 + 觸發事件
      if (zoneRes) renderIds(cards, zoneRes);
      if (zoneCol) renderCollection(loadColl(), zoneCol);
    });
  }

  // 清空卡牌
  if (btnClr) {
    btnClr.addEventListener("click", () => {
      if (!confirm("確定要清空所有卡牌？此動作無法復原！")) return;
      clearCards();
      if (zoneRes) zoneRes.innerHTML = "";
      if (zoneCol) zoneCol.innerHTML = "";
    });
  }
});