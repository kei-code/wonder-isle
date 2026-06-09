import { isSoundEnabled, toggleSound } from "./core/audio.js";
import { playableSpots, spots } from "./data/games.js";
import { mountTargetRush } from "./games/target-rush.js";
import { mountVineConnect } from "./games/vine-connect.js";

const app = document.getElementById("app");
const games = {
  "target-rush": mountTargetRush,
  "vine-connect": mountVineConnect,
};

let selectedSpot = spots[0].id;
let cleanupGame = null;

function spotById(id) {
  return spots.find((spot) => spot.id === id) || spots[0];
}

function renderApp() {
  app.innerHTML = `
    <section class="map-view" id="mapView" aria-label="ワンダーアイル">
      <div class="map-stage">
        <img class="map-art" src="assets/site/wonder-isle-bg.png" alt="" aria-hidden="true" />
        <div class="map-vignette" aria-hidden="true"></div>
        <div class="map-glints" aria-hidden="true">
          <span class="glint g1"></span>
          <span class="glint g2"></span>
          <span class="glint g3"></span>
          <span class="glint g4"></span>
        </div>
        <header class="site-header">
          <div class="brand-block">
            <p class="eyebrow">EXPLORE MINI GAMES</p>
            <h1>ワンダーアイル</h1>
          </div>
          <button class="round-button" id="randomButton" type="button" aria-label="ランダムにあそぶ" title="ランダムにあそぶ">?</button>
        </header>
        ${spots
          .map(
            (spot) => `
              <button class="map-spot ${spot.className}" type="button" data-spot="${spot.id}" aria-pressed="false">
                <span class="spot-ring"></span>
                <span class="spot-pin ${spot.pinClass}"></span>
                <span class="spot-label">${spot.label}</span>
              </button>
            `,
          )
          .join("")}
        <section class="spot-panel" aria-live="polite">
          <div class="spot-copy">
            <p class="eyebrow" id="spotType"></p>
            <h2 id="spotTitle"></h2>
            <p id="spotDescription"></p>
          </div>
          <button class="launch-button" id="launchButton" type="button"></button>
        </section>
        <nav class="map-actions" aria-label="ショートカット">
          <button class="action-button primary" id="quickPlayButton" type="button">すぐあそぶ</button>
          <button class="action-button" id="newGameButton" type="button">新着</button>
          <button class="action-button" id="discoverButton" type="button">発見</button>
        </nav>
      </div>
    </section>
    <section class="game-view is-hidden" id="gameView" aria-label="ゲーム画面">
      <header class="game-header">
        <button class="icon-button" id="backButton" type="button" aria-label="島へ戻る" title="島へ戻る">←</button>
        <div class="game-title-block">
          <p class="eyebrow" id="gameIsland"></p>
          <h2 id="gameTitle"></h2>
        </div>
        <button class="icon-button" id="soundButton" type="button" aria-label="サウンド切替" title="サウンド切替">
          <span id="soundIcon">${isSoundEnabled() ? "♪" : "×"}</span>
        </button>
      </header>
      <div id="gameMount"></div>
    </section>
  `;

  bindSiteEvents();
  chooseSpot(selectedSpot);
}

function bindSiteEvents() {
  document.querySelectorAll("[data-spot]").forEach((button) => {
    button.addEventListener("click", () => chooseSpot(button.dataset.spot));
  });

  document.getElementById("quickPlayButton").addEventListener("click", () => {
    chooseSpot(playableSpots[0].id);
    openGame();
  });

  document.getElementById("randomButton").addEventListener("click", () => {
    chooseSpot(playableSpots[Math.floor(Math.random() * playableSpots.length)].id);
    openGame();
  });

  document.getElementById("newGameButton").addEventListener("click", () => {
    chooseSpot("vine-connect");
  });

  document.getElementById("discoverButton").addEventListener("click", () => {
    const index = spots.findIndex((spot) => spot.id === selectedSpot);
    chooseSpot(spots[(index + 1) % spots.length].id);
  });

  document.getElementById("launchButton").addEventListener("click", openGame);
  document.getElementById("backButton").addEventListener("click", closeGame);
  document.getElementById("soundButton").addEventListener("click", () => {
    document.getElementById("soundIcon").textContent = toggleSound() ? "♪" : "×";
  });
}

function chooseSpot(id) {
  const spot = spotById(id);
  selectedSpot = spot.id;
  document.getElementById("spotType").textContent = spot.type;
  document.getElementById("spotTitle").textContent = spot.title;
  document.getElementById("spotDescription").textContent = spot.description;
  const launchButton = document.getElementById("launchButton");
  launchButton.textContent = spot.playable ? "出発" : "発見中";
  launchButton.classList.toggle("is-locked", !spot.playable);

  document.querySelectorAll("[data-spot]").forEach((button) => {
    const active = button.dataset.spot === spot.id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const panel = document.querySelector(".spot-panel");
  panel.classList.remove("pop");
  void panel.offsetWidth;
  panel.classList.add("pop");
}

function openGame() {
  const spot = spotById(selectedSpot);
  if (!spot.playable) {
    document.querySelector(`[data-spot="${spot.id}"]`)?.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-8px) scale(1.08)" },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 360, easing: "ease-out" },
    );
    return;
  }

  cleanupGame?.();
  document.getElementById("gameIsland").textContent = spot.island.toUpperCase();
  document.getElementById("gameTitle").textContent = spot.title;
  cleanupGame = games[spot.id](document.getElementById("gameMount"));
  document.getElementById("mapView").classList.add("is-hidden");
  document.getElementById("gameView").classList.remove("is-hidden");
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

function closeGame() {
  cleanupGame?.();
  cleanupGame = null;
  document.getElementById("gameMount").innerHTML = "";
  document.getElementById("gameView").classList.add("is-hidden");
  document.getElementById("mapView").classList.remove("is-hidden");
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

renderApp();
