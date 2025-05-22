// 主要功能：
//   1. 19×19 圍棋棋盤 (conv_mode 同步邏輯) + 立體棋子渲染
//   2. 提子（捕獲）規則 & 自殺禁著
//   3. 手牌區固定在視窗底部且置中排列，支援選取高亮（卡片上浮 + 陰影）
//   4. 簡易能量、抽牌、回合、重設按鈕
//   5. 可與 card_effect.js / AI 後端做進一步整合
//   6. ★ 新增：開局自動發 5 張牌；每回合結束自動抽 1 張牌
// --------------------------------------------------

// -------------------- DOM 取得 --------------------
const canvas   = document.getElementById("board");
const ctx      = canvas.getContext("2d");

const handDiv      = document.getElementById("hand") || document.getElementById("hand-zone");
const energySpan   = document.getElementById("energy");
const drawBtn      = document.getElementById("draw-card");
const endTurnBtn   = document.getElementById("end-turn");
const resetBtn     = document.getElementById("reset-board");

// -------------------- 手牌 UI 佈局 --------------------
(function initHandUI() {
  // 動態插入基本樣式，避免修改外部 CSS
  const style = /*css*/`
    #hand {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      justify-content: center;  /* 置中 */
      gap: 10px;
      z-index: 1000;
      pointer-events: auto;
    }
    #hand .card {
      width: 80px;
      height: 120px;
      background-size: cover;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
    }
    #hand .card:hover {
      transform: translateY(-12px) scale(1.08);
      box-shadow: 0 6px 14px rgba(0,0,0,0.45);
    }
    #hand .card.selected {
      transform: translateY(-20px) scale(1.12);
      box-shadow: 0 8px 18px rgba(0,0,0,0.55);
    }
    #card-preview.show {
      opacity: 1;
      pointer-events: none;
    }
  `;
  const styleTag = document.createElement("style");
  styleTag.textContent = style;
  document.head.appendChild(styleTag);
})();

// -------------------- 棋盤設定 --------------------
const BOARD_SIZE = 19;
const GRID_SIZE  = canvas.width / (BOARD_SIZE + 1);
const RADIUS     = GRID_SIZE * 0.42;

// board[row][col] : 0=空, 1=黑, 2=白
let board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
let currentPlayer = 1;

// -------------------- 初始化 --------------------
configureButtons();
injectPreviewBox();
drawBoard();
initGame();               // ★ 開局自動發 5 張牌

function configureButtons() {
  drawBtn?.addEventListener("click", drawCard);

  // 每回合結束：交換玩家並自動抽 1 張牌
  endTurnBtn?.addEventListener("click", () => {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    drawCard();                          // ★ 新回合抽 1
  });

  resetBtn?.addEventListener("click", resetBoard);
}

function injectPreviewBox() {
  if (document.getElementById("card-preview")) return;
  const prev = document.createElement("div");
  prev.id = "card-preview";
  Object.assign(prev.style, {
    position: "fixed",
    bottom: "12px",
    right: "12px",
    width: "160px",
    height: "240px",
    backgroundSize: "cover",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    opacity: 0,
    transition: "opacity 0.2s"
  });
  document.body.appendChild(prev);
}

// -------------------- 棋盤繪製 --------------------
function drawBoard() {
  // 木紋底色
  ctx.fillStyle = "#deb887";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 格線
  ctx.strokeStyle = "#000";
  ctx.lineWidth   = 1;
  for (let i = 1; i <= BOARD_SIZE; i++) {
    // 橫線
    ctx.beginPath();
    ctx.moveTo(GRID_SIZE,              GRID_SIZE * i);
    ctx.lineTo(GRID_SIZE * BOARD_SIZE, GRID_SIZE * i);
    ctx.stroke();
    // 直線
    ctx.beginPath();
    ctx.moveTo(GRID_SIZE * i, GRID_SIZE);
    ctx.lineTo(GRID_SIZE * i, GRID_SIZE * BOARD_SIZE);
    ctx.stroke();
  }

  // 星位 (19×19)
  if (BOARD_SIZE === 19) {
    [3, 9, 15].forEach(r => {
      [3, 9, 15].forEach(c => {
        ctx.beginPath();
        ctx.arc(GRID_SIZE * (c + 1), GRID_SIZE * (r + 1), RADIUS * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "#000";
        ctx.fill();
      });
    });
  }

  // 現有棋子
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) drawStone(r, c, board[r][c]);
    }
  }
}

function drawStone(row, col, player) {
  const x = GRID_SIZE * (col + 1);
  const y = GRID_SIZE * (row + 1);

  // 立體漸層
  const grad = ctx.createRadialGradient(
    x - RADIUS * 0.4, y - RADIUS * 0.4, RADIUS * 0.1,
    x, y, RADIUS * 1.05
  );

  if (player === 1) { // 黑
    grad.addColorStop(0,  "#888");
    grad.addColorStop(0.25,"#444");
    grad.addColorStop(1,  "#000");
  } else {            // 白
    grad.addColorStop(0,  "#fff");
    grad.addColorStop(0.55,"#eee");
    grad.addColorStop(1,  "#aaa");
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth   = 1;
  ctx.stroke();
}

// -------------------- 提子邏輯 --------------------
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];  // 四鄰

canvas.addEventListener("click", handleBoardClick);

function handleBoardClick(e) {
  const rect = canvas.getBoundingClientRect();
  const col  = Math.round((e.clientX - rect.left) / GRID_SIZE - 1);
  const row  = Math.round((e.clientY - rect.top ) / GRID_SIZE - 1);

  if (!inBounds(row, col) || board[row][col] !== 0) return;

  board[row][col] = currentPlayer;

  // 先抓對手群組，若無氣則提子
  const opp = currentPlayer === 1 ? 2 : 1;
  for (const [dx, dy] of DIRS) {
    const nr = row + dy, nc = col + dx;
    if (inBounds(nr, nc) && board[nr][nc] === opp) {
      const { liberties, group } = exploreGroup(nr, nc, opp);
      if (liberties === 0) removeGroup(group);
    }
  }

  // 檢查自殺
  const self = exploreGroup(row, col, currentPlayer);
  if (self.liberties === 0) {
    board[row][col] = 0;        // 撤回
    return;
  }

  currentPlayer = opp;
  redraw();
}

function exploreGroup(sr, sc, color) {
  const stack   = [[sr, sc]];
  const visited = new Set();
  const group   = [];
  let liberties = 0;

  while (stack.length) {
    const [r, c] = stack.pop();
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);
    group.push([r, c]);

    for (const [dx, dy] of DIRS) {
      const nr = r + dy, nc = c + dx;
      if (!inBounds(nr, nc)) continue;

      if (board[nr][nc] === 0) {
        liberties++;
      } else if (board[nr][nc] === color) {
        stack.push([nr, nc]);
      }
    }
  }
  return { liberties, group };
}

function removeGroup(group) {
  for (const [r, c] of group) board[r][c] = 0;
}

function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
}

// -------------------- 卡牌處理 --------------------
const MAX_HAND    = 10;
const TOTAL_CARDS = 50;
let   energy      = 0;
let   deckCounts  = [];       // 每種卡剩餘數量
let   hand        = [];
let   selectedCardEl = null;

/* ---------- 開局初始化 ---------- */
function initGame() {
  // 重置牌庫與手牌
  deckCounts = Array.from({ length: TOTAL_CARDS + 1 }, (_, i) => (i === 0 ? 0 : 2)); // 每種卡 2 張
  hand = [];
  handDiv.innerHTML = "";

  // 重置能量
  updateEnergy(2);

  // 發 5 張起手
  for (let i = 0; i < 5; i++) drawCard();
}

/* ---------- 抽牌 ---------- */
function drawCard() {
  if (hand.length >= MAX_HAND) return;

  // 可抽的卡 id
  const remainIds = [];
  deckCounts.forEach((cnt, id) => { if (cnt > 0) remainIds.push(id); });
  if (remainIds.length === 0) return;

  const id = remainIds[Math.floor(Math.random() * remainIds.length)];
  deckCounts[id]--;
  hand.push(id);

  const cardEl = createCardElement(id);
  handDiv.appendChild(cardEl);
}

/* ---------- 產生卡片元素 ---------- */
function createCardElement(id) {
  const el = document.createElement("div");
  el.className = "card";
  el.style.backgroundImage = `url('/static/img/cards/${id}.jpg')`;
  el.dataset.id = id;

  // Hover 預覽
  el.addEventListener("mouseenter", () => showPreview(id));
  el.addEventListener("mouseleave", hidePreview);

  // 點擊選取 / 取消選取
  el.addEventListener("click", () => selectCard(el));
  return el;
}

/* ---------- 選取 / 取消 ---------- */
function selectCard(target) {
  if (selectedCardEl === target) {           // 取消
    target.classList.remove("selected");
    selectedCardEl = null;
    return;
  }
  if (selectedCardEl) selectedCardEl.classList.remove("selected");
  target.classList.add("selected");
  selectedCardEl = target;
}

/* ---------- 預覽 ---------- */
function showPreview(id) {
  const prev = document.getElementById("card-preview");
  if (!prev) return;
  prev.style.backgroundImage = `url('/static/img/bg.png'), url('/static/img/cards/${id}.jpg')`;
  prev.classList.add("show");
}
function hidePreview() {
  document.getElementById("card-preview")?.classList.remove("show");
}

/* ---------- 打出卡片（示例） ---------- */
function handleCardPlay(id, el) {
  // TODO: 根據 card_effect.js 定義
  if (energy <= 0) return;
  updateEnergy(energy - 1);

  hand = hand.filter(cid => cid !== id);
  el.remove();
  if (selectedCardEl === el) selectedCardEl = null;
}

/* ---------- 能量顯示 ---------- */
function updateEnergy(val) {
  energy = Math.max(0, val);
  if (energySpan) energySpan.textContent = energy.toString();
}

/* ---------- 重設棋盤 ---------- */
function resetBoard() {
  board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
  redraw();

  // 同時重置牌組與能量
  initGame();
}

// -------------------- 匯出接口 (給其他模組呼叫) --------------------
export { board, currentPlayer, GRID_SIZE, handleBoardClick as placeStone };