import { drawBoard, drawStone, drawHighlight } from './board_core.js';
import { territoryEstimate } from './territory_estimate.js';

class DeathReviewState {
    constructor(initialState) {
        this.state = initialState.map(row => row.slice()); // deep copy
    }
    //切換 Unchange <-> Remove
    toggle(x, y) {
        const current = this.state[y][x];
        this.state[y][x] = current === "Remove" ? "Unchange" : "Remove";
    }
    //取得目前標記狀態
    getState() {
        return this.state;
    }
    //在 canvas 上繪製紅色 ❌ 或灰色小點
    drawOverlay(ctx, cellSize) {
        for (let y = 0; y < 19; y++) {
            for (let x = 0; x < 19; x++) {
                const status = this.state[y][x];
                const px = (x + 0.5) * cellSize;
                const py = (y + 0.5) * cellSize;

                if (status === "Remove") {
                    ctx.strokeStyle = "red";
                    ctx.beginPath();
                    ctx.moveTo(px - 6, py - 6);
                    ctx.lineTo(px + 6, py + 6);
                    ctx.moveTo(px + 6, py - 6);
                    ctx.lineTo(px - 6, py + 6);
                    ctx.stroke();
                } else if (status === "Unchange") {
                    ctx.fillStyle = "rgba(0,0,0,0.2)";
                    ctx.beginPath();
                    ctx.arc(px, py, 2, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    }

    drawOnTop(ctx, cellSize, boardState, boardSize, lastMove) {
        // Draw board + stones + highlights
        drawBoard(ctx, cellSize, boardSize);
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const color = boardState[y][x];
                if (color) drawStone(ctx, x, y, cellSize, color);
            }
        }
        if (lastMove) drawHighlight(ctx, lastMove.x, lastMove.y, cellSize);

        // Draw overlay last
        this.drawOverlay(ctx, cellSize);
    }
}
//取得雙方標記 "Remove" 的交集。
function mergeConfirmedStates(stateA, stateB) {
    const merged = [];
    for (let y = 0; y < 19; y++) {
        merged[y] = [];
        for (let x = 0; x < 19; x++) {
            merged[y][x] = (stateA[y][x] === "Remove" && stateB[y][x] === "Remove") ? "Remove" : "Unchange";
        }
    }
    return merged;
}
//將 "Remove" 標記的位置從實際棋盤移除。
function applyFinalRemoval(boardState, confirmedState) {
    for (let y = 0; y < 19; y++) {
        for (let x = 0; x < 19; x++) {
            if (confirmedState[y][x] === "Remove") {
                boardState[y][x] = null;
            }
        }
    }
}


//地盤顯示函數
function drawTerritoryOverlay(ctx, territory, cellSize) {
  for (let y = 0; y < territory.length; y++) {
    for (let x = 0; x < territory[y].length; x++) {
      const owner = territory[y][x];
      if (!owner) continue;

      const px = (x + 0.5) * cellSize;
      const py = (y + 0.5) * cellSize;
      const size = 8;

      ctx.fillStyle = owner === "black" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)";
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
  }
}
// 完整棋盤領地繪製
function drawTerritoryOnTop(ctx, cellSize, boardState, boardSize, lastMove) {
        const { territory } = territoryEstimate(boardState, boardSize);
        // Draw board + stones + highlights
        drawBoard(ctx, cellSize, boardSize);
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const color = boardState[y][x];
                if (color) drawStone(ctx, x, y, cellSize, color);
            }
        }
        if (lastMove) drawHighlight(ctx, lastMove.x, lastMove.y, cellSize);

        // Draw overlay last
        drawTerritoryOverlay(ctx, territory, cellSize);
    }
export {DeathReviewState,  mergeConfirmedStates, applyFinalRemoval, drawTerritoryOnTop};
// DeathReviewState
// const newState = runBenson(boardstate, boardsize); 
// const Death_review = new DeathReviewState(newState);

//drawTerritoryOnTop
//drawTerritoryOnTop(ctx, cellSize, boardState, boardSize, lastMove);
//領地繼續在函數內呼叫執行