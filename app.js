const mapView = document.getElementById("mapView");
const gameView = document.getElementById("gameView");
const spotButtons = [...document.querySelectorAll("[data-spot]")];
const quickPlayButton = document.getElementById("quickPlayButton");
const randomButton = document.getElementById("randomButton");
const newGameButton = document.getElementById("newGameButton");
const discoverButton = document.getElementById("discoverButton");
const launchButton = document.getElementById("launchButton");
const backButton = document.getElementById("backButton");
const spotPanel = document.querySelector(".spot-panel");

const spotUi = {
  type: document.getElementById("spotType"),
  title: document.getElementById("spotTitle"),
  description: document.getElementById("spotDescription"),
};

const spots = {
  "target-rush": {
    type: "REFLEX",
    title: "ターゲットラッシュ",
    description: "火口アリーナに現れる光る的を、10秒で撃ち抜こう。",
    playable: true,
  },
  "forest-lab": {
    type: "PUZZLE",
    title: "森の研究所",
    description: "記憶や観察でひらめくゲームを準備中。",
    playable: false,
  },
  "wind-tower": {
    type: "TIMING",
    title: "風車タワー",
    description: "風のリズムに合わせるゲームを準備中。",
    playable: false,
  },
  "lagoon-dock": {
    type: "RELAX",
    title: "入り江の桟橋",
    description: "集めたり育てたりする、ゆったり遊べる場所。",
    playable: false,
  },
  "crystal-gate": {
    type: "CHALLENGE",
    title: "結晶ゲート",
    description: "少し手ごわいチャレンジゲームを準備中。",
    playable: false,
  },
};

let selectedSpot = "target-rush";

function chooseSpot(id) {
  const spot = spots[id] || spots["target-rush"];
  selectedSpot = id;

  spotUi.type.textContent = spot.type;
  spotUi.title.textContent = spot.title;
  spotUi.description.textContent = spot.description;
  launchButton.textContent = spot.playable ? "出発" : "発見中";
  launchButton.classList.toggle("is-locked", !spot.playable);

  spotButtons.forEach((button) => {
    const active = button.dataset.spot === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  spotPanel.classList.remove("pop");
  void spotPanel.offsetWidth;
  spotPanel.classList.add("pop");
}

function openGame() {
  if (!spots[selectedSpot]?.playable) {
    const button = document.querySelector(`[data-spot="${selectedSpot}"]`);
    button?.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-8px) scale(1.08)" },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 360, easing: "ease-out" },
    );
    return;
  }

  resetGameReady();
  mapView.classList.add("is-hidden");
  gameView.classList.remove("is-hidden");
  requestAnimationFrame(() => {
    fitCanvas();
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

function closeGame() {
  resetGameReady();
  gameView.classList.add("is-hidden");
  mapView.classList.remove("is-hidden");
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

spotButtons.forEach((button) => {
  button.addEventListener("click", () => chooseSpot(button.dataset.spot));
});

quickPlayButton.addEventListener("click", () => {
  chooseSpot("target-rush");
  openGame();
});

randomButton.addEventListener("click", () => {
  chooseSpot("target-rush");
  openGame();
});

newGameButton.addEventListener("click", () => {
  chooseSpot("target-rush");
});

discoverButton.addEventListener("click", () => {
  const ids = Object.keys(spots);
  const index = ids.indexOf(selectedSpot);
  chooseSpot(ids[(index + 1) % ids.length]);
});

launchButton.addEventListener("click", openGame);
backButton.addEventListener("click", closeGame);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  time: document.getElementById("timeText"),
  score: document.getElementById("scoreText"),
  combo: document.getElementById("comboText"),
  best: document.getElementById("bestText"),
  hit: document.getElementById("hitText"),
  miss: document.getElementById("missText"),
  accuracy: document.getElementById("accuracyText"),
  maxCombo: document.getElementById("maxComboText"),
  overlay: document.getElementById("startOverlay"),
  overlayKicker: document.getElementById("overlayKicker"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayScore: document.getElementById("overlayScore"),
  start: document.getElementById("startButton"),
  sound: document.getElementById("soundButton"),
  soundIcon: document.getElementById("soundIcon"),
};

const game = {
  duration: 10000,
  state: "ready",
  score: 0,
  combo: 0,
  maxCombo: 0,
  hits: 0,
  misses: 0,
  startTime: 0,
  lastTime: 0,
  nextSpawn: 0,
  targets: [],
  particles: [],
  ripples: [],
  best: Number(localStorage.getItem("targetRushBest") || 0),
  sound: true,
};

const colors = {
  bg: "#111417",
  grid: "rgba(255,255,255,0.055)",
  cyan: "#37d7ff",
  lime: "#b7f35b",
  coral: "#ff6f5e",
  gold: "#ffd166",
};

let audioContext = null;

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function view() {
  return canvas.getBoundingClientRect();
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `target-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function playTone(freq, duration, type = "sine", volume = 0.035) {
  if (!game.sound) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  audioContext ||= new AudioEngine();

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function spawnTarget(now) {
  const rect = view();
  const touchScale = rect.width < 620 ? 1.18 : 1;
  const comboPressure = clamp(game.combo, 0, 18);
  const radius = (rand(30, 48) - comboPressure * 0.55) * touchScale;
  const edgePadding = rect.width < 620 ? 28 : 18;
  const x = rand(radius + edgePadding, rect.width - radius - edgePadding);
  const y = rand(radius + edgePadding, rect.height - radius - edgePadding);
  const bonus = Math.random() < 0.14;
  const life = bonus ? rand(620, 820) : rand(780, 1120) - comboPressure * 10;

  game.targets.push({
    id: makeId(),
    x,
    y,
    radius,
    born: now,
    life,
    bonus,
    wobble: rand(0, Math.PI * 2),
    vx: rand(-22, 22),
    vy: rand(-18, 18),
  });
}

function addBurst(x, y, color, amount = 14) {
  for (let i = 0; i < amount; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(90, 240);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(3, 7),
      life: rand(260, 520),
      age: 0,
      color,
    });
  }
  game.ripples.push({ x, y, age: 0, life: 380, color });
}

function scoreTarget(target, ageRatio) {
  const speedBonus = Math.round((1 - ageRatio) * 80);
  const comboBonus = game.combo * 14;
  const base = target.bonus ? 260 : 100;
  const gained = base + speedBonus + comboBonus;
  game.score += gained;
  game.combo += 1;
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.hits += 1;
  addBurst(target.x, target.y, target.bonus ? colors.gold : colors.lime, target.bonus ? 22 : 14);
  playTone(target.bonus ? 720 : 520 + game.combo * 10, 0.08, "triangle", target.bonus ? 0.055 : 0.035);
}

function registerMiss(x, y) {
  if (game.state !== "playing") return;
  game.misses += 1;
  game.combo = 0;
  addBurst(x, y, colors.coral, 7);
  playTone(150, 0.1, "sawtooth", 0.02);
}

function handlePointer(event) {
  if (game.state !== "playing") return;
  event.preventDefault();

  const rect = view();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  let hitIndex = -1;
  for (let i = game.targets.length - 1; i >= 0; i -= 1) {
    const target = game.targets[i];
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance <= target.radius) {
      hitIndex = i;
      break;
    }
  }

  if (hitIndex === -1) {
    registerMiss(x, y);
    return;
  }

  const [target] = game.targets.splice(hitIndex, 1);
  const ageRatio = clamp((performance.now() - target.born) / target.life, 0, 1);
  scoreTarget(target, ageRatio);
  updateHud();
}

function startGame() {
  game.state = "playing";
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.hits = 0;
  game.misses = 0;
  game.targets = [];
  game.particles = [];
  game.ripples = [];
  game.startTime = performance.now();
  game.lastTime = game.startTime;
  game.nextSpawn = 0;

  fitCanvas();
  ui.overlay.classList.remove("is-visible");
  updateHud();
  playTone(420, 0.08, "triangle", 0.025);
}

function resetGameReady() {
  game.state = "ready";
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.hits = 0;
  game.misses = 0;
  game.targets = [];
  game.particles = [];
  game.ripples = [];
  ui.overlayKicker.textContent = "READY";
  ui.overlayTitle.textContent = "火口アリーナへ出発";
  ui.overlayScore.textContent = "0";
  ui.start.textContent = "START";
  ui.overlay.classList.add("is-visible");
  updateHud();
}

function endGame() {
  game.state = "ended";
  game.targets = [];
  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem("targetRushBest", String(game.best));
    ui.overlayKicker.textContent = "NEW BEST";
    playTone(880, 0.18, "triangle", 0.055);
  } else {
    ui.overlayKicker.textContent = "RESULT";
  }

  ui.overlayTitle.textContent = `${game.hits} HIT / ${accuracy()}%`;
  ui.overlayScore.textContent = game.score.toLocaleString();
  ui.start.textContent = "RETRY";
  ui.overlay.classList.add("is-visible");
  updateHud();
}

function accuracy() {
  const shots = game.hits + game.misses;
  return shots === 0 ? 0 : Math.round((game.hits / shots) * 100);
}

function updateHud() {
  const elapsed = game.state === "playing" ? performance.now() - game.startTime : 0;
  const left = game.state === "playing" ? clamp((game.duration - elapsed) / 1000, 0, 10) : 10;
  ui.time.textContent = left.toFixed(1);
  ui.score.textContent = game.score.toLocaleString();
  ui.combo.textContent = String(game.combo);
  ui.best.textContent = game.best.toLocaleString();
  ui.hit.textContent = String(game.hits);
  ui.miss.textContent = String(game.misses);
  ui.accuracy.textContent = `${accuracy()}%`;
  ui.maxCombo.textContent = String(game.maxCombo);
}

function update(now) {
  const dt = Math.min(32, now - game.lastTime);
  game.lastTime = now;

  if (game.state === "playing") {
    const elapsed = now - game.startTime;
    if (elapsed >= game.duration) {
      endGame();
    } else {
      const spawnGap = clamp(650 - game.combo * 16, 260, 650);
      if (now >= game.nextSpawn) {
        spawnTarget(now);
        if (game.combo >= 8 && Math.random() < 0.28) spawnTarget(now);
        game.nextSpawn = now + spawnGap;
      }

      game.targets = game.targets.filter((target) => {
        const rect = view();
        target.x += (target.vx * dt) / 1000;
        target.y += (target.vy * dt) / 1000;
        target.x = clamp(target.x, target.radius + 10, rect.width - target.radius - 10);
        target.y = clamp(target.y, target.radius + 10, rect.height - target.radius - 10);

        if (now - target.born > target.life) {
          game.combo = 0;
          game.misses += 1;
          addBurst(target.x, target.y, colors.coral, 5);
          return false;
        }
        return true;
      });
    }
  }

  game.particles = game.particles.filter((particle) => {
    particle.age += dt;
    particle.x += (particle.vx * dt) / 1000;
    particle.y += (particle.vy * dt) / 1000;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    return particle.age < particle.life;
  });

  game.ripples = game.ripples.filter((ripple) => {
    ripple.age += dt;
    return ripple.age < ripple.life;
  });

  updateHud();
}

function drawBackground(width, height, now) {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  const step = 44;
  const offset = (now / 40) % step;
  for (let x = -step + offset; x < width + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height * 0.25, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const pulse = 0.5 + Math.sin(now / 420) * 0.5;
  ctx.fillStyle = `rgba(55, 215, 255, ${0.03 + pulse * 0.025})`;
  ctx.fillRect(0, 0, width, height);
}

function drawTarget(target, now) {
  const age = now - target.born;
  const ratio = clamp(age / target.life, 0, 1);
  const radius = target.radius * (1 - ratio * 0.32);
  const wobble = Math.sin(now / 120 + target.wobble) * 2;
  const color = target.bonus ? colors.gold : colors.cyan;

  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.rotate(now / 650 + target.wobble);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 14 + wobble, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = target.bonus ? "#fff3bf" : "#e8fbff";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = target.bonus ? colors.gold : colors.lime;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(5, radius * 0.16), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(244,246,248,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius - 8, 0);
  ctx.lineTo(-radius * 0.42, 0);
  ctx.moveTo(radius * 0.42, 0);
  ctx.lineTo(radius + 8, 0);
  ctx.moveTo(0, -radius - 8);
  ctx.lineTo(0, -radius * 0.42);
  ctx.moveTo(0, radius * 0.42);
  ctx.lineTo(0, radius + 8);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  game.ripples.forEach((ripple) => {
    const ratio = ripple.age / ripple.life;
    ctx.globalAlpha = 1 - ratio;
    ctx.strokeStyle = ripple.color;
    ctx.lineWidth = 4 * (1 - ratio);
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, 14 + ratio * 62, 0, Math.PI * 2);
    ctx.stroke();
  });

  game.particles.forEach((particle) => {
    const ratio = particle.age / particle.life;
    ctx.globalAlpha = 1 - ratio;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * (1 - ratio * 0.35), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawIdle(width, height, now) {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  const spin = now / 900;
  for (let i = 0; i < 8; i += 1) {
    const angle = spin + (i / 8) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.2 + Math.sin(now / 500 + i) * 10;
    ctx.fillStyle = i % 2 ? colors.cyan : colors.lime;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 10 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function render(now) {
  const rect = view();
  if (rect.width === 0 || rect.height === 0) {
    requestAnimationFrame(loop);
    return;
  }

  drawBackground(rect.width, rect.height, now);

  if (game.state !== "playing") {
    drawIdle(rect.width, rect.height, now);
  }

  game.targets.forEach((target) => drawTarget(target, now));
  drawParticles();

  requestAnimationFrame(loop);
}

function loop(now) {
  update(now);
  render(now);
}

ui.start.addEventListener("click", startGame);
ui.sound.addEventListener("click", () => {
  game.sound = !game.sound;
  ui.soundIcon.textContent = game.sound ? "♪" : "×";
  if (game.sound) playTone(500, 0.06, "triangle", 0.025);
});
canvas.addEventListener("pointerdown", handlePointer);
window.addEventListener("resize", fitCanvas);

chooseSpot("target-rush");
resetGameReady();
requestAnimationFrame(loop);
