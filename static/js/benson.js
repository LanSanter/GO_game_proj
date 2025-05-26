

//尋找關鍵區域
function findCriticalRegions(board, groups, color) {
    const size = board.length;
    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const enemy = (color === "black") ? "white" : "black";
    const allCoordsInGroups = new Set(groups.flatMap(g => g.stones.map(([y, x]) => `${y},${x}`)));

    const criticalRegions = [];

    function inBounds(y, x) {
        return y >= 0 && y < size && x >= 0 && x < size;
    }
    // 檢查區域中有無被敵人包圍的封閉氣
    function isRegionInteriorValid(region) {
        const visitedAir = new Set();

        for (const coord of region) {
            const [ry, rx] = coord.split(',').map(Number);
            if (board[ry][rx] !== null) continue;
            if (visitedAir.has(coord)) continue;

            // 找出連通空氣區塊
            const queue = [[ry, rx]];
            const airBlock = new Set();
            const neighborColors = new Set();

            visitedAir.add(coord);
            airBlock.add(coord);

            while (queue.length > 0) {
                const [cy, cx] = queue.pop();
                for (const [dy, dx] of directions) {
                    const ny = cy + dy;
                    const nx = cx + dx;
                    const nCoord = `${ny},${nx}`;
                    if (!inBounds(ny, nx)) continue;

                    const val = board[ny][nx];

                    if (val === null && !visitedAir.has(nCoord) && region.has(nCoord)) {
                        visitedAir.add(nCoord);
                        airBlock.add(nCoord);
                        queue.push([ny, nx]);
                    } else if (val !== null) {
                        neighborColors.add(val);
                    }
                }
            }

            // 如果該空氣區塊只與敵人相鄰 ➜ 危險氣 ➜ 整個 R 作廢
            if (neighborColors.size === 1 && neighborColors.has(enemy)) {
                return false;
            }
        }

        return true;
    }
    //執行迴圈檢查
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (visited[y][x] || board[y][x] !== null) continue;

            const queue = [[y, x]];
            const region = new Set();
            const neighborCoords = new Set();
            let touchesEdge = false;

            visited[y][x] = true;
            region.add(`${y},${x}`);

            while (queue.length > 0) {
                const [cy, cx] = queue.pop();

                for (const [dy, dx] of directions) {
                    const ny = cy + dy;
                    const nx = cx + dx;
                    const nCoord = `${ny},${nx}`;

                    if (!inBounds(ny, nx)) {
                        touchesEdge = false;  // 空地連到邊界，不能是完全包圍
                        continue;
                    }

                    const val = board[ny][nx];
                    if (val === null && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        region.add(nCoord);
                        queue.push([ny, nx]);
                    } else if (val === color) {
                        neighborCoords.add(nCoord);
                    } else if (val === enemy) {
                        // 敵人不會加入 neighborCoords，但我們接受在區域內
                        continue;
                    }
                }
            }

            // 條件一：不能接觸邊界
            if (touchesEdge) continue;

            // 條件二：所有鄰接的本色棋子都必須屬於當前 group 集合
            const allLegalNeighbors = [...neighborCoords].every(coord => allCoordsInGroups.has(coord));
            if (!allLegalNeighbors) continue;

            // 條件三：region 內每個空氣區塊必須不是危險氣
            if (!isRegionInteriorValid(region)) continue;

            // 合法關鍵區域
            criticalRegions.push(region);
        }
    }

    return criticalRegions;
}


function findGroups(board, color) {
    const size = board.length;
    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    const groups = [];

    const directions = [
        [0, 1], [1, 0], [0, -1], [-1, 0]
    ];

    function inBounds(y, x) {
        return y >= 0 && y < size && x >= 0 && x < size;
    }

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (board[y][x] === color && !visited[y][x]) {
                const queue = [[y, x]];
                const stones = [];
                const liberties = new Set();

                visited[y][x] = true;

                while (queue.length > 0) {
                    const [cy, cx] = queue.pop();
                    stones.push([cy, cx]);

                    for (const [dy, dx] of directions) {
                        const ny = cy + dy;
                        const nx = cx + dx;

                        if (!inBounds(ny, nx)) continue;

                        if (board[ny][nx] === null) {
                            liberties.add(`${ny},${nx}`);
                        } else if (board[ny][nx] === color && !visited[ny][nx]) {
                            visited[ny][nx] = true;
                            queue.push([ny, nx]);
                        }
                    }
                }

                groups.push({
                    color,
                    stones,
                    liberties
                });
            }
        }
    }

    return groups;
}
//傳入串集合以及關鍵區域集合，檢查那些串鄰接的關鍵區域少於兩個
//使用set儲存region，確保只計算不同的關鍵區域
function markDeadGroups(groups, criticalRegions) {
    const toRemove = [];

    // 每個 group 都做檢查
    for (const group of groups) {
        const contactRegions = new Set();

        for (const region of criticalRegions) {
            for (const [y, x] of group.stones) {
                for (const [dy, dx] of [[0,1],[1,0],[0,-1],[-1,0]]) {
                    const ny = y + dy;
                    const nx = x + dx;
                    const coord = `${ny},${nx}`;
                    if (region.has(coord)) {
                        contactRegions.add(region);
                        break; // 有接觸一個 region 就夠了
                    }
                }
            }
        }

        if (contactRegions.size < 2) {
            toRemove.push(group);
        }
    }

    return toRemove;
}


function runBenson(board, boardSize) {
    let state = Array.from({ length: boardSize }, () =>
        Array(boardSize).fill("Unchange")
    );
    let workingBoard = board.map(row => row.slice()); // 深拷貝

    let changed = true;
    console.log(state);

    while (changed) {
        changed = false;

        for (const color of ["black", "white"]) {
            const groups = findGroups(workingBoard, color);
            const criticalRegions = findCriticalRegions(workingBoard, groups, color);
            const deadGroups = markDeadGroups(groups, criticalRegions);

            if (deadGroups.length > 0) {
                changed = true;

                for (const group of deadGroups) {
                    for (const [y, x] of group.stones) {
                        workingBoard[y][x] = null; // 移除
                        state[y][x] = "Remove";    // 標記為要被提子
                    }
                }
            }
        }
    }

    return state;
}


export {runBenson};
// runBenson(boardstate, boardsize)