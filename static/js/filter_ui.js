import { convolutionByRowUpdate } from "./conv.js";
// 建立卡片選擇器模組
export function createCardSelector(uiFns) {
    let selectedCardElement = null;
    let selectedFilter = null;
    let filterUsed = {
        black: false,
        white: false
    };

    return {
        getSelectedFilter: () => selectedFilter,
        getFilterUser: () => filterUsed,
        reset: () => {
            if (selectedCardElement) selectedCardElement.classList.remove("selected");
            selectedCardElement = null;
            selectedFilter = null;
            uiFns.setButtonDisabled(true);
        },
        selectCard: (card) => {
            if (card.classList.contains("flipped")) return;

            if (selectedCardElement === card) {
                card.classList.remove("selected");
                selectedCardElement = null;
                selectedFilter = null;
                uiFns.setButtonDisabled(true);
                return;
            }

            if (selectedCardElement) selectedCardElement.classList.remove("selected");

            card.classList.add("selected");
            selectedCardElement = card;
            selectedFilter = {
                id: card.dataset.id,
                matrix: JSON.parse(card.dataset.matrix)
            };
            uiFns.setButtonDisabled(false);
        },
        markUsed: () => {
            if (selectedCardElement) {
                selectedCardElement.classList.remove("selected");
                selectedCardElement.classList.add("flipped");
                selectedCardElement = null;
                selectedFilter = null;
                uiFns.setButtonDisabled(true);
            }
        }
    };
}

// 將卡片渲染至指定容器，並使用 callback 處理點擊
export function renderFilterCards(filters, { container, onSelect }) {
    container.innerHTML = '';

    filters.forEach(filter => {
        const card = document.createElement('div');
        card.className = 'filter-card';
        card.dataset.id = filter.id;
        card.dataset.matrix = JSON.stringify(filter.matrix);

        let matrixHTML = '<div class="matrix">';
        filter.matrix.forEach(row => {
            row.forEach(cell => {
                matrixHTML += `<div class="cell">${cell}</div>`;
            });
        });
        matrixHTML += '</div>';

        card.innerHTML = `<strong>${filter.name}</strong>${matrixHTML}`;
        card.onclick = () => onSelect(card);
        container.appendChild(card);
    });
}

export function loadFilterCardsFromAPI({ url = "/api/random_filters", container, onSelect }) {
    fetch(url)
        .then(res => res.json())
        .then(filters => {
            renderFilterCards(filters, { container, onSelect });
        })
        .catch(err => {
            console.error("載入卷積卡失敗：", err);
            container.innerHTML = "<p>無法載入卷積卡</p>";
        });
}


export function registerApplyHandler({
    buttonId = "apply-btn",
    socket,
    selector,
    gameIdRef,
    currentColorRef,
    boardState,
    boardSize,
    onTurnChanged
}) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    btn.onclick = () => {
        const selected = selector.getSelectedFilter();
        if (!selected) return;
        const FilterUsed = selector.getFilterUser();
        if(FilterUsed[currentColorRef.value]) return;
        FilterUsed[currentColorRef.value] = true;
        /*const msgBox = document.getElementById("error-msg");
            msgBox.textContent = `${ currentColorRef.value ==="black"? "黑棋":"白棋"} 已使用過卷積卡！`;
        */

        // 發出同步事件
        socket.emit("filter_used", {
            game_id: gameIdRef.value,
            player: currentColorRef.value,
            filter_id: selected.id
        });

        // 本地翻牌
        selector.markUsed();

        // 卷積運算 + 同步記錄
        convolutionByRowUpdate(
            boardState,
            boardSize,
            (x, y, color) => {
                socket.emit("conv_place_stone", { game_id: gameIdRef.value, x, y, color });
            },
            currentColorRef,
            (color) => {
                socket.emit("apply_convolution", {
                    game_id: gameIdRef.value,
                    filter: selected.id,
                    color: color
                });
            },
            gameIdRef.value,
            selected.matrix,
            socket
        );
        onTurnChanged(currentColorRef.value);

    };
}

