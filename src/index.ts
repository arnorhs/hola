import Phaser from "phaser"

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" })
  }
  private zombies!: Phaser.GameObjects.Group
  private hole!: Phaser.GameObjects.Ellipse
  private holeOverlay!: Phaser.GameObjects.Image
  private score: number = 0
  private dyingZombies: {
    zombie: Phaser.Physics.Arcade.Sprite
    startTime: number
    startX: number
    startY: number
    startScaleX: number
    startScaleY: number
  }[] = []

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
    this.hole = this.add.ellipse(400, 300, 100, 100, 0x000000)
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
      (hole, zombie) =>
        this.swallowZombie(
          hole as Phaser.GameObjects.Ellipse,
          zombie as Phaser.Physics.Arcade.Sprite,
        ),
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
  }

  swallowZombie(
    hole: Phaser.GameObjects.Ellipse,
    zombie: Phaser.Physics.Arcade.Sprite,
  ) {
    // Only swallow if the zombie is entirely within the hole
    const holeRadius = this.hole.width * this.hole.scaleX - 20
    const zombieRadius = (zombie.width * zombie.scaleX) / 2
    const dist = Phaser.Math.Distance.Between(
      hole.x,
      hole.y,
      zombie.x,
      zombie.y,
    )
    if (dist + zombieRadius > holeRadius) {
      return
    }

    // Disable zombie's physics body to prevent multiple swallows
    if (zombie.body) {
      ;(zombie.body as Phaser.Physics.Arcade.Body).enable = false
    }

    // Mark zombie as dying and store animation info
    this.dyingZombies.push({
      zombie,
      startTime: this.time.now,
      startX: zombie.x,
      startY: zombie.y,
      startScaleX: zombie.scaleX,
      startScaleY: zombie.scaleY,
    })
  }

  update() {
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
      if (t >= 1) {
        entry.zombie.destroy()
        this.score += 1
        this.events.emit("scoreChanged", this.score)
        // Check if the hole should grow
        if (
          this.score === 20 ||
          this.score === 40 ||
          this.score === 80 ||
          this.score === 160 ||
          this.score === 320
        ) {
          this.hole.setScale(this.hole.scale * 1.2)
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
