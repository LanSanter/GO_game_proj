const canvas = document.getElementById("board");
if (canvas) {
    const ctx = canvas.getContext("2d");
    const cellSize = 30;
    const boardSize = 19;
    let gameId = null;

    const socket = io();

    //socket.emit("new_game");
    socket.on("connect", () => {
        socket.emit("new_game");
    });
    // 未設計連線系統

    socket.on("game_created", (data) => {
        gameId = data.game_id;
        drawBoard();
    });

    socket.on("update_board", (data) => {
        if (data.success) drawStone(data.x, data.y, data.color);
    });

    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        socket.emit("place_stone", { game_id: gameId, x: x, y: y, color: "black" });
    });

    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < boardSize; i++) {
            ctx.beginPath();
            ctx.moveTo(cellSize / 2, cellSize / 2 + i * cellSize);
            ctx.lineTo(cellSize * (boardSize - 0.5), cellSize / 2 + i * cellSize);
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
}

function resetBoard() {
    socket.emit("reset_board", { game_id: gameId });
}
