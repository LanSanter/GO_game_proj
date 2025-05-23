/****************************************************************
 * card_gacha.js  —— v3.4
 * --------------------------------------------------------------
 * 功能：
 *   1. 「開啟卡包」(#btn-open-pack) → 隨機抽 100 張 (ID 1‒50)，
 *      寫入 localStorage『myCards』並觸發全域事件『cards-updated』，
 *      **同時透過 socket.io 送到後端，讓自己的手牌即時同步**。
 *   2. 「清空卡牌」(#btn-clear-cards) → 清除 localStorage『myCards』，
 *      清畫面並觸發『cards-updated』。
 *   3. 初次載入與每次更新都在 #collection-zone 渲染持有卡庫，
 *      背景卡圖使用 .jpg，數量以 Badge 顯示。
 ****************************************************************/

// ------------------ 參數 ------------------
const TOTAL_CARDS = 200;
const MIN_ID      = 1;
const MAX_ID      = 50;
const STORAGE_KEY = "myCards";

const IMG_DIR = "/static/img/cards/";   // 卡圖 .jpg 存放路徑

// 若前端已透過 socket.io 連線並把 socket / roomId 掛在全域，可重用；
// 否則保留 null，不影響離線體驗。
const socket        = window.socket        || null;
const currentRoomId = window.currentRoomId || null;

// ------------------ DOM ID ----------------
const BTN_OPEN_ID  = "btn-open-pack";
const BTN_CLEAR_ID = "btn-clear-cards";
const RESULT_ID    = "result-zone";
const COLL_ID      = "collection-zone";

// ------------------ 工具 ------------------
const rand  = () => Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
const gacha = (n = TOTAL_CARDS) => Array.from({ length: n }, rand);

// localStorage helpers
const loadColl = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
};
const saveColl = (obj) => localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));

// 更新卡庫
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
// 全域事件（讓 deckbuilder 也能即時刷新）
function dispatchUpdate(coll) {
  window.dispatchEvent(new CustomEvent("cards-updated", { detail: coll }));
}

// ------------------ 後端同步 ------------------
/**
 * 把抽到的牌送往後端，後端會把這些牌塞進「自己」的手牌，
 * 並透過 hand:update 事件回傳給前端 battle/hand 區域。
 * - 需在全域掛好 `window.socket` 及 `window.currentRoomId`。
 */
function commitGachaDraw(cards) {
  if (!socket || !currentRoomId) return;     // 離線時可安全忽略
  if (!cards.length) return;
  socket.emit("gacha:draw", {
    room : currentRoomId,
    cards: cards             // 例如 [12, 7, 7]
  });
}

// ------------------ Render ------------------
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
  Object.entries(coll).forEach(([id, cnt]) =>
    parent.appendChild(makeCardDiv(+id, cnt)));
}

// ------------------ DOM Ready ------------------
window.addEventListener("DOMContentLoaded", () => {
  const btnOpen = document.getElementById(BTN_OPEN_ID);
  const btnClr  = document.getElementById(BTN_CLEAR_ID);
  const zoneRes = document.getElementById(RESULT_ID);
  const zoneCol = document.getElementById(COLL_ID);

  // 初次載入：渲染累積卡庫
  if (zoneCol) renderCollection(loadColl(), zoneCol);

  // 開啟卡包
  btnOpen?.addEventListener("click", () => {
    const cards = gacha();         // 抽出 100 張
    addCards(cards);               // 更新庫存 + 觸發事件
    commitGachaDraw(cards);        // 同步到後端手牌

    if (zoneRes) renderIds(cards, zoneRes);
    if (zoneCol) renderCollection(loadColl(), zoneCol);
  });

  // 清空卡牌
  btnClr?.addEventListener("click", () => {
    if (!confirm("確定要清空所有卡牌？此動作無法復原！")) return;
    clearCards();
    zoneRes && (zoneRes.innerHTML = "");
    zoneCol && (zoneCol.innerHTML = "");
  });
});
