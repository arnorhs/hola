import Phaser from 'phaser';

class MainScene extends Phaser.Scene {
  private zombies!: Phaser.GameObjects.Group;
  private hole!: Phaser.GameObjects.Ellipse;
  private score: number = 0;

  preload() {
    // Load assets here (e.g., zombie sprites)
    this.load.image('zombie', 'path/to/zombie.png');
  }

  create() {
    // Create the hole with a physics body
    this.hole = this.add.ellipse(400, 300, 100, 100, 0x000000);
    this.physics.add.existing(this.hole, false);
    const holeBody = this.hole.body as Phaser.Physics.Arcade.Body;
    holeBody.setCircle(50);
    holeBody.setImmovable(true);

    // Add drag movement logic
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    const speed = 200;

    let downPos = {x: 0, y: 0 };
    const moveDir = {x: 0, y: 0 };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      dragging = true;
      downPos.x = pointer.x;
      downPos.y = pointer.y;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (dragging) {
        const dx = pointer.x - downPos.x;
        const dy = pointer.y - downPos.y;
          holeBody.setVelocity(dx, dy);
        prevX = pointer.x;
        prevY = pointer.y;
      }
    });

    this.input.on('pointerup', () => {
      dragging = false;
      holeBody.setVelocity(0, 0);
    });

    // Create a group of zombies
    this.zombies = this.physics.add.group({
      key: 'zombie',
      repeat: 20,
      setXY: { x: 50, y: 50, stepX: 70, stepY: 50 },
    });

    // Add collision detection between the hole and zombies
    this.physics.add.overlap(
      this.hole,
      this.zombies,
      (hole, zombie) => this.swallowZombie(hole as Phaser.GameObjects.Ellipse, zombie as Phaser.Physics.Arcade.Sprite),
      undefined,
      this
    );
  }

  swallowZombie(hole: Phaser.GameObjects.Ellipse, zombie: Phaser.Physics.Arcade.Sprite) {
    zombie.destroy(); // Remove the zombie
    this.score += 1; // Update the score

    // Check if the hole should grow
    if (this.score === 50 || this.score === 200) {
      this.hole.setScale(this.hole.scale + 0.5);
    }
  }

  update() {
    // Check for collisions and update score
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#87CEEB',
  scene: MainScene,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

new Phaser.Game(config);