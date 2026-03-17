const SIZE = 6;
const MAX_MOVES = 10;
const REQUIRED_FILTERS = 1;

const state = {
  grid: [],
  selectedType: "straight",
  selectedRot: 0,
  moves: 0,
  score: 0,
  leaks: 0,
  gameOver: false,
  paused: false,
  flowVisited: new Set(),
  placedHistory: []
};

const boardEl = document.getElementById("board");
const trayEl = document.getElementById("tray");
const movesValue = document.getElementById("movesValue");
const filterValue = document.getElementById("filterValue");
const leakValue = document.getElementById("leakValue");
const scoreValue = document.getElementById("scoreValue");
const statusText = document.getElementById("statusText");

const titleScreen = document.getElementById("titleScreen");
const gameScreen = document.getElementById("gameScreen");
const pauseOverlay = document.getElementById("pauseOverlay");
const messageOverlay = document.getElementById("messageOverlay");
const howOverlay = document.getElementById("howOverlay");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");

const trayItems = [
  { type: "straight", label: "Pipe" },
  { type: "corner", label: "Corner" },
  { type: "filter", label: "Filter" },
  { type: "repair", label: "Repair" }
];

function key(r, c) {
  return `${r},${c}`;
}

function makeTile(type, rot = 0, fixed = false) {
  return { type, rot, fixed, broken: false };
}

function initGame() {
  state.grid = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null)
  );
  state.selectedType = "straight";
  state.selectedRot = 0;
  state.moves = 0;
  state.score = 0;
  state.leaks = 0;
  state.gameOver = false;
  state.paused = false;
  state.flowVisited = new Set();
  state.placedHistory = [];

  state.grid[0][0] = makeTile("source", 0, true);
  state.grid[5][5] = makeTile("village", 0, true);
  state.grid[1][2] = makeTile("rock", 0, true);
  state.grid[2][2] = makeTile("rock", 0, true);
  state.grid[3][4] = makeTile("rock", 0, true);

  buildTray();
  renderBoard();
  updateHUD();
  setStatus("Select a piece and start building a path to the village.");
}

function startGame() {
  initGame();
  titleScreen.classList.remove("active");
  gameScreen.classList.add("active");
}

function showTitle() {
  messageOverlay.classList.remove("active");
  pauseOverlay.classList.remove("active");
  howOverlay.classList.remove("active");
  gameScreen.classList.remove("active");
  titleScreen.classList.add("active");
}

function buildTray() {
  trayEl.innerHTML = "";

  trayItems.forEach((item) => {
    const btn = document.createElement("button");
    btn.className =
      "tray-item" + (state.selectedType === item.type ? " active" : "");

    btn.addEventListener("click", () => {
      state.selectedType = item.type;
      if (item.type === "repair") state.selectedRot = 0;
      buildTray();
      renderBoard();
      setStatus(
        item.type === "repair"
          ? "Click a broken tile to repair it."
          : `Selected ${item.label}. Click a grid cell to place it.`
      );
    });

    const mini = document.createElement("div");
    mini.className = "mini-tile";
    mini.appendChild(createTileVisual(item.type, 0, false, false));

    const label = document.createElement("div");
    label.className = "tray-title";
    label.textContent = item.label;

    btn.appendChild(mini.firstChild);
    btn.appendChild(label);
    trayEl.appendChild(btn);
  });
}

function renderBoard() {
  boardEl.innerHTML = "";
  const { visited } = computeFlow();
  state.flowVisited = visited;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      const tile = state.grid[r][c];
      const playable =
        !state.gameOver &&
        !state.paused &&
        (!tile || (!tile.fixed && tile.type !== "rock"));

      cell.className = "cell" + (playable ? " playable" : "");
      if (!tile && state.selectedType !== "repair") {
        cell.classList.add("selected-slot");
      }

      cell.addEventListener("click", () => handleCellClick(r, c));

      if (tile) {
        const flowing = visited.has(key(r, c));
        cell.appendChild(createTileVisual(tile.type, tile.rot, tile.broken, flowing));
      }

      boardEl.appendChild(cell);
    }
  }
}

function createTileVisual(type, rot = 0, broken = false, flowing = false) {
  const wrapper = document.createElement("div");
  let className = "tile ";

  if (type === "straight") className += `pipe-straight rot-${rot}`;
  else if (type === "corner") className += `pipe-corner rot-${rot}`;
  else if (type === "filter") className += `filter pipe-straight rot-${rot}`;
  else className += type;

  if (broken) className += " broken";
  if (flowing) className += " flowing";
  wrapper.className = className;

  if (type === "straight" || type === "filter") {
    const lineA = document.createElement("div");
    lineA.className = "pipe-line line-a";
    wrapper.appendChild(lineA);
  } else if (type === "corner") {
    const lineA = document.createElement("div");
    const lineB = document.createElement("div");
    lineA.className = "pipe-line line-a";
    lineB.className = "pipe-line line-b";
    wrapper.appendChild(lineA);
    wrapper.appendChild(lineB);
  }

  if (
    type === "source" ||
    type === "village" ||
    type === "rock" ||
    type === "filter"
  ) {
    const icon = document.createElement("div");
    icon.className = "label-icon";
    icon.textContent =
      type === "source" ? "S" : type === "village" ? "V" : type === "rock" ? "X" : "F";
    wrapper.appendChild(icon);
  }

  return wrapper;
}

function handleCellClick(r, c) {
  if (state.gameOver || state.paused) return;
  const tile = state.grid[r][c];

  if (state.selectedType === "repair") {
    if (tile && tile.broken) {
      tile.broken = false;
      state.leaks = Math.max(0, state.leaks - 1);
      state.score += 5;
      setStatus("Leak repaired. Water can flow again.");
      afterAction();
    } else {
      setStatus("Repair can only be used on a broken pipe.");
    }
    return;
  }

  if (tile) {
    if (!tile.fixed && tile.type !== "rock") {
      tile.rot = (tile.rot + 1) % 4;
      setStatus("Piece rotated in place.");
      afterAction();
    }
    return;
  }

  state.grid[r][c] = makeTile(state.selectedType, state.selectedRot, false);
  state.moves += 1;
  state.score += 10;
  state.placedHistory.push({ r, c });
  setStatus(`${capitalize(state.selectedType)} placed on the grid.`);

  if (state.moves === 4 || state.moves === 7) {
    createLeak();
  }

  afterAction();
}

function afterAction() {
  updateHUD();
  renderBoard();
  checkWinLoss();
}

function createLeak() {
  const candidates = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = state.grid[r][c];
      if (
        tile &&
        !tile.fixed &&
        tile.type !== "rock" &&
        tile.type !== "repair" &&
        !tile.broken
      ) {
        candidates.push(tile);
      }
    }
  }

  if (!candidates.length) return;

  const tile = candidates[candidates.length - 1];
  tile.broken = true;
  state.leaks += 1;
  setStatus("A leak appeared. Repair the broken tile to restore the path.");
}

function updateHUD() {
  const placedFilters = countPlacedFilters();
  movesValue.textContent = `${state.moves} / ${MAX_MOVES}`;
  filterValue.textContent = `${placedFilters} / ${REQUIRED_FILTERS}`;
  leakValue.textContent = String(state.leaks);
  scoreValue.textContent = String(state.score);
}

function countPlacedFilters() {
  let count = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (state.grid[r][c]?.type === "filter") count += 1;
    }
  }

  return count;
}

function getConnections(tile) {
  if (!tile || tile.broken) return [];
  if (tile.type === "source") return ["right", "down"];
  if (tile.type === "village") return ["left", "up"];

  if (tile.type === "straight" || tile.type === "filter") {
    return tile.rot % 2 === 0 ? ["up", "down"] : ["left", "right"];
  }

  if (tile.type === "corner") {
    const corners = [
      ["up", "right"],
      ["right", "down"],
      ["down", "left"],
      ["left", "up"]
    ];
    return corners[tile.rot % 4];
  }

  return [];
}

const deltas = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1]
};

const opposite = {
  up: "down",
  right: "left",
  down: "up",
  left: "right"
};

function computeFlow() {
  const visited = new Set();
  const queue = [[0, 0]];
  let villageReached = false;
  let connectedFilters = 0;

  while (queue.length) {
    const [r, c] = queue.shift();
    const k = key(r, c);
    if (visited.has(k)) continue;

    const tile = state.grid[r][c];
    if (!tile || tile.broken) continue;

    visited.add(k);
    if (tile.type === "village") villageReached = true;
    if (tile.type === "filter") connectedFilters += 1;

    const connections = getConnections(tile);
    for (const dir of connections) {
      const [dr, dc] = deltas[dir];
      const nr = r + dr;
      const nc = c + dc;

      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;

      const neighbor = state.grid[nr][nc];
      if (!neighbor || neighbor.broken || neighbor.type === "rock") continue;

      const neighborConnections = getConnections(neighbor);
      if (neighborConnections.includes(opposite[dir])) {
        queue.push([nr, nc]);
      }
    }
  }

  return { visited, villageReached, connectedFilters };
}

function checkWinLoss() {
  const result = computeFlow();
  const won =
    result.villageReached &&
    result.connectedFilters >= REQUIRED_FILTERS &&
    state.leaks === 0;

  if (won) {
    state.gameOver = true;
    state.score += 50;
    updateHUD();
    messageTitle.textContent = "Water Delivered!";
    messageBody.textContent = `Great job. You connected the source to the village in ${state.moves} moves and built a clean water path with a filter.`;
    messageOverlay.classList.add("active");
    return;
  }

  if (state.moves >= MAX_MOVES) {
    state.gameOver = true;
    messageTitle.textContent = "Out of Moves";
    messageBody.textContent =
      "The system is not complete yet. Try again and build a cleaner path with fewer wasted moves.";
    messageOverlay.classList.add("active");
  }
}

function setStatus(text) {
  statusText.textContent = text;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("howBtn").addEventListener("click", () => {
  howOverlay.classList.add("active");
});
document.getElementById("closeHowBtn").addEventListener("click", () => {
  howOverlay.classList.remove("active");
});
document.getElementById("pauseBtn").addEventListener("click", () => {
  if (state.gameOver) return;
  state.paused = true;
  pauseOverlay.classList.add("active");
});
document.getElementById("resumeBtn").addEventListener("click", () => {
  state.paused = false;
  pauseOverlay.classList.remove("active");
});
document.getElementById("restartBtn").addEventListener("click", () => {
  pauseOverlay.classList.remove("active");
  initGame();
});
document.getElementById("playAgainBtn").addEventListener("click", () => {
  messageOverlay.classList.remove("active");
  initGame();
});
document.getElementById("backMenuBtn").addEventListener("click", showTitle);
document.getElementById("rotateBtn").addEventListener("click", () => {
  if (state.selectedType === "repair") return;
  state.selectedRot = (state.selectedRot + 1) % 4;
  setStatus("Selected piece rotated before placement.");
  buildTray();
});

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r" && state.selectedType !== "repair") {
    state.selectedRot = (state.selectedRot + 1) % 4;
    setStatus("Selected piece rotated before placement.");
  }

  if (e.key === "Escape" && gameScreen.classList.contains("active") && !state.gameOver) {
    state.paused = !state.paused;
    pauseOverlay.classList.toggle("active", state.paused);
  }

  buildTray();
});
