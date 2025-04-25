const convFilter = [
    [1,  0, -1],
    [-1, 0,  1],
    [1,  0, -1]
];
//將棋盤從19*19 變成21*21，保證卷積後棋盤大小不變
function getPaddedBoard(board, padding = 1) {
    const size = board.length;
    const padded = [];

    for (let y = -padding; y < size + padding; y++) {
        const row = [];
        for (let x = -padding; x < size + padding; x++) {
            if (x < 0 || y < 0 || x >= size || y >= size) {
                row.push(0);
            } else {
                const val = board[y][x];
                row.push(val === "black" ? 1 : val === "white" ? -1 : 0);
            }
        }
        padded.push(row);
    }

    return padded;
}

async function convolutionByRowUpdate(boardState, boardSize, emitPlaceStone, currentColorRef) {
    const padded = getPaddedBoard(boardState);
    const newMoves = [];

    // 清除棋盤（直接清空狀態，不呼叫 resetBoard）
    for (let y = 0; y < boardSize; y++) {
        boardState[y].fill(null);
    }

    const curcolor = currentColorRef.value;

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            let sum = 0;
            for (let dy = 0; dy < 3; dy++) {
                for (let dx = 0; dx < 3; dx++) {
                    const py = y + dy;
                    const px = x + dx;
                    sum += padded[py][px] * convFilter[dy][dx];
                }
            }

            const color = sum > 0 ? "black" : sum < 0 ? "white" : null;

            if (color && boardState[y][x] === null) {
                newMoves.push({ x, y, color });
            }
        }

        const thisRow = newMoves.filter(m => m.y === y);
        for (const move of thisRow) {
            emitPlaceStone(move.x, move.y, move.color);
            await delay(15);
        }
    }

    currentColorRef.value = curcolor;
}

export {convolutionByRowUpdate, getPaddedBoard, convFilter}