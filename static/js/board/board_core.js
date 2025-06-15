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
    const cx = (x + 0.5) * cellSize;
    const cy = (y + 0.5) * cellSize;
    const RADIUS = cellSize / 2.5;

    // 棋子漸層
    const g = ctx.createRadialGradient(
        cx - RADIUS * 0.4, cy - RADIUS * 0.4, RADIUS * 0.1,
        cx, cy, RADIUS * 1.05
    );
    if (color === "black") {
        g.addColorStop(0, "#888");
        g.addColorStop(0.3, "#444");
        g.addColorStop(1, "#000");
    } else {
        g.addColorStop(0, "#fff");
        g.addColorStop(0.55, "#eee");
        g.addColorStop(1, "#aaa");
    }

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 棋子外框
    ctx.strokeStyle = "rgba(0,0,0,.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
    ctx.stroke();
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