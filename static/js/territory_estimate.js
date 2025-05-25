function territoryEstimate(boardState, boardSize) {
  const influenceMap = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));

  // initialize influence map
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      if (boardState[y][x] === "black") {
        influenceMap[y][x] = 128;
      } else if (boardState[y][x] === "white") {
        influenceMap[y][x] = -128;
      }
    }
  }

  // 5 dilations
  for (let count = 0; count < 5; count++)
    influenceMap = dilation(influenceMap, boardSize);

  // 21 erosions
  for (let count = 0; count < 21; count++)
    influenceMap = erosion(influenceMap, boardSize);

  // calculate territories
  const territory = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
  let nBlack = 0, nWhite = 0, nNone = 0;
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const current = influenceMap[y][x];
      territory[y][x] = current > 0 ? "black" : current < 0 ? "white" : null;
      switch (territory[y][x]) {
        case "black": nBlack++; break;
        case "white": nWhite++; break;
        default: nNone++; break;
      }
    }
  }

  return { territory, nBlack, nWhite, nNone };
}

function dilation(oldMap, boardSize) {
  const newMap = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      // none
      if (oldMap[y][x] === 0) continue;

      newMap[y][x] += oldMap[y][x];
      for (const [dy, dx] of directions) {
        const nx = x + dx;
        const ny = y + dy;

        // out of index
        if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize)
          continue;

        // do dilation
        newMap[ny][nx] += oldMap[y][x] > 0 ? 1 : -1;
      }
    }
  }

  return newMap;
}

function erosion(oldMap, boardSize) {
  const newMap = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
  for (let y = 0; y < boardSize; y++)
    for (let x = 0; x < boardSize; x++)
      newMap[y][x] = oldMap[y][x];

  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      if (oldMap[y][x] === 0) {
        for (const [dy, dx] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          // out of index
          if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize)
            continue;

          // do erosion
          if (newMap[ny][nx] !== 0)
            newMap[ny][nx] += newMap[ny][nx] > 0 ? -1 : 1;
        }
      }
    }
  }

  return newMap;
}

export { territoryEstimate };