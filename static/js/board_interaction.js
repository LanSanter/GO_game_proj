// interaction.js

let currentClickHandler = null;

export function clearClickHandlers(canvas) {
    if (currentClickHandler) {
        canvas.removeEventListener("click", currentClickHandler);
        currentClickHandler = null;
    }
}


export function registerBoardClickHandler({ canvas, cellSize, boardState, socket, gameIdRef, getCurrentColor, onMessage }) {
    clearClickHandlers(canvas);

    currentClickHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);

        if (boardState[y][x] !== null) {
            onMessage("該位置已有棋子！");
            return;
        }

        socket.emit("place_stone", {
            game_id: gameIdRef.value,
            x,
            y,
            color: getCurrentColor()
        });
    };

    canvas.addEventListener("click", currentClickHandler);
}

export function registerDeathReviewClickHandler({ canvas, cellSize, deathReview, statedraw }) {
    clearClickHandlers(canvas);
    statedraw();
    
    currentClickHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);

        deathReview.toggle(x, y);
        statedraw();
    };
    

    canvas.addEventListener("click", currentClickHandler);
}

