import Phaser from "phaser"

// Hole mode system
enum ModeType {
  Normal = "normal",
  Shape = "shape",
  Shader = "shader",
}
interface HoleMode {
  applyMode(): void
  resetMode(): void
  isInsideHole(zombie: Phaser.Physics.Arcade.Sprite): boolean
  update?(): void
}
class NormalMode implements HoleMode {
  constructor(private scene: MainScene) {}
  applyMode(): void {
    this.scene.hole.setVisible(true)
    this.scene.holeOverlay.setVisible(true)
  }
  resetMode(): void {}
  isInsideHole(zombie: Phaser.Physics.Arcade.Sprite): boolean {
    const holeRadius = this.scene.hole.width * this.scene.hole.scaleX - 20
    const zombieRadius = (zombie.width * zombie.scaleX) / 2
    const dist = Phaser.Math.Distance.Between(
      this.scene.hole.x,
      this.scene.hole.y,
      zombie.x,
      zombie.y,
    )
    return dist + zombieRadius <= holeRadius
  }
}
class ShapeMode implements HoleMode {
  private graphics!: Phaser.GameObjects.Graphics
  private polygon!: Phaser.Geom.Polygon
  private relativePoints!: Phaser.Math.Vector2[]
  constructor(private scene: MainScene) {}
  applyMode(): void {
    this.scene.hole.setVisible(false)
    this.scene.holeOverlay.setVisible(false)
    const cx = this.scene.hole.x
    const cy = this.scene.hole.y
    const radius = (this.scene.hole.width * this.scene.hole.scaleX) / 2
    const sides = Phaser.Math.Between(5, 8)
    this.relativePoints = []
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2
      const r = Phaser.Math.Between(radius * 0.5, radius)
      this.relativePoints.push(
        new Phaser.Math.Vector2(Math.cos(angle) * r, Math.sin(angle) * r),
      )
    }
    this.graphics = this.scene.add.graphics({
      fillStyle: { color: Phaser.Display.Color.RandomRGB().color },
    })
    // Normalize polygon area to match circle area (πr²)
    // Compute area via shoelace formula on relativePoints
    const currentArea = Math.abs(
      this.relativePoints.reduce((sum, p, i, arr) => {
        const next = arr[(i + 1) % arr.length]
        return sum + (p.x * next.y - next.x * p.y)
      }, 0) / 2,
    )
    const targetArea = Math.PI * radius * radius
    const scaleFactor = Math.sqrt(targetArea / currentArea)
    this.relativePoints.forEach((p) => p.scale(scaleFactor))
    // Initial draw
    this.update()
  }
  resetMode(): void {
    this.graphics.destroy()
  }
  update(): void {
    this.graphics.clear()
    const cx = this.scene.hole.x
    const cy = this.scene.hole.y
    const absPoints: Phaser.Math.Vector2[] = this.relativePoints.map(
      (p) => new Phaser.Math.Vector2(cx + p.x, cy + p.y),
    )
    this.polygon = new Phaser.Geom.Polygon(
      absPoints.map((p) => [p.x, p.y]).flat(),
    )
    this.graphics.fillPoints(this.polygon.points, true)
  }
  isInsideHole(zombie: Phaser.Physics.Arcade.Sprite): boolean {
    return Phaser.Geom.Polygon.Contains(this.polygon, zombie.x, zombie.y)
  }
}
class ShaderMode implements HoleMode {
  constructor(private scene: MainScene) {}
  applyMode(): void {
    this.scene.hole.setVisible(true)
    this.scene.holeOverlay.setVisible(true)
    // placeholder shader effect: continuous rotation
    this.scene.tweens.add({
      targets: this.scene.holeOverlay,
      angle: 360,
      duration: 2000,
      repeat: -1,
    })
  }
  resetMode(): void {
    this.scene.tweens.killTweensOf(this.scene.holeOverlay)
    this.scene.holeOverlay.setAngle(0)
  }
  isInsideHole(zombie: Phaser.Physics.Arcade.Sprite): boolean {
    const holeRadius = this.scene.hole.width * this.scene.hole.scaleX - 20
    const zombieRadius = (zombie.width * zombie.scaleX) / 2
    const dist = Phaser.Math.Distance.Between(
      this.scene.hole.x,
      this.scene.hole.y,
      zombie.x,
      zombie.y,
    )
    return dist + zombieRadius <= holeRadius
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" })
  }
  private zombies!: Phaser.GameObjects.Group
  public hole!: Phaser.GameObjects.Ellipse
  public holeOverlay!: Phaser.GameObjects.Image
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

    // Add overlay image above the hole
    this.holeOverlay = this.add.image(
      this.hole.x,
      this.hole.y,
      "bigHoleOverlay",
    )
    this.holeOverlay.setOrigin(0.5, 0.5)
    this.holeOverlay.setDisplaySize(this.hole.width, this.hole.height)
    this.holeOverlay.setDepth(10) // Ensure it's above the hole

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
          case ModeType.Shape:
            if (this.score % 10 === 0) {
              this.holeScale *= 1.05
              this.hole.setScale(this.holeScale)
              // regenerate shape polygon after growth
              this.currentMode.resetMode()
              this.currentMode.applyMode()
              this.currentMode.update?.()
            }
            break
          case ModeType.Shader:
            this.holeScale *= 1.002 // 0.2% growth per point
            this.hole.setScale(this.holeScale)
            break
        }
        // regenerate shape on every swallow when in Shape mode
        if (this.currentModeType === ModeType.Shape) {
          this.currentMode.resetMode()
          this.currentMode.applyMode()
          this.currentMode.update?.()
        }
        this.dyingZombies.splice(i, 1)
      }
    }

    // Sync overlay position and scale to the hole
    if (this.holeOverlay) {
      this.holeOverlay.x = this.hole.x
      this.holeOverlay.y = this.hole.y
      this.holeOverlay.setDisplaySize(
        this.hole.width * this.hole.scaleX,
        this.hole.height * this.hole.scaleY,
      )
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

// New HUD scene that overlays the score
class HUDScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: "HUDScene", active: false })
  }

  create() {
    // Display score in top-left corner, fixed to camera
    this.scoreText = this.add.text(10, 10, "Score: 0", {
      fontSize: "20px",
      color: "#ffffff",
    })
    this.scoreText.setScrollFactor(0)

    // Listen to score updates from MainScene instance passed in data
    const mainScene = (this.scene.settings.data as any).mainScene as MainScene
    mainScene.events.on("scoreChanged", (score: number) => {
      this.scoreText.setText("Score: " + score)
    })
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#87CEEB",
  roundPixels: true,
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [MainScene, HUDScene], // include both scenes
}

new Phaser.Game(config)
