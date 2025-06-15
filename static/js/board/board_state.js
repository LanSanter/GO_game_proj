const boardSize = 19;
const cellSize = 30;
const boardState = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
const gameIdRef = { value: null };
let lastMove = {value: null}; // 用於記錄最後一次落子位置
let currentColor = "black";
const currentColorRef = { value: currentColor };
const territoryHistory = [];

function resetGameState(boardState, boardSize) {
    for (let y = 0; y < boardSize; y++) boardState[y].fill(null);
    currentColor = "black";
}
function setGameId(id) { gameIdRef.value = id; }
function updateCurrentColor(color) {
    currentColor = color;
    currentColorRef.value = color;
}


export {boardSize, cellSize, boardState, gameIdRef, lastMove, currentColor, currentColorRef, territoryHistory, resetGameState, setGameId, updateCurrentColor}