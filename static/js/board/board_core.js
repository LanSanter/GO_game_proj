function redrawBoard(ctx, boardState, cellSize, boardSize, lastMove) {
    drawBoard(ctx, cellSize, boardSize);
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const color = boardState[y][x];
            if (color) drawStone(ctx, x, y, cellSize,  color);
        }
    }

    if (lastMove) {
        drawHighlight(ctx, lastMove.x, lastMove.y, cellSize);
    }
}

function drawBoard(ctx, cellSize, boardSize) {
    ctx.fillStyle = "#8B7765";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = "black";
    for (let i = 0; i < boardSize; i++) {
        ctx.beginPath();
        ctx.moveTo(cellSize / 2, cellSize / 2 + i * cellSize);
        ctx.lineTo(cellSize * (boardSize - 0.5), cellSize / 2 + i * cellSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cellSize / 2 + i * cellSize, cellSize / 2);
        ctx.lineTo(cellSize / 2 + i * cellSize, cellSize * (boardSize - 0.5));
        ctx.stroke();
    }

    // 🎯 星位點座標
    const starCoords = [3, 9, 15];  // 第4、10、16行

    for (let i of starCoords) {
        for (let j of starCoords) {
            const x = (i + 0.5) * cellSize;
            const y = (j + 0.5) * cellSize;
            ctx.fillStyle = "black";
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);  // 半徑 3px 
            ctx.fill();
        }
    }
}
function drawStone(ctx, x, y, cellSize, color) {
    ctx.beginPath();
    ctx.arc((x + 0.5) * cellSize, (y + 0.5) * cellSize, cellSize / 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}
function drawHighlight(ctx, x, y, cellSize) {
    const px = (x + 0.5) * cellSize;
    const py = (y + 0.5) * cellSize;
    const size = 6;

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "red";
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
    ctx.globalAlpha = 1.0;
}



export {drawBoard, drawStone, drawHighlight, redrawBoard};