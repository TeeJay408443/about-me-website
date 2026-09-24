(() => {
  const stage = document.querySelector("#bubble-stage");
  if (!stage) return;

  const STORAGE_KEY = "tyler-bubble-collector-v1";
  const defaultState = {
    bubbles: 0,
    clicked: 0,
    powerLevel: 0,
    speedLevel: 0,
    autoLevel: 0,
    paused: false
  };

  const elements = {
    balance: document.querySelector("#bubble-balance"),
    clicked: document.querySelector("#bubble-clicked"),
    power: document.querySelector("#bubble-power"),
    auto: document.querySelector("#bubble-auto"),
    pause: document.querySelector("#bubble-pause"),
    reset: document.querySelector("#bubble-reset"),
    status: document.querySelector("#bubble-status"),
    upgrades: [...document.querySelectorAll("[data-upgrade]")]
  };

  let state = loadState();
  let spawnTimer;
  let autoTimer;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return { ...defaultState };
      return {
        bubbles: toSafeNumber(saved.bubbles),
        clicked: toSafeNumber(saved.clicked),
        powerLevel: toSafeNumber(saved.powerLevel),
        speedLevel: toSafeNumber(saved.speedLevel),
        autoLevel: toSafeNumber(saved.autoLevel),
        paused: Boolean(saved.paused)
      };
    } catch {
      return { ...defaultState };
    }
  }

  function toSafeNumber(value) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The game still works if browser storage is unavailable.
    }
  }

  function clickPower() {
    return 1 + state.powerLevel;
  }

  function spawnDelay() {
    return Math.max(420, 1350 - (state.speedLevel * 115));
  }

  function upgradeCost(type) {
    const baseCosts = { power: 10, speed: 15, auto: 25 };
    return Math.round(baseCosts[type] * Math.pow(1.75, state[`${type}Level`]));
  }

  function formatNumber(value) {
    return Math.floor(value).toLocaleString();
  }

  function updateDisplay() {
    elements.balance.textContent = formatNumber(state.bubbles);
    elements.clicked.textContent = formatNumber(state.clicked);
    elements.power.textContent = formatNumber(clickPower());
    elements.auto.textContent = formatNumber(state.autoLevel);
    elements.pause.textContent = state.paused ? "Resume" : "Pause";
    elements.pause.setAttribute("aria-pressed", String(state.paused));
    stage.classList.toggle("is-paused", state.paused);

    elements.upgrades.forEach((button) => {
      const type = button.dataset.upgrade;
      const cost = upgradeCost(type);
      button.querySelector(`[data-level="${type}"]`).textContent = state[`${type}Level`];
      button.querySelector(`[data-cost="${type}"]`).textContent = formatNumber(cost);
      button.disabled = state.bubbles < cost;
      button.setAttribute("aria-label", `${button.querySelector(".upgrade-copy strong").textContent}, level ${state[`${type}Level`]}, costs ${cost} bubbles`);
    });
  }

  function createBubble() {
    if (state.paused || stage.querySelectorAll(".game-bubble").length >= 18) return;

    const bubble = document.createElement("button");
    const size = 42 + Math.round(Math.random() * 42);
    const travelTime = 5.2 + (Math.random() * 3.8);
    const maxLeft = Math.max(0, stage.clientWidth - size - 8);
    const colors = ["#dcbce6", "#fffebe", "#b9dcaa", "#f6b7d2", "#a9dce3"];

    bubble.type = "button";
    bubble.className = "game-bubble";
    bubble.setAttribute("aria-label", `Pop bubble for ${clickPower()} ${clickPower() === 1 ? "point" : "points"}`);
    bubble.style.setProperty("--bubble-size", `${size}px`);
    bubble.style.setProperty("--bubble-left", `${Math.round(4 + Math.random() * maxLeft)}px`);
    bubble.style.setProperty("--bubble-duration", `${travelTime}s`);
    bubble.style.setProperty("--bubble-color", colors[Math.floor(Math.random() * colors.length)]);

    bubble.addEventListener("click", () => {
      if (state.paused || bubble.classList.contains("is-popped")) return;
      state.clicked += 1;
      state.bubbles += clickPower();
      bubble.classList.add("is-popped");
      elements.status.textContent = `+${clickPower()} ${clickPower() === 1 ? "bubble" : "bubbles"}!`;
      saveState();
      updateDisplay();
      window.setTimeout(() => bubble.remove(), 180);
    });

    bubble.addEventListener("animationend", () => bubble.remove());
    stage.appendChild(bubble);
  }

  function startSpawner() {
    window.clearInterval(spawnTimer);
    spawnTimer = window.setInterval(createBubble, spawnDelay());
  }

  function startAutoCollector() {
    window.clearInterval(autoTimer);
    autoTimer = window.setInterval(() => {
      if (state.paused || state.autoLevel < 1) return;
      state.bubbles += state.autoLevel;
      saveState();
      updateDisplay();
    }, 1000);
  }

  elements.upgrades.forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.upgrade;
      const cost = upgradeCost(type);
      if (state.bubbles < cost) return;

      state.bubbles -= cost;
      state[`${type}Level`] += 1;
      if (type === "speed") startSpawner();
      elements.status.textContent = `${button.querySelector(".upgrade-copy strong").textContent} upgraded to level ${state[`${type}Level`]}.`;
      saveState();
      updateDisplay();
    });
  });

  elements.pause.addEventListener("click", () => {
    state.paused = !state.paused;
    elements.status.textContent = state.paused ? "Game paused." : "Game resumed.";
    saveState();
    updateDisplay();
    if (!state.paused && !stage.querySelector(".game-bubble")) createBubble();
  });

  elements.reset.addEventListener("click", () => {
    if (!window.confirm("Reset your bubble score and every upgrade?")) return;
    state = { ...defaultState };
    stage.querySelectorAll(".game-bubble").forEach((bubble) => bubble.remove());
    elements.status.textContent = "Progress reset. Click a bubble to begin.";
    saveState();
    startSpawner();
    updateDisplay();
    createBubble();
  });

  updateDisplay();
  startSpawner();
  startAutoCollector();
  createBubble();
})();