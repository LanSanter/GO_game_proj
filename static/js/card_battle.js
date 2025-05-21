/*******************************************************************************
 * Battle 模組（示範）— 從 localStorage.savedDeck 抽手牌並顯示
 * - 牌桌/棋盤邏輯仍用你原本 board.js；這裡只演示手牌呈現
 ******************************************************************************/
const LS_DECK = "savedDeck";
const deckIds = JSON.parse(localStorage.getItem(LS_DECK) || "[]");  // 已構建好的牌組
let drawPile  = [...deckIds];                                        // 一個牌堆
let hand      = [];

const $hand = document.getElementById("hand-zone");
const $handCount = document.getElementById("hand-count");

function makeCard(id){
  const div = document.createElement("div");
  div.className = "card";
  div.style.backgroundImage = `url('static/img/cards/${id}.jpg')`;
  div.dataset.cardId = id;
  return div;
}

function renderHand(){
  $hand.innerHTML = "";
  hand.forEach(id => $hand.appendChild(makeCard(id)));
  $handCount.textContent = hand.length;
}

/* === 抽牌按鈕 === */
document.getElementById("btn-draw").onclick = () => {
  if(!drawPile.length){ alert("牌堆已空！"); return; }
  hand.push(drawPile.shift());
  renderHand();
};
/* === 回合 / 重設示範 === */
document.getElementById("btn-pass").onclick = () => alert("結束回合 (示範)");
document.getElementById("btn-reset").onclick = () => location.reload();

/* === 初始化 === */
renderHand();   // 一開始可能是空手
