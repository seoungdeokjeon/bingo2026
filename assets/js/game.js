(function () {
  function getCompletedLines(board) {
    const checked = board.map(function (cell) { return Boolean(cell.checked); });
    const lines = [];

    for (let r = 0; r < 5; r += 1) {
      const row = [r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4];
      if (row.every(function (i) { return checked[i]; })) lines.push(row);
    }

    for (let c = 0; c < 5; c += 1) {
      const col = [c, c + 5, c + 10, c + 15, c + 20];
      if (col.every(function (i) { return checked[i]; })) lines.push(col);
    }

    const d1 = [0, 6, 12, 18, 24];
    const d2 = [4, 8, 12, 16, 20];
    if (d1.every(function (i) { return checked[i]; })) lines.push(d1);
    if (d2.every(function (i) { return checked[i]; })) lines.push(d2);

    return lines;
  }

  function countLines(board) {
    return getCompletedLines(board).length;
  }

  function countMarked(board) {
    return board.filter(function (cell) { return cell.checked; }).length;
  }

  function updateWinner(player) {
    const lines = countLines(player.board);
    if (lines >= 3 && !player.winnerAt) {
      player.winnerAt = new Date().toISOString();
    }
    return lines;
  }

  window.BingoGame = {
    getCompletedLines: getCompletedLines,
    countLines: countLines,
    countMarked: countMarked,
    updateWinner: updateWinner
  };
})();
