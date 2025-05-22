// card_effects.js – 定義每張卡牌在對戰時的具體效果
// 此檔會被 card_battle.js 以 ES module 方式匯入：
// import { CARD_EFFECTS } from "./card_effects.js";
//
// ─────────────────────────────────────────────────────────────
// 匯出一個物件：key = 卡牌 id (數字 1~50)，value = 執行效果的函式
// 函式接收一個 context 物件，常用屬性如下：
//   board           → 棋盤物件，需要提供 placeStone(x,y,player)… 等 API
//   currentPlayer   → 0 (黑) 或 1 (白)
//   consumeEnergy() → 呼叫後會扣除該卡牌能量（由 battle 模組注入）
//   discard()       → 把此卡牌從手牌丟到棄牌堆（由 battle 模組注入）
// 可回傳 promise 以處理非同步（例如等待玩家點擊棋盤）。
//
// ★ 注意：以下僅示範 7 張卡，請依實際 50 張能力需求擴充 ★

export const CARD_EFFECTS = {
  // id:1  ──「棋」：放置 1 顆己方棋子到任意空點
  1: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();                       // 扣能量
    const { x, y } = await board.waitForClick();   // 讓玩家點棋盤
    board.placeStone(x, y, currentPlayer);
    discard();
  },

  // id:3  ──「長」：放置 2 顆直/橫相鄰棋子
  3: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();
    const line = await board.waitForLine(2, ["horizontal", "vertical"]);
    line.forEach(({ x, y }) => board.placeStone(x, y, currentPlayer));
    discard();
  },

  // id:5  ──「尖」：放置 2 顆斜向相鄰棋子
  5: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();
    const line = await board.waitForLine(2, ["diagonal"]);
    line.forEach(({ x, y }) => board.placeStone(x, y, currentPlayer));
    discard();
  },

  // id:7  ──「跳」：兩顆棋子中間隔 1 格
  7: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();
    const pattern = await board.waitForJump(1); // 自訂 API：跳 1 格
    pattern.forEach(({ x, y }) => board.placeStone(x, y, currentPlayer));
    discard();
  },

  // id:9  ──「大跳」：隔 2 格
  9: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();
    const pattern = await board.waitForJump(2);
    pattern.forEach(({ x, y }) => board.placeStone(x, y, currentPlayer));
    discard();
  },

  // id:11 ──「飛」：日字對角（示例）
  11: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();
    const coords = await board.waitForPattern([[0,0],[2,1]]); // 自訂入參
    coords.forEach(({ x, y }) => board.placeStone(x, y, currentPlayer));
    discard();
  },

  // id:13 ──「象」：斜線兩顆，距離 2
  13: async ({ board, currentPlayer, consumeEnergy, discard }) => {
    consumeEnergy();
    const diag = await board.waitForDiagonal(2);
    diag.forEach(({ x, y }) => board.placeStone(x, y, currentPlayer));
    discard();
  }

  // …… 其餘 50 張請依需求繼續擴充 ……
};
