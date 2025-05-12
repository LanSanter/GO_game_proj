import { convolutionByRowUpdate } from './conv.js';


const canvas = document.getElementById("board");
let selectedFilter = null;

window.onload = () => {
    loadFilterCards();
};


if (canvas) {
    

    const ctx = canvas.getContext("2d");
    const cellSize = 30;
    const boardSize = 19;
    let gameId = null;

    let currentColor = "black";
    let lastMove = null; //最新落子座標
    const boardState = Array.from({ length: boardSize }, () =>
        Array(boardSize).fill(null)
    );

    const currentColorRef = { value: currentColor };

    const socket = io();
    socket.on("connect", () => {
        socket.emit("new_game");
    });
    socket.on("game_created", (data) => {
        gameId = data.game_id;
        drawBoard();
    });
    socket.on("update_board", (data) => {
        const msgBox = document.getElementById("error-msg");
        const turnBox = document.getElementById("turn-indicator"); //當前執棋方
        

        if (data.captures) {
            for (let stone of data.captures) {
                boardState[stone[1]][stone[0]] = null;
            }
            redrawBoard();
        }
        if (data.success) {
            boardState[data.y][data.x] = data.color;
            lastMove = { x: data.x, y: data.y };
            redrawBoard();  // 會畫整盤 + 所有棋子 + 新紅框
            currentColor = (data.color === "black") ? "white" : "black";
            turnBox.textContent = (currentColor === "black") ? "⚫黑棋" : "⚪白棋";
            msgBox.textContent = "";
        } else {
            msgBox.textContent = data.message || "落子失敗";
        }
    });
    canvas.addEventListener("click", (e) => {
        const msgBox = document.getElementById("error-msg");
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (boardState[y][x] !== null) {
            msgBox.textContent = "該位置已有棋子！";
            return;
        }
        socket.emit("place_stone", { game_id: gameId, x: x, y: y, color: currentColor });
    });

    function redrawBoard() {
        drawBoard();
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const color = boardState[y][x];
                if (color) drawStone(x, y, color);
            }
        }
    
        if (lastMove) {
            drawHighlight(lastMove.x, lastMove.y);
        }
    }
    
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
    function drawStone(x, y, color) {
        ctx.beginPath();
        ctx.arc((x + 0.5) * cellSize, (y + 0.5) * cellSize, cellSize / 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }
    function drawHighlight(x, y) {
        const px = (x + 0.5) * cellSize;
        const py = (y + 0.5) * cellSize;
        const size = 6;
    
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "red";
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
        ctx.globalAlpha = 1.0;
    }

    function resetBoard() {
        socket.emit("reset_board", { game_id: gameId });
        for (let y = 0; y < boardSize; y++) {
            boardState[y].fill(null);
        }
        drawBoard();
        currentColor = "black";
    }

    // 暴露到全局函數
    document.getElementById("apply-btn").onclick = () => {
        if (!selectedFilter) return;
        convolutionByRowUpdate(
            boardState,
            boardSize,
            (x, y, color) => {
                socket.emit("place_stone", { game_id: gameId, x, y, color });
            },
            currentColorRef,
            () => {
                    socket.emit("apply_convolution", { game_id: gameId, filter: selectedFilter.id });
                },
            gameId,
            selectedFilter.matrix
        );
    };

    window.resetBoard = resetBoard;
}



function loadFilterCards() {
    fetch('/api/random_filters')
        .then(res => res.json())
        .then(filters => {
            const list = document.getElementById('filter-list');
            list.innerHTML = '';
            filters.forEach((filter, idx) => {
                const card = document.createElement('div');
                card.className = 'filter-card';
                card.dataset.id = filter.id;
                card.dataset.matrix = JSON.stringify(filter.matrix);
                card.innerHTML = `<strong>${filter.name}</strong>`;
                card.onclick = () => selectCard(card);
                list.appendChild(card);
            });
        });
}

function selectCard(card) {
    if (selectedFilter) return; // 已選擇過，不能再選
    card.classList.add('flipped');
    card.innerHTML = "已選擇";
    selectedFilter = {
        id: card.dataset.id,
        matrix: JSON.parse(card.dataset.matrix)
    };
    document.getElementById("apply-btn").disabled = false;
}





