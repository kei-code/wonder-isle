import { playTone } from "../core/audio.js";
import { readBest, writeBest } from "../core/storage.js";

const colors = {
  bg: "#111417",
  grid: "rgba(255,255,255,0.055)",
  cyan: "#37d7ff",
  lime: "#b7f35b",
  coral: "#ff6f5e",
  gold: "#ffd166",
};

export function mountTargetRush(root) {
  root.innerHTML = `
    <section class="stage-wrap">
      <div class="hud" aria-live="polite">
        <div class="meter"><span>TIME</span><strong data-ui="time">10.0</strong></div>
        <div class="meter"><span>SCORE</span><strong data-ui="score">0</strong></div>
        <div class="meter"><span>COMBO</span><strong data-ui="combo">0</strong></div>
        <div class="meter"><span>BEST</span><strong data-ui="best">0</strong></div>
      </div>
      <div class="canvas-frame">
        <canvas data-ui="canvas"></canvas>
        <div class="overlay is-visible" data-ui="overlay">
          <p class="result-kicker" data-ui="kicker">READY</p>
          <p class="result-title" data-ui="title">火口アリーナへ出発</p>
          <p class="result-score" data-ui="result">0</p>
          <button class="primary-button" data-ui="start" type="button">START</button>
        </div>
      </div>
      <footer class="bottombar">
        <div class="stat"><span>HIT</span><strong data-ui="hit">0</strong></div>
        <div class="stat"><span>MISS</span><strong data-ui="miss">0</strong></div>
        <div class="stat"><span>ACCURACY</span><strong data-ui="accuracy">0%</strong></div>
        <div class="stat"><span>MAX COMBO</span><strong data-ui="maxCombo">0</strong></div>
      </footer>
    </section>
  `;

  const ui = Object.fromEntries([...root.querySelectorAll("[data-ui]")].map((el) => [el.dataset.ui, el]));
  const canvas = ui.canvas;
  const ctx = canvas.getContext("2d");
  let frameId = 0;

  const game = {
    duration: 10000,
    state: "ready",
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    startTime: 0,
    lastTime: performance.now(),
    nextSpawn: 0,
    targets: [],
    particles: [],
    ripples: [],
    best: readBest("targetRushBest"),
  };

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

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

  function spawnTarget(now) {
    const rect = view();
    const touchScale = rect.width < 620 ? 1.18 : 1;
    const comboPressure = clamp(game.combo, 0, 18);
    const radius = (rand(30, 48) - comboPressure * 0.55) * touchScale;
    const x = rand(radius + 28, rect.width - radius - 28);
    const y = rand(radius + 28, rect.height - radius - 28);
    const bonus = Math.random() < 0.14;
    const life = bonus ? rand(620, 820) : rand(780, 1120) - comboPressure * 10;

    game.targets.push({
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

  function startGame() {
    Object.assign(game, {
      state: "playing",
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      startTime: performance.now(),
      lastTime: performance.now(),
      nextSpawn: 0,
      targets: [],
      particles: [],
      ripples: [],
    });
    fitCanvas();
    ui.overlay.classList.remove("is-visible");
    updateHud();
    playTone(420, 0.08, "triangle", 0.025);
  }

  function endGame() {
    game.state = "ended";
    game.targets = [];
    if (game.score > game.best) {
      game.best = game.score;
      writeBest("targetRushBest", game.best);
      ui.kicker.textContent = "NEW BEST";
      playTone(880, 0.18, "triangle", 0.055);
    } else {
      ui.kicker.textContent = "RESULT";
    }
    ui.title.textContent = `${game.hits} HIT / ${accuracy()}%`;
    ui.result.textContent = game.score.toLocaleString();
    ui.start.textContent = "RETRY";
    ui.overlay.classList.add("is-visible");
    updateHud();
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
      if (Math.hypot(target.x - x, target.y - y) <= target.radius) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex === -1) {
      game.misses += 1;
      game.combo = 0;
      addBurst(x, y, colors.coral, 7);
      playTone(150, 0.1, "sawtooth", 0.02);
      return;
    }

    const [target] = game.targets.splice(hitIndex, 1);
    const ageRatio = clamp((performance.now() - target.born) / target.life, 0, 1);
    const gained = (target.bonus ? 260 : 100) + Math.round((1 - ageRatio) * 80) + game.combo * 14;
    game.score += gained;
    game.combo += 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.hits += 1;
    addBurst(target.x, target.y, target.bonus ? colors.gold : colors.lime, target.bonus ? 22 : 14);
    playTone(target.bonus ? 720 : 520 + game.combo * 10, 0.08, "triangle", target.bonus ? 0.055 : 0.035);
    updateHud();
  }

  function update(now) {
    const dt = Math.min(32, now - game.lastTime);
    game.lastTime = now;

    if (game.state === "playing") {
      if (now - game.startTime >= game.duration) {
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
          target.x = clamp(target.x + (target.vx * dt) / 1000, target.radius + 10, rect.width - target.radius - 10);
          target.y = clamp(target.y + (target.vy * dt) / 1000, target.radius + 10, rect.height - target.radius - 10);
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
    ctx.fillStyle = `rgba(55, 215, 255, ${0.04 + Math.sin(now / 420) * 0.02})`;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTarget(target, now) {
    const ratio = clamp((now - target.born) / target.life, 0, 1);
    const radius = target.radius * (1 - ratio * 0.32);
    const color = target.bonus ? colors.gold : colors.cyan;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(now / 650 + target.wobble);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e8fbff";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = target.bonus ? colors.gold : colors.lime;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(5, radius * 0.16), 0, Math.PI * 2);
    ctx.fill();
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
    for (let i = 0; i < 8; i += 1) {
      const angle = now / 900 + (i / 8) * Math.PI * 2;
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

  function loop(now) {
    const rect = view();
    if (rect.width > 0 && rect.height > 0) {
      update(now);
      drawBackground(rect.width, rect.height, now);
      if (game.state !== "playing") drawIdle(rect.width, rect.height, now);
      game.targets.forEach((target) => drawTarget(target, now));
      drawParticles();
    }
    frameId = requestAnimationFrame(loop);
  }

  ui.start.addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", handlePointer);
  window.addEventListener("resize", fitCanvas);
  fitCanvas();
  updateHud();
  frameId = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", fitCanvas);
    canvas.removeEventListener("pointerdown", handlePointer);
  };
}
