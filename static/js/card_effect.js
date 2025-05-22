// ============================
// card_effect.js  ‑  完整示範檔
// ============================
// 將所有 1 ~ 50 號卡牌先分為幾大類：
//   1  棋  ‑ 單顆棋子            (id 1)
//   2  長  ‑ 兩顆連續 (直/橫)    (id 2)
//   3  尖  ‑ 兩顆斜向            (id 3)
//   4  跳  ‑ 間隔 1 格兩顆連線   (id 4)
//   5  大跳 ‑ 間隔 2 格連線     (id 5)
//   6  飛  ‑ 「日」字對角        (id 6)
//   7‑50  先預設都 = 單顆棋子
//
// 🔸 介面設計：
//   每個 effect 皆為 (board, color, params) ⇒ { ok, board, msg? }
//   ‑ board  為 2D 陣列 (0=空,1=黑,2=白) ——**務必回傳新的拷貝**
//   ‑ color  為 1 或 2
//   ‑ params.anchor = {x,y}; params.dir = 'h'|'v'|'diag1'|'diag2'
//   ‑ needDir = true 代表出牌時會跳方向面板
//
// 🔸 若想增加新卡：直接在最下方 `effects[id] = {...}` 填入即可
// ============================================================

export const CARD_EFFECTS = (() => {
  const effects = {};

  // ---------- 工具 ----------
  const copyBoard = (b) => b.map(row => row.slice());
  const isInside  = (b, x, y) => y >= 0 && y < b.length && x >= 0 && x < b[0].length;

  // ---------- 基本模板 ----------
  const makeSingle = (cost = 1) => ({
    cost,
    needDir: false,
    effect: (board, color, { anchor }) => {
      if (!anchor) return { ok: false };
      const { x, y } = anchor;
      if (!isInside(board, x, y) || board[y][x] !== 0) return { ok: false, msg: '已有棋子' };
      const nb = copyBoard(board);
      nb[y][x] = color;
      return { ok: true, board: nb };
    }
  });

  const makeLine2 = (cost = 2) => ({
    cost,
    needDir: true,
    effect: (board, color, { anchor, dir }) => {
      if (!anchor || !dir) return { ok: false };
      const { x, y } = anchor;
      const dirMap = { h: [1, 0], v: [0, 1] };
      const [dx, dy] = dirMap[dir] || [1, 0];
      const x2 = x + dx, y2 = y + dy;
      if (!isInside(board, x2, y2) || board[y][x] || board[y2][x2]) return { ok: false };
      const nb = copyBoard(board);
      nb[y][x] = nb[y2][x2] = color;
      return { ok: true, board: nb };
    }
  });

  const makeDiag2 = (cost = 2) => ({
    cost,
    needDir: true,
    effect: (board, color, { anchor, dir }) => {
      if (!anchor || !dir) return { ok: false };
      const { x, y } = anchor;
      const dirMap = { diag1: [1, 1], diag2: [1, -1] };
      const [dx, dy] = dirMap[dir] || [1, 1];
      const x2 = x + dx, y2 = y + dy;
      if (!isInside(board, x2, y2) || board[y][x] || board[y2][x2]) return { ok: false };
      const nb = copyBoard(board);
      nb[y][x] = nb[y2][x2] = color;
      return { ok: true, board: nb };
    }
  });

  const makeJump = (gap, cost = 2) => ({
    cost,
    needDir: true,
    effect: (board, color, { anchor, dir }) => {
      if (!anchor || !dir) return { ok: false };
      const { x, y } = anchor;
      const dirMap = { h: [1, 0], v: [0, 1], diag1: [1, 1], diag2: [1, -1] };
      const [dx, dy] = dirMap[dir] || [1, 0];
      const xm = x + dx, ym = y + dy;           // 中間格
      const x2 = x + dx * (gap + 1), y2 = y + dy * (gap + 1);
      if (!isInside(board, x2, y2) || board[y][x] || board[y2][x2] || board[ym][xm]) return { ok: false };
      const nb = copyBoard(board);
      nb[y][x] = nb[y2][x2] = color;
      return { ok: true, board: nb };
    }
  });

  const makeFly = (cost = 2) => ({
    cost,
    needDir: false,
    effect: (board, color, { anchor }) => {
      if (!anchor) return { ok: false };
      const { x, y } = anchor;
      const x2 = x + 1, y2 = y + 1;
      if (!isInside(board, x2, y2) || board[y][x] || board[y2][x2]) return { ok: false };
      const nb = copyBoard(board);
      nb[y][x] = nb[y2][x2] = color;
      return { ok: true, board: nb };
    }
  });

  // ---------- 卡牌註冊 ----------
  effects['1'] = makeSingle(1);          // 棋
  effects['2'] = makeLine2(2);           // 長
  effects['3'] = makeDiag2(2);           // 尖
  effects['4'] = makeJump(1, 2);         // 跳
  effects['5'] = makeJump(2, 2);         // 大跳
  effects['6'] = makeFly(2);             // 飛

  // 其餘未定義者 → 預設單顆棋子 (cost = 1)
  for (let id = 7; id <= 50; id++) {
    if (!effects[id]) effects[id] = makeSingle(1);
  }

  return effects;
})();

