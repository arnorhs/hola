import Phaser from "phaser"

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" })
  }
  private zombies!: Phaser.GameObjects.Group
  private hole!: Phaser.GameObjects.Ellipse
  private score: number = 0

  preload() {
    // Load assets here (e.g., zombie sprites)
    this.load.spritesheet("zombie", "assets/zombie.png", {
      frameWidth: 64,
      frameHeight: 64,
      startFrame: 0,
      endFrame: 6,
    })
    this.load.image("brick", "assets/brick-texture.png")
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
      body.setVelocity(
        Phaser.Math.Between(-100, 100),
        Phaser.Math.Between(-100, 100),
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
  }

  swallowZombie(
    hole: Phaser.GameObjects.Ellipse,
    zombie: Phaser.Physics.Arcade.Sprite,
  ) {
    zombie.destroy()
    this.score += 1
    this.events.emit("scoreChanged", this.score) // Notify HUD of score update

    // Check if the hole should grow
    if (this.score === 50 || this.score === 200) {
      this.hole.setScale(this.hole.scale + 0.5)
    }
  }

  update() {
    // Check for collisions and update score
    // Depth sort zombies based on their y-position
    this.zombies.getChildren().forEach((child) => {
      const zombie = child as Phaser.Physics.Arcade.Sprite
      zombie.setDepth(zombie.y)
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
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [MainScene, HUDScene], // include both scenes
}

new Phaser.Game(config)
