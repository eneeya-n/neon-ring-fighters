class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
  }

  burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 360;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: 4 + Math.random() * 7,
        life: 0.34 + Math.random() * 0.28,
        maxLife: 0.62,
        color
      });
    }
  }

  addText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      life: 0.9
    });
  }

  update(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += 920 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }

    for (const floatingText of this.floatingTexts) {
      floatingText.life -= dt;
      floatingText.y -= 62 * dt;
    }

    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.floatingTexts = this.floatingTexts.filter((floatingText) => floatingText.life > 0);
  }

  draw(ctx) {
    for (const particle of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    }

    ctx.save();
    ctx.font = "bold 22px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const floatingText of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, floatingText.life);
      ctx.fillStyle = "#050817";
      ctx.fillText(floatingText.text, floatingText.x + 3, floatingText.y + 3);
      ctx.fillStyle = floatingText.color;
      ctx.fillText(floatingText.text, floatingText.x, floatingText.y);
    }
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.keys = {};
    this.width = 1280;
    this.height = 720;
    this.groundY = 612;
    this.gravity = 2100;
    this.round = 1;
    this.matchTarget = 3;
    this.isRunning = false;
    this.isPaused = false;
    this.roundOver = false;
    this.soundEnabled = true;
    this.audioContext = null;
    this.lastTime = 0;
    this.resetTimer = 0;
    this.screenShake = 0;

    this.particles = new ParticleSystem();
    this.player = new Player({
      name: "Player",
      color: "#26d9ff",
      darkColor: "#1565ff",
      x: 220,
      y: 0,
      facing: 1,
      keys: this.keys
    });
    this.enemy = new EnemyAI({
      name: "AI Opponent",
      color: "#ff405f",
      darkColor: "#b90f34",
      x: 990,
      y: 0,
      facing: -1,
      speed: 345
    });

    this.ui = {
      startMenu: document.getElementById("startMenu"),
      victoryScreen: document.getElementById("victoryScreen"),
      victoryTitle: document.getElementById("victoryTitle"),
      victorySummary: document.getElementById("victorySummary"),
      startButton: document.getElementById("startButton"),
      restartButton: document.getElementById("restartButton"),
      soundToggleButton: document.getElementById("soundToggleButton"),
      playerHealth: document.getElementById("playerHealth"),
      enemyHealth: document.getElementById("enemyHealth"),
      playerHpText: document.getElementById("playerHpText"),
      enemyHpText: document.getElementById("enemyHpText"),
      playerScore: document.getElementById("playerScore"),
      enemyScore: document.getElementById("enemyScore"),
      roundCounter: document.getElementById("roundCounter"),
      roundMessage: document.getElementById("roundMessage"),
      pauseHint: document.getElementById("pauseHint")
    };

    this.bindEvents();
    this.resize();
    this.resetRound();
    this.updateUI();
    requestAnimationFrame((time) => this.loop(time));
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());

    window.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Shift"].includes(event.key)) {
        event.preventDefault();
      }

      if (event.key === "p" || event.key === "P") {
        this.togglePause();
        return;
      }

      if (!this.isRunning || this.isPaused || this.roundOver) {
        return;
      }

      if (event.key === " ") {
        if (this.player.attack("punch")) {
          this.playSound("attack");
        }
        return;
      }

      if (event.key === "Shift") {
        if (this.player.attack("kick")) {
          this.playSound("kick");
        }
        return;
      }

      this.keys[event.key] = true;
    });

    window.addEventListener("keyup", (event) => {
      this.keys[event.key] = false;
    });

    this.ui.startButton.addEventListener("click", () => {
      this.ensureAudio();
      this.startMatch();
    });

    this.ui.restartButton.addEventListener("click", () => {
      this.ensureAudio();
      this.restartMatch();
    });

    this.ui.soundToggleButton.addEventListener("click", () => {
      this.soundEnabled = !this.soundEnabled;
      this.ui.soundToggleButton.textContent = `Sound: ${this.soundEnabled ? "On" : "Off"}`;
      if (this.soundEnabled) {
        this.ensureAudio();
      }
    });
  }

  resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.groundY = Math.max(360, this.height - Math.max(74, this.height * 0.14));
  }

  startMatch() {
    this.isRunning = true;
    this.isPaused = false;
    this.ui.startMenu.classList.add("hidden");
    this.showRoundMessage("Fight!");
    this.playSound("start");
  }

  restartMatch() {
    this.player.score = 0;
    this.enemy.score = 0;
    this.round = 1;
    this.isRunning = true;
    this.isPaused = false;
    this.roundOver = false;
    this.ui.victoryScreen.classList.add("hidden");
    this.ui.startMenu.classList.add("hidden");
    this.resetRound();
    this.showRoundMessage("Fight!");
    this.playSound("start");
  }

  togglePause() {
    if (!this.isRunning || this.roundOver) {
      return;
    }

    this.isPaused = !this.isPaused;
    this.ui.pauseHint.textContent = this.isPaused ? "Paused" : "Press P to Pause";
    this.showRoundMessage(this.isPaused ? "Paused" : "Fight!");
  }

  resetRound() {
    this.roundOver = false;
    this.resetTimer = 0;
    const playerX = Math.max(70, this.width * 0.18);
    const enemyX = Math.min(this.width - 130, this.width * 0.78);
    this.player.reset(playerX, this.groundY - this.player.height, 1);
    this.enemy.reset(enemyX, this.groundY - this.enemy.height, -1);
    this.enemy.setDifficulty(this.round);
    this.particles = new ParticleSystem();
    this.keys.ArrowLeft = false;
    this.keys.ArrowRight = false;
    this.keys.ArrowUp = false;
    this.keys.ArrowDown = false;
    this.updateUI();
  }

  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;

    if (this.isRunning && !this.isPaused) {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    if (this.roundOver) {
      this.resetTimer -= dt;
      this.particles.update(dt);
      this.screenShake = Math.max(0, this.screenShake - dt);
      if (this.resetTimer <= 0) {
        this.advanceAfterRound();
      }
      this.updateUI();
      return;
    }

    this.player.handleInput();
    this.enemy.updateAI(dt, this.player, this);
    this.player.update(dt, this);
    this.enemy.update(dt, this);
    this.resolveBodyCollision();
    this.player.resolveAttack(this.enemy, this);
    this.enemy.resolveAttack(this.player, this);
    this.particles.update(dt);
    this.screenShake = Math.max(0, this.screenShake - dt);
    this.checkRoundEnd();
    this.updateUI();
  }

  resolveBodyCollision() {
    const a = this.player.getBounds();
    const b = this.enemy.getBounds();
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

    if (overlapX <= 0 || overlapY <= 0) {
      return;
    }

    const push = overlapX / 2 + 0.5;
    if (this.player.centerX < this.enemy.centerX) {
      this.player.x -= push;
      this.enemy.x += push;
    } else {
      this.player.x += push;
      this.enemy.x -= push;
    }

    this.player.x = Math.max(18, Math.min(this.width - this.player.width - 18, this.player.x));
    this.enemy.x = Math.max(18, Math.min(this.width - this.enemy.width - 18, this.enemy.x));
  }

  checkRoundEnd() {
    if (this.player.health > 0 && this.enemy.health > 0) {
      return;
    }

    const winner = this.player.health > 0 ? this.player : this.enemy;
    winner.score += 1;
    this.roundOver = true;
    this.resetTimer = 3;
    this.screenShake = 0.45;
    this.showRoundMessage(`${winner.name} Wins!`);
    this.playSound("win");
  }

  advanceAfterRound() {
    if (this.player.score >= this.matchTarget || this.enemy.score >= this.matchTarget) {
      this.showVictoryScreen(this.player.score >= this.matchTarget ? this.player : this.enemy);
      return;
    }

    this.round += 1;
    this.resetRound();
    this.showRoundMessage(`Round ${this.round}`);
  }

  showVictoryScreen(winner) {
    this.isRunning = false;
    this.roundOver = false;
    this.ui.victoryTitle.textContent = winner === this.player ? "Blue Wins!" : "Red Wins!";
    this.ui.victorySummary.textContent = `${winner.name} takes the match ${this.player.score}-${this.enemy.score}. Press restart for a fresh arcade run.`;
    this.ui.victoryScreen.classList.remove("hidden");
  }

  showRoundMessage(message) {
    this.ui.roundMessage.textContent = message;
    this.ui.roundMessage.classList.remove("hidden");
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      if (!this.isPaused) {
        this.ui.roundMessage.classList.add("hidden");
      }
    }, 1200);
  }

  showFloatingText(text, x, y, color) {
    this.particles.addText(text, x, y, color);
    this.screenShake = 0.12;
  }

  updateUI() {
    this.ui.playerHealth.style.width = `${this.player.displayHealth}%`;
    this.ui.enemyHealth.style.width = `${this.enemy.displayHealth}%`;
    this.ui.playerHpText.textContent = `${Math.ceil(this.player.health)} HP`;
    this.ui.enemyHpText.textContent = `${Math.ceil(this.enemy.health)} HP`;
    this.ui.playerScore.textContent = this.player.score;
    this.ui.enemyScore.textContent = this.enemy.score;
    this.ui.roundCounter.textContent = this.round;
  }

  render() {
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * 10 : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * 7 : 0;

    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.drawArena();
    this.player.draw(this.ctx);
    this.enemy.draw(this.ctx);
    this.particles.draw(this.ctx);
    this.drawAiState();
    this.ctx.restore();
  }

  drawArena() {
    const ctx = this.ctx;
    const horizon = this.groundY - 250;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#161b4f");
    gradient.addColorStop(0.56, "#0d1237");
    gradient.addColorStop(1, "#060817");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Neon skyline and moon establish the arena without external assets.
    ctx.fillStyle = "rgba(255, 209, 102, 0.85)";
    ctx.beginPath();
    ctx.arc(this.width * 0.5, Math.max(80, this.height * 0.16), 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#07091f";
    for (let x = 0; x < this.width; x += 74) {
      const buildingHeight = 70 + ((x * 17) % 130);
      ctx.fillRect(x, horizon - buildingHeight, 58, buildingHeight);
      ctx.fillStyle = "rgba(38, 217, 255, 0.45)";
      for (let y = horizon - buildingHeight + 16; y < horizon - 12; y += 24) {
        ctx.fillRect(x + 10, y, 8, 10);
        ctx.fillRect(x + 34, y, 8, 10);
      }
      ctx.fillStyle = "#07091f";
    }

    ctx.strokeStyle = "rgba(38, 217, 255, 0.32)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const y = this.groundY - 180 + i * 38;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#24294f";
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

    ctx.strokeStyle = "rgba(255, 209, 102, 0.36)";
    ctx.lineWidth = 2;
    for (let x = -this.width; x < this.width * 2; x += 54) {
      ctx.beginPath();
      ctx.moveTo(x, this.height);
      ctx.lineTo(this.width / 2 + (x - this.width / 2) * 0.22, this.groundY);
      ctx.stroke();
    }

    for (let y = this.groundY; y < this.height; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#101738";
    ctx.fillRect(0, this.groundY - 16, this.width, 20);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(0, this.groundY - 18, this.width, 4);
  }

  drawAiState() {
    this.ctx.save();
    this.ctx.font = "bold 13px Courier New";
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.fillText(this.enemy.aiState, this.enemy.centerX, this.enemy.y - 14);
    this.ctx.restore();
  }

  ensureAudio() {
    if (!this.soundEnabled) {
      return;
    }

    if (!this.audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        this.soundEnabled = false;
        this.ui.soundToggleButton.textContent = "Sound: Off";
        return;
      }
      this.audioContext = new AudioCtor();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  playSound(type) {
    if (!this.soundEnabled) {
      return;
    }

    this.ensureAudio();
    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const settings = {
      attack: [300, 0.045, "square", 0.09],
      kick: [140, 0.075, "sawtooth", 0.12],
      hit: [70, 0.11, "triangle", 0.18],
      win: [520, 0.34, "square", 0.1],
      start: [420, 0.18, "square", 0.08]
    }[type] || [220, 0.08, "square", 0.08];

    oscillator.type = settings[2];
    oscillator.frequency.setValueAtTime(settings[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, settings[0] * 0.45), now + settings[1]);
    gain.gain.setValueAtTime(settings[3], now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings[1]);
    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[1] + 0.02);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.neonRingFighters = new Game();
});
