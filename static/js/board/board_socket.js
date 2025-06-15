import { boardState, currentColorRef, updateCurrentColor, resetGameState, setGameId, } from './board_state.js';
import { redrawBoard ,drawBoard} from './board_core.js';
import { territoryEstimate } from '../territory_estimate.js';

function initSocketEvents(socket, ctx, cellSize,gameIdRef,lastMove, territoryHistory,
    {
    onMessage,
    onTurnChanged
}) {
    socket.on("connect", () => {
        
        socket.emit("new_game");
    });

    socket.on("game_created", (data) => {
        gameIdRef.value = data.game_id;
        setGameId(data.game_id);
        console.log(gameIdRef.value);
        redrawBoard(ctx, boardState, cellSize, 19, lastMove.value);
    });

    socket.on("update_board", (data) => {
        if (data.captures) {
            for (let stone of data.captures) {
                boardState[stone[1]][stone[0]] = null;
            }
            redrawBoard(ctx, boardState, cellSize, 19, lastMove.value);
        }

        if (data.success) {
            boardState[data.y][data.x] = data.color;
            lastMove.value = { x: data.x, y: data.y };
            redrawBoard(ctx, boardState, cellSize, 19, lastMove.value);

            const next = (data.color === "black") ? "white" : "black";
            updateCurrentColor(next);
            onTurnChanged(next);
            onMessage("");  // 清空錯誤訊息

            // 領地估計並紀錄歷史
            const { nBlack, nWhite } = territoryEstimate(boardState, 19);
            territoryHistory.push({ black: nBlack, white: nWhite });

            drawTerritoryChart(territoryHistory);

        } else {
            onMessage(data.message || "落子失敗");
        }


        
    });
    
}

function emitResetBoard(socket, gameIdRef, ctx, boardState, boardSize, cellSize) {
    resetGameState(boardState, boardSize);
    socket.emit("reset_board", { game_id: gameIdRef.value });
    drawBoard(ctx, cellSize, boardSize);
}

let chartInstance = null;

function drawTerritoryChart(history) {
    const labels = history.map((_, i) => i + 1);
    const blackData = history.map(h => h.black);
    const whiteData = history.map(h => h.white);

    const data = {
        labels,
        datasets: [
            {
                label: "黑地",
                data: blackData,
                borderColor: "black",
                backgroundColor: "rgba(0,0,0,0.2)",
                fill: false,
                tension: 0.3,
            },
            {
                label: "白地",
                data: whiteData,
                borderColor: "gray",
                backgroundColor: "rgba(255,255,255,0.3)",
                fill: false,
                tension: 0.3,
            }
        ]
    };

    const config = {
        type: "line",
        data,
        options: {
            responsive: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                x: {
                    title: { display: true, text: "步數" }
                },
                y: {
                    title: { display: true, text: "地盤數量" },
                    beginAtZero: true
                }
            }
        }
    };

    // 如果已經存在 chart，先銷毀再重建
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById("territory-chart").getContext("2d");
    chartInstance = new Chart(ctx, config);
}


export {initSocketEvents, emitResetBoard};