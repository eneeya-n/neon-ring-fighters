class EnemyAI extends Fighter {
  constructor(options) {
    super(options);
    this.aiState = "Idle";
    this.decisionTimer = 0;
    this.jumpTimer = 1.5;
    this.retreatTimer = 0;
    this.difficulty = 1;
    this.reactionDelay = 0.18;
    this.attackRange = 58;
  }

  setDifficulty(round) {
    this.difficulty = 1 + (round - 1) * 0.16;
    this.speed = Math.min(530, 335 + round * 24);
    this.attackRange = Math.min(82, 54 + round * 3);
    this.reactionDelay = Math.max(0.05, 0.2 - round * 0.015);
  }

  reset(x, y, facing) {
    super.reset(x, y, facing);
    this.aiState = "Idle";
    this.decisionTimer = 0.35;
    this.jumpTimer = 1.2;
    this.retreatTimer = 0;
  }

  updateAI(dt, player, game) {
    if (this.health <= 0 || player.health <= 0) {
      this.stopHorizontal();
      return;
    }

    const distance = player.centerX - this.centerX;
    const absDistance = Math.abs(distance);
    const gap = this.getHorizontalGap(player);
    this.facing = distance >= 0 ? 1 : -1;
    this.decisionTimer -= dt;
    this.jumpTimer -= dt;

    if (this.decisionTimer <= 0) {
      this.chooseState(gap, player, game);
      this.decisionTimer = this.reactionDelay + Math.random() * 0.18;
    }

    if (this.jumpTimer <= 0) {
      const jumpChance = Math.min(0.42, 0.15 + game.round * 0.025);
      if (Math.random() < jumpChance && absDistance < 360) {
        this.jump();
      }
      this.jumpTimer = Math.max(0.55, 2.4 - game.round * 0.12) + Math.random() * 1.2;
    }

    this.performState(dt, gap, distance, game);
  }

  chooseState(gap, player, game) {
    const pressure = this.health < player.health - 22 ? 0.18 : 0;
    const retreatChance = Math.min(0.35, 0.07 + game.round * 0.02 + pressure);

    if (this.retreatTimer > 0) {
      this.aiState = "Retreat";
      return;
    }

    if (gap <= this.attackRange && this.attackCooldown <= 0) {
      this.aiState = "Attack";
      return;
    }

    if (gap < 42 && Math.random() < retreatChance) {
      this.aiState = "Retreat";
      this.retreatTimer = 0.32 + Math.random() * 0.38;
      return;
    }

    this.aiState = gap > this.attackRange ? "Chase" : "Idle";
  }

  performState(dt, gap, distance, game) {
    switch (this.aiState) {
      case "Chase":
        this.setDirection(Math.sign(distance));
        break;
      case "Attack":
        this.stopHorizontal();
        if (gap <= this.attackRange + 8) {
          const attackType = Math.random() < 0.28 + this.difficulty * 0.03 ? "kick" : "punch";
          if (this.attack(attackType)) {
            game.playSound(attackType === "kick" ? "kick" : "attack");
          }
        }
        this.aiState = "Idle";
        break;
      case "Retreat":
        this.retreatTimer -= dt;
        this.setDirection(-Math.sign(distance || this.facing));
        if (this.retreatTimer <= 0) {
          this.aiState = "Idle";
        }
        break;
      case "Idle":
      default:
        this.stopHorizontal();
        break;
    }
  }
}
