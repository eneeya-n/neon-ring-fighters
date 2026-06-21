class Fighter {
  constructor(options) {
    this.name = options.name;
    this.color = options.color;
    this.darkColor = options.darkColor;
    this.x = options.x;
    this.y = options.y;
    this.width = 54;
    this.height = 116;
    this.crouchHeight = 72;
    this.vx = 0;
    this.vy = 0;
    this.speed = options.speed || 390;
    this.jumpPower = options.jumpPower || 820;
    this.facing = options.facing || 1;
    this.health = 100;
    this.displayHealth = 100;
    this.score = 0;
    this.isGrounded = false;
    this.isCrouching = false;
    this.isAttacking = false;
    this.attackType = "punch";
    this.attackTimer = 0;
    this.attackDuration = 0.24;
    this.attackCooldown = 0;
    this.hitThisAttack = false;
    this.flashTimer = 0;
    this.knockbackTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.animationTime = 0;
    this.state = "idle";
  }

  reset(x, y, facing) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = 100;
    this.displayHealth = 100;
    this.isGrounded = false;
    this.isCrouching = false;
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.hitThisAttack = false;
    this.flashTimer = 0;
    this.knockbackTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.state = "idle";
  }

  get currentHeight() {
    return this.isCrouching && this.isGrounded ? this.crouchHeight : this.height;
  }

  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.currentHeight / 2;
  }

  getBounds() {
    const height = this.currentHeight;
    return {
      left: this.x,
      right: this.x + this.width,
      top: this.y + (this.height - height),
      bottom: this.y + this.height
    };
  }

  getHorizontalGap(target) {
    const self = this.getBounds();
    const other = target.getBounds();
    if (self.right < other.left) {
      return other.left - self.right;
    }
    if (other.right < self.left) {
      return self.left - other.right;
    }
    return 0;
  }

  hasVerticalOverlap(target) {
    const self = this.getBounds();
    const other = target.getBounds();
    return self.top < other.bottom && self.bottom > other.top;
  }

  getAttackBox() {
    const reach = this.attackType === "kick" ? 84 : 68;
    const height = this.attackType === "kick" ? 34 : 42;
    const topOffset = this.attackType === "kick" ? 62 : 30;
    const width = reach;
    const x = this.facing === 1 ? this.x + this.width - 6 : this.x - width + 6;

    return {
      left: x,
      right: x + width,
      top: this.y + topOffset,
      bottom: this.y + topOffset + height
    };
  }

  setDirection(direction) {
    if (this.knockbackTimer > 0) {
      return;
    }

    this.vx = direction * this.speed;
    if (direction !== 0) {
      this.facing = direction;
    }
  }

  stopHorizontal() {
    if (this.knockbackTimer <= 0) {
      this.vx = 0;
    }
  }

  jump() {
    if (!this.isGrounded || this.isCrouching) {
      return false;
    }

    this.vy = -this.jumpPower;
    this.isGrounded = false;
    return true;
  }

  crouch(isCrouching) {
    this.isCrouching = isCrouching && this.isGrounded && !this.isAttacking;
  }

  attack(type = "punch") {
    if (this.attackCooldown > 0 || this.isCrouching || this.health <= 0) {
      return false;
    }

    this.attackType = type;
    this.attackDuration = type === "kick" ? 0.34 : 0.24;
    this.attackTimer = this.attackDuration;
    this.attackCooldown = type === "kick" ? 0.62 : 0.38;
    this.isAttacking = true;
    this.hitThisAttack = false;
    this.state = type;
    return true;
  }

  takeDamage(amount, source, game) {
    if (this.health <= 0) {
      return;
    }

    this.health = Math.max(0, this.health - amount);
    this.flashTimer = 0.18;
    this.knockbackTimer = 0.16;
    this.vx = source.facing * 420;
    this.vy = Math.min(this.vy, -170);
    game.particles.burst(this.centerX, this.y + 44, source.color, 18);
    game.playSound("hit");
  }

  intersectsAttack(target) {
    const attack = this.getAttackBox();
    const box = target.getBounds();
    return attack.left < box.right &&
      attack.right > box.left &&
      attack.top < box.bottom &&
      attack.bottom > box.top;
  }

  update(dt, game) {
    this.animationTime += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);

    if (this.comboTimer === 0) {
      this.comboCount = 0;
    }

    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.state = "idle";
      }
    }

    this.vy += game.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const groundY = game.groundY - this.height;
    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      this.isGrounded = true;
    }

    this.x = Math.max(18, Math.min(game.width - this.width - 18, this.x));

    if (this.knockbackTimer <= 0 && !this.isAttacking) {
      this.vx *= Math.pow(0.001, dt);
      if (Math.abs(this.vx) < 8) {
        this.vx = 0;
      }
    }

    this.displayHealth += (this.health - this.displayHealth) * Math.min(1, dt * 8);
    this.updateAnimationState();
  }

  updateAnimationState() {
    if (this.health <= 0) {
      this.state = "defeated";
    } else if (this.isAttacking) {
      this.state = this.attackType;
    } else if (!this.isGrounded) {
      this.state = "jump";
    } else if (this.isCrouching) {
      this.state = "crouch";
    } else if (Math.abs(this.vx) > 35) {
      this.state = "walk";
    } else {
      this.state = "idle";
    }
  }

  resolveAttack(target, game) {
    const elapsed = this.attackDuration - this.attackTimer;
    const isActiveFrame = elapsed >= 0.04 && this.attackTimer > 0;

    if (!this.isAttacking || this.hitThisAttack || !isActiveFrame) {
      return;
    }

    // Close-contact fallback keeps combat responsive when body collision pushes fighters apart.
    const closeContact = this.getHorizontalGap(target) <= 18 && this.hasVerticalOverlap(target);
    if (this.intersectsAttack(target) || closeContact) {
      const baseDamage = this.attackType === "kick" ? 14 : 10;
      const comboBonus = this.comboCount >= 2 ? 5 : 0;
      this.comboCount += 1;
      this.comboTimer = 1.1;
      this.hitThisAttack = true;
      target.takeDamage(baseDamage + comboBonus, this, game);
      game.showFloatingText(
        this.comboCount >= 3 ? `${this.comboCount} HIT COMBO!` : `${baseDamage + comboBonus}`,
        target.centerX,
        target.y + 18,
        this.color
      );
    }
  }

  draw(ctx) {
    const bob = this.state === "idle" ? Math.sin(this.animationTime * 6) * 2 : 0;
    const walk = this.state === "walk" ? Math.sin(this.animationTime * 14) * 8 : 0;
    const flash = this.flashTimer > 0 && Math.floor(this.flashTimer * 60) % 2 === 0;
    const bodyColor = flash ? "#ffffff" : this.color;
    const outline = "#050817";
    const drawY = this.y + bob;
    const bodyTop = drawY + (this.height - this.currentHeight);

    ctx.save();
    ctx.translate(this.centerX, 0);
    ctx.scale(this.facing, 1);
    ctx.translate(-this.centerX, 0);

    // Pixel-like fighter built from rectangles, with state-based limb offsets.
    ctx.fillStyle = outline;
    ctx.fillRect(this.x + 11, bodyTop - 4, 32, 32);
    ctx.fillRect(this.x + 7, bodyTop + 28, 40, this.currentHeight - 28);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(this.x + 15, bodyTop, 24, 24);
    ctx.fillRect(this.x + 12, bodyTop + 30, 30, this.currentHeight - 42);

    ctx.fillStyle = this.darkColor;
    ctx.fillRect(this.x + 17, bodyTop + 7, 7, 6);
    ctx.fillRect(this.x + 30, bodyTop + 7, 7, 6);
    ctx.fillRect(this.x + 16, bodyTop + 20, 22, 4);

    this.drawArms(ctx, bodyTop, walk, bodyColor, outline);
    this.drawLegs(ctx, bodyTop, walk, bodyColor, outline);

    if (this.isAttacking) {
      this.drawAttackArc(ctx);
    }

    ctx.restore();
  }

  drawArms(ctx, bodyTop, walk, bodyColor, outline) {
    const shoulderY = bodyTop + 38;
    const rearArmY = shoulderY - walk * 0.2;
    const frontArmY = shoulderY + walk * 0.2;

    ctx.fillStyle = outline;
    ctx.fillRect(this.x + 2, rearArmY, 13, 42);

    if (this.state === "punch") {
      ctx.fillRect(this.x + 40, frontArmY - 3, 52, 16);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(this.x + 43, frontArmY, 46, 10);
    } else {
      ctx.fillRect(this.x + 39, frontArmY, 13, 42);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(this.x + 42, frontArmY + 3, 7, 35);
    }

    ctx.fillStyle = bodyColor;
    ctx.fillRect(this.x + 5, rearArmY + 3, 7, 35);
  }

  drawLegs(ctx, bodyTop, walk, bodyColor, outline) {
    const hipY = bodyTop + this.currentHeight - 38;
    const leftLeg = this.state === "walk" ? walk : 0;
    const rightLeg = this.state === "walk" ? -walk : 0;

    ctx.fillStyle = outline;
    ctx.fillRect(this.x + 12 + leftLeg * 0.15, hipY, 14, 40);

    if (this.state === "kick") {
      ctx.fillRect(this.x + 31, hipY + 4, 58, 15);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(this.x + 34, hipY + 7, 51, 9);
    } else {
      ctx.fillRect(this.x + 30 + rightLeg * 0.15, hipY, 14, 40);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(this.x + 33 + rightLeg * 0.15, hipY + 3, 8, 33);
    }

    ctx.fillStyle = bodyColor;
    ctx.fillRect(this.x + 15 + leftLeg * 0.15, hipY + 3, 8, 33);
  }

  drawAttackArc(ctx) {
    const box = this.getAttackBox();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = this.attackType === "kick" ? "#ffd166" : "#ffffff";
    ctx.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
    ctx.globalAlpha = 1;
  }
}

class Player extends Fighter {
  constructor(options) {
    super(options);
    this.keys = options.keys;
  }

  handleInput() {
    let direction = 0;
    if (this.keys.ArrowLeft) {
      direction -= 1;
    }
    if (this.keys.ArrowRight) {
      direction += 1;
    }

    this.setDirection(direction);
    this.crouch(Boolean(this.keys.ArrowDown));

    if (this.keys.ArrowUp) {
      this.jump();
    }
  }
}
