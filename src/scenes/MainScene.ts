import { NormalMode, ShaderMode, ShapeMode } from "../lib/holeModes"
import { HoleMode, ModeType } from "../lib/types"

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" })
  }
  private zombies!: Phaser.GameObjects.Group
  public hole!: Phaser.GameObjects.Ellipse
  private score: number = 0
  private dyingZombies: {
    zombie: Phaser.Physics.Arcade.Sprite
    startTime: number
    startX: number
    startY: number
    startScaleX: number
    startScaleY: number
    startRotation?: number
    targetRotation?: number
  }[] = []

  // mode properties
  private modes!: { [key in ModeType]: HoleMode }
  private currentModeType!: ModeType
  private currentMode!: HoleMode
  // Global hole size scale
  private holeScale: number = 1
  private sizeThresholds: number[] = [20, 40, 80, 160, 320] // for normal mode

  preload() {
    // Load assets here (e.g., zombie sprites)
    this.load.spritesheet("zombie", "assets/zombie.png", {
      frameWidth: 64,
      frameHeight: 64,
      startFrame: 0,
      endFrame: 6,
    })
    this.load.image("brick", "assets/brick-texture.png")
    this.load.image("bigHoleOverlay", "assets/big-ol-hole.png")
  }

  create() {
    // Create the hole with a physics body
    this.hole = this.add.ellipse(400, 300, 100, 100, 0x00000000)
    this.physics.add.existing(this.hole, false)
    const holeBody = this.hole.body as Phaser.Physics.Arcade.Body
    holeBody.setCircle(50)
    holeBody.setImmovable(true)

    // Add drag movement logic
    let dragging = false
    let prevX = 0
    let prevY = 0
    const speed = 200

    let downPos = { x: 0, y: 0 }
    const moveDir = { x: 0, y: 0 }

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      dragging = true
      downPos.x = pointer.x
      downPos.y = pointer.y
    })

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (dragging) {
        const dx = pointer.x - downPos.x
        const dy = pointer.y - downPos.y
        holeBody.setVelocity(dx, dy)
        prevX = pointer.x
        prevY = pointer.y
      }
    })

    this.input.on("pointerup", () => {
      dragging = false
      holeBody.setVelocity(0, 0)
    })

    // Define a larger game world
    const worldWidth = 5000
    const worldHeight = 5000
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.startFollow(this.hole, true)

    // Add tiled brick background covering entire world
    this.add
      .tileSprite(0, 0, worldWidth, worldHeight, "brick")
      .setOrigin(0, 0)
      .setDepth(-1)

    // Create zombie walk animation
    this.anims.create({
      key: "zombie_walk",
      frames: this.anims.generateFrameNumbers("zombie", { start: 0, end: 6 }),
      frameRate: 8,
      repeat: -1,
    })

    // Spawn more zombies at random positions across the world
    this.zombies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
    })

    const zombieCount = 1000
    for (let i = 0; i < zombieCount; i++) {
      const x = Phaser.Math.Between(0, worldWidth)
      const y = Phaser.Math.Between(0, worldHeight)
      // Spawn each zombie via the group so it's a Sprite with animations
      const zombie = this.zombies.create(
        x,
        y,
        "zombie",
        0,
      ) as Phaser.Physics.Arcade.Sprite
      zombie.anims.play("zombie_walk", true)
      const body = zombie.body as Phaser.Physics.Arcade.Body

      // Set custom hitbox size and offset
      body.setSize(3, 3)
      body.setOffset(29, 44)

      const zombieSpeed = 50
      body.setVelocity(
        Phaser.Math.Between(-zombieSpeed, zombieSpeed),
        Phaser.Math.Between(-zombieSpeed, zombieSpeed),
      )
      body.setCollideWorldBounds(true)
      body.setBounce(1, 1)
    }

    // Add collision detection between the hole and zombies
    this.physics.add.overlap(
      this.hole,
      this.zombies,
      (_hole, zombie) =>
        this.swallowZombie(zombie as Phaser.Physics.Arcade.Sprite),
      undefined,
      this,
    )

    // Launch the HUD scene to display the score, passing this MainScene instance
    this.scene.launch("HUDScene", { mainScene: this })

    // Initialize modes
    this.modes = {
      [ModeType.Normal]: new NormalMode(this),
      [ModeType.Shape]: new ShapeMode(this),
      [ModeType.Shader]: new ShaderMode(this),
    }
    this.currentModeType = ModeType.Normal
    this.currentMode = this.modes[this.currentModeType]
    // Initial mode visuals
    this.currentMode.applyMode()
    // apply global scale
    this.hole.setScale(this.holeScale)

    // Toggle modes with H key
    this.input.keyboard!.on("keydown-H", this.switchMode, this)
  }

  // mode switcher
  private switchMode(): void {
    this.currentMode.resetMode()
    const order = [ModeType.Normal, ModeType.Shape, ModeType.Shader]
    const nextIndex = (order.indexOf(this.currentModeType) + 1) % order.length
    this.currentModeType = order[nextIndex]
    this.currentMode = this.modes[this.currentModeType]
    this.currentMode.applyMode()
    // apply global scale
    this.hole.setScale(this.holeScale)
    // ensure shape visuals update to new scale
    this.currentMode.update?.()
  }

  swallowZombie(zombie: Phaser.Physics.Arcade.Sprite) {
    // only swallow if mode allows
    if (!this.currentMode.isInsideHole(zombie)) return

    // Disable zombie's physics body to prevent multiple swallows
    if (zombie.body) {
      ;(zombie.body as Phaser.Physics.Arcade.Body).enable = false
    }

    // Determine target rotation based on velocity
    let targetRotation = 0
    let startRotation = zombie.rotation
    const body = zombie.body as Phaser.Physics.Arcade.Body
    if (body.velocity.x > 0) {
      targetRotation = Phaser.Math.DegToRad(-90) // 90° left
    } else if (body.velocity.x < 0) {
      targetRotation = Phaser.Math.DegToRad(90) // 90° right
    }

    // Mark zombie as dying and store animation info
    this.dyingZombies.push({
      zombie,
      startTime: this.time.now,
      startX: zombie.x,
      startY: zombie.y,
      startScaleX: zombie.scaleX,
      startScaleY: zombie.scaleY,
      startRotation,
      targetRotation,
    })
  }

  update() {
    // update current mode visuals
    this.currentMode.update?.()

    // Animate dying zombies
    const DURATION = 400
    for (let i = this.dyingZombies.length - 1; i >= 0; i--) {
      const entry = this.dyingZombies[i]
      const t = Math.min(1, (this.time.now - entry.startTime) / DURATION)
      // Interpolate position and scale
      entry.zombie.x = Phaser.Math.Interpolation.Linear(
        [entry.startX, this.hole.x],
        t,
      )
      entry.zombie.y = Phaser.Math.Interpolation.Linear(
        [entry.startY, this.hole.y],
        t,
      )
      entry.zombie.scaleX = Phaser.Math.Interpolation.Linear(
        [entry.startScaleX, 0],
        t,
      )
      entry.zombie.scaleY = Phaser.Math.Interpolation.Linear(
        [entry.startScaleY, 0],
        t,
      )
      // Interpolate rotation
      if (
        typeof entry.startRotation !== "undefined" &&
        typeof entry.targetRotation !== "undefined"
      ) {
        entry.zombie.rotation = Phaser.Math.Interpolation.Linear(
          [entry.startRotation, entry.targetRotation],
          t,
        )
      }
      if (t >= 1) {
        entry.zombie.destroy()
        this.score += 1
        this.events.emit("scoreChanged", this.score)
        // Growth logic per mode
        switch (this.currentModeType) {
          case ModeType.Normal:
            if (this.sizeThresholds.includes(this.score)) {
              this.holeScale *= 1.2
              this.hole.setScale(this.holeScale)
            }
            break
          case ModeType.Shader:
            this.holeScale *= 1.002 // 0.2% growth per point
            this.hole.setScale(this.holeScale)
            break
        }
        // For Shape mode, grow one random vertex each point
        if (this.currentModeType === ModeType.Shape) {
          ;(this.currentMode as ShapeMode).growRandomNode(4)
          this.currentMode.update?.()
        }
        this.dyingZombies.splice(i, 1)
      }
    }

    // Depth sort zombies based on their y-position
    this.zombies.getChildren().forEach((child) => {
      const zombie = child as Phaser.Physics.Arcade.Sprite
      // Skip dying zombies
      if (this.dyingZombies.some((dz) => dz.zombie === zombie)) return
      const body = zombie.body as Phaser.Physics.Arcade.Body
      zombie.setDepth(zombie.y)
      const vx = body.velocity.x
      if (vx > 0) {
        zombie.setFlipX(true)
      } else if (vx < 0) {
        zombie.setFlipX(false)
      }

      // Avoid the hole if too close
      // Make threshold dynamic based on hole size
      const holeRadius = (this.hole.width * this.hole.scaleX) / 2
      const threshold = holeRadius * 2
      const dist = Phaser.Math.Distance.Between(
        this.hole.x,
        this.hole.y,
        zombie.x,
        zombie.y,
      )
      if (dist < threshold) {
        const dx = zombie.x - this.hole.x
        const dy = zombie.y - this.hole.y
        const mag = Math.hypot(dx, dy) || 1
        const avoidSpeed = 75
        body.setVelocity((dx / mag) * avoidSpeed, (dy / mag) * avoidSpeed)
      }
    })
  }
}
