const canvas = document.getElementById("board");
if (canvas) {
    const ctx = canvas.getContext("2d");
    const cellSize = 30;
    const boardSize = 19;
    let gameId = null;

    let currentColor = "black";
    const boardState = Array.from({ length: boardSize }, () =>
        Array(boardSize).fill(null)
    );

    const socket = io();
    socket.on("connect", () => {
        socket.emit("new_game");
    });
    socket.on("game_created", (data) => {
        gameId = data.game_id;
        drawBoard();
    });
    socket.on("update_board", (data) => {
        if (data.success) {
            drawStone(data.x, data.y, data.color);
            boardState[data.y][data.x] = data.color;
            currentColor = (data.color === "black") ? "white" : "black";
        }
    });
    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (boardState[y][x] !== null) {
            console.log("該位置已有棋子！");
            return;
        }
        socket.emit("place_stone", { game_id: gameId, x: x, y: y, color: currentColor });
    });

    
    function drawBoard() {
        ctx.fillStyle = "#8B7765";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    }
    function drawStone(x, y, color) {
        ctx.beginPath();
        ctx.arc((x + 0.5) * cellSize, (y + 0.5) * cellSize, cellSize / 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }
    function resetBoard() {
        socket.emit("reset_board", { game_id: gameId });
        for (let y = 0; y < boardSize; y++) {
            boardState[y].fill(null);
        }
        drawBoard();
        currentColor = "black";
    }
}