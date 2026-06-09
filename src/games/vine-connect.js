import { playTone } from "../core/audio.js";
import { readBest, writeBest } from "../core/storage.js";

const dirs = {
  n: [-1, 0],
  e: [0, 1],
  s: [1, 0],
  w: [0, -1],
};

const opposite = { n: "s", e: "w", s: "n", w: "e" };
const order = ["n", "e", "s", "w"];

export function mountVineConnect(root) {
  root.innerHTML = `
    <section class="stage-wrap">
      <div class="hud" aria-live="polite">
        <div class="meter"><span>TIME</span><strong data-ui="time">30.0</strong></div>
        <div class="meter"><span>MOVES</span><strong data-ui="moves">0</strong></div>
        <div class="meter"><span>STAGE</span><strong data-ui="stage">1</strong></div>
        <div class="meter"><span>BEST</span><strong data-ui="best">0</strong></div>
      </div>
      <div class="puzzle-frame">
        <div class="vine-game">
          <div class="vine-layout">
            <div class="vine-endpoint vine-start-tile" aria-label="スタート">
              <span class="endpoint-label">START</span>
              <span class="path" aria-hidden="true"></span>
            </div>
            <div class="vine-board" data-ui="board"></div>
            <div class="vine-endpoint vine-goal-tile" aria-label="ゴール">
              <span class="endpoint-label">GOAL</span>
              <span class="path" aria-hidden="true"></span>
            </div>
          </div>
        </div>
        <div class="overlay is-visible" data-ui="overlay">
          <p class="result-kicker" data-ui="kicker">PUZZLE</p>
          <p class="result-title" data-ui="title">水源から花までツルをつなげよう</p>
          <p class="result-score" data-ui="result">30s</p>
          <button class="primary-button" data-ui="start" type="button">START</button>
        </div>
      </div>
      <footer class="bottombar">
        <div class="stat"><span>GOAL</span><strong data-ui="goal">未接続</strong></div>
        <div class="stat"><span>CHAIN</span><strong data-ui="chain">0</strong></div>
        <div class="stat"><span>SCORE</span><strong data-ui="score">0</strong></div>
        <div class="stat"><span>NEXT</span><strong data-ui="next">クリア後</strong></div>
      </footer>
    </section>
  `;

  const ui = Object.fromEntries([...root.querySelectorAll("[data-ui]")].map((el) => [el.dataset.ui, el]));
  const size = 5;
  const duration = 30000;
  let frameId = 0;
  let stage = 1;
  let board = [];
  let startTime = 0;
  let moves = 0;
  let score = 0;
  let state = "ready";
  let connectedSet = new Set();
  let best = readBest("vineConnectBest");
  let lastTimeLeft = duration / 1000;

  function rotateExit(dir, turns) {
    return order[(order.indexOf(dir) + turns) % 4];
  }

  function exitsFor(tile) {
    return tile.base.map((dir) => rotateExit(dir, tile.rot));
  }

  function key(row, col) {
    return `${row}-${col}`;
  }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function makePath() {
    const path = [[0, 0]];
    const steps = shuffle(["s", "s", "s", "s", "e", "e", "e", "e"]);
    let row = 0;
    let col = 0;

    steps.forEach((step) => {
      row += dirs[step][0];
      col += dirs[step][1];
      path.push([row, col]);
    });
    return path;
  }

  function directionBetween(a, b) {
    const dr = b[0] - a[0];
    const dc = b[1] - a[1];
    return Object.entries(dirs).find(([, delta]) => delta[0] === dr && delta[1] === dc)[0];
  }

  function shapeFromBase(base) {
    if (base.length === 3) return "tee";
    const sorted = [...base].sort().join("");
    if (sorted === "ns" || sorted === "ew") return "straight";
    return "corner";
  }

  function makeTile(row, col, exits) {
    const sorted = [...exits].sort().join("");
    let base = ["n", "s"];
    let rot = 0;

    if (sorted === "ew") {
      base = ["n", "s"];
      rot = 1;
    } else if (sorted === "ns") {
      base = ["n", "s"];
      rot = 0;
    } else if (sorted === "en") {
      base = ["n", "e"];
      rot = 0;
    } else if (sorted === "es") {
      base = ["n", "e"];
      rot = 1;
    } else if (sorted === "sw") {
      base = ["n", "e"];
      rot = 2;
    } else if (sorted === "nw") {
      base = ["n", "e"];
      rot = 3;
    } else {
      base = ["n", "e", "s"];
      rot = Math.floor(Math.random() * 4);
    }

    return { row, col, base, rot };
  }

  function makeFillerTile(row, col) {
    const templates = [
      ["n", "s"],
      ["e", "w"],
      ["n", "e"],
      ["e", "s"],
      ["s", "w"],
      ["n", "w"],
    ];
    const exits = templates[Math.floor(Math.random() * templates.length)];
    const tile = makeTile(row, col, exits);
    tile.rot = Math.floor(Math.random() * 4);
    return tile;
  }

  function generateBoard() {
    const path = makePath();
    const pathMap = new Map();
    path.forEach((cell, index) => {
      const exits = [];
      if (index === 0) exits.push("w");
      if (index > 0) exits.push(directionBetween(cell, path[index - 1]));
      if (index < path.length - 1) exits.push(directionBetween(cell, path[index + 1]));
      if (index === path.length - 1) exits.push("e");
      pathMap.set(key(cell[0], cell[1]), exits);
    });

    board = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => {
        const exits = pathMap.get(key(row, col));
        if (exits) {
          const tile = makeTile(row, col, exits);
          tile.rot = Math.floor(Math.random() * 4);
          return tile;
        }
        return makeFillerTile(row, col);
      }),
    );

    if (traceConnection({ silent: true })) generateBoard();
  }

  function renderBoard() {
    ui.board.style.setProperty("--size", String(size));
    ui.board.innerHTML = "";
    board.flat().forEach((tile) => {
      const button = document.createElement("button");
      button.className = "vine-tile";
      button.type = "button";
      button.dataset.row = String(tile.row);
      button.dataset.col = String(tile.col);
      button.dataset.shape = shapeFromBase(tile.base);
      button.style.setProperty("--rot", String(tile.rot));
      button.style.gridColumn = String(tile.col + 2);
      button.style.gridRow = String(tile.row + 1);
      button.setAttribute("aria-label", `ツル ${tile.row + 1}行 ${tile.col + 1}列`);
      if (connectedSet.has(key(tile.row, tile.col)) && state === "ended") button.classList.add("is-connected");
      button.innerHTML = '<span class="path"></span>';
      ui.board.append(button);
    });
  }

  function traceConnection(options = {}) {
    const silent = options.silent === true;
    const connected = new Set();
    const startTile = board[0][0];
    if (!exitsFor(startTile).includes("w")) {
      connectedSet = connected;
      if (!silent) {
        ui.goal.textContent = "未接続";
        ui.chain.textContent = "0";
      }
      return false;
    }

    const queue = [[0, 0]];

    while (queue.length) {
      const [row, col] = queue.shift();
      const id = key(row, col);
      if (connected.has(id)) continue;
      connected.add(id);
      const tile = board[row][col];
      exitsFor(tile).forEach((dir) => {
        const [dr, dc] = dirs[dir];
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= size || nextCol >= size) return;
        const next = board[nextRow][nextCol];
        if (exitsFor(next).includes(opposite[dir])) queue.push([nextRow, nextCol]);
      });
    }

    connectedSet = connected;
    const goalTile = board[size - 1][size - 1];
    const complete = connected.has(key(size - 1, size - 1)) && exitsFor(goalTile).includes("e");
    if (!silent) {
      ui.goal.textContent = complete ? "接続" : "未接続";
      ui.chain.textContent = String(connected.size);
    }
    return complete;
  }

  function currentTimeLeft() {
    if (state === "ready") return duration / 1000;
    if (state === "ended") return lastTimeLeft;
    return Math.max(0, (duration - (performance.now() - startTime)) / 1000);
  }

  function updateHud() {
    ui.time.textContent = currentTimeLeft().toFixed(1);
    ui.moves.textContent = String(moves);
    ui.stage.textContent = String(stage);
    ui.best.textContent = best.toLocaleString();
    ui.score.textContent = score.toLocaleString();
  }

  function startStage() {
    state = "playing";
    moves = 0;
    score = 0;
    startTime = performance.now();
    lastTimeLeft = duration / 1000;
    connectedSet = new Set();
    generateBoard();
    traceConnection();
    renderBoard();
    ui.overlay.classList.remove("is-visible");
    ui.next.textContent = "クリア後";
    updateHud();
    playTone(440, 0.08, "triangle", 0.03);
  }

  function completeStage() {
    lastTimeLeft = currentTimeLeft();
    state = "ended";
    const timeBonus = Math.round(lastTimeLeft * 90);
    const moveBonus = Math.max(0, 1200 - moves * 45);
    score = 1000 + timeBonus + moveBonus + stage * 150;
    if (score > best) {
      best = score;
      writeBest("vineConnectBest", best);
      ui.kicker.textContent = "NEW BEST";
    } else {
      ui.kicker.textContent = "CLEAR";
    }
    ui.title.textContent = `${moves}手で花まで水が届いた`;
    ui.result.textContent = score.toLocaleString();
    ui.start.textContent = "NEXT";
    ui.next.textContent = "次の島";
    ui.overlay.classList.add("is-visible");
    ui.board.classList.add("vine-complete");
    playTone(760, 0.14, "triangle", 0.055);
    setTimeout(() => ui.board.classList.remove("vine-complete"), 900);
    updateHud();
  }

  function timeUp() {
    lastTimeLeft = 0;
    state = "ended";
    ui.kicker.textContent = "TIME UP";
    ui.title.textContent = "もう一度つないでみよう";
    ui.result.textContent = "0";
    ui.start.textContent = "RETRY";
    ui.overlay.classList.add("is-visible");
    playTone(180, 0.16, "sawtooth", 0.02);
  }

  function handleBoardClick(event) {
    const button = event.target.closest(".vine-tile");
    if (!button || state !== "playing") return;
    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);
    const tile = board[row][col];
    tile.rot = (tile.rot + 1) % 4;
    moves += 1;
    playTone(360 + (connectedSet.size % 8) * 30, 0.05, "triangle", 0.018);
    const complete = traceConnection();
    renderBoard();
    updateHud();
    if (complete) completeStage();
  }

  function tick() {
    if (state === "playing" && currentTimeLeft() <= 0) timeUp();
    updateHud();
    frameId = requestAnimationFrame(tick);
  }

  ui.start.addEventListener("click", () => {
    if (state === "ended" && ui.start.textContent === "NEXT") stage += 1;
    startStage();
  });
  ui.board.addEventListener("click", handleBoardClick);
  generateBoard();
  traceConnection();
  renderBoard();
  updateHud();
  frameId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frameId);
    ui.board.removeEventListener("click", handleBoardClick);
  };
}
