import Phaser from "phaser"
import type { MainScene } from "../scenes/MainScene"
import type { HoleMode } from "./types"

export class NormalMode implements HoleMode {
  private overlay: Phaser.GameObjects.Image
  constructor(private scene: MainScene) {
    // Create overlay for normal mode
    this.overlay = this.scene.add.image(
      this.scene.hole.x,
      this.scene.hole.y,
      "bigHoleOverlay",
    )
    this.overlay.setOrigin(0.5, 0.5)
    this.overlay.setDisplaySize(this.scene.hole.width, this.scene.hole.height)
    this.overlay.setDepth(10)
    this.overlay.setVisible(false)
  }
  applyMode(): void {
    this.scene.hole.setVisible(true)
    this.overlay.setVisible(true)
    this.update()
  }
  resetMode(): void {
    this.overlay.setVisible(false)
  }
  update(): void {
    this.overlay.x = this.scene.hole.x
    this.overlay.y = this.scene.hole.y
    this.overlay.setDisplaySize(
      this.scene.hole.width * this.scene.hole.scaleX,
      this.scene.hole.height * this.scene.hole.scaleY,
    )
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

export class ShapeMode implements HoleMode {
  private graphics?: Phaser.GameObjects.Graphics
  private polygon!: Phaser.Geom.Polygon
  private relativePoints: Phaser.Math.Vector2[] = []
  private initialized: boolean = false
  constructor(private scene: MainScene) {}
  applyMode(): void {
    const cx = this.scene.hole.x
    const cy = this.scene.hole.y
    const baseRadius = (this.scene.hole.width * this.scene.hole.scaleX) / 2
    // On first activation, create a regular 12-sided polygon
    if (!this.initialized) {
      const sides = 12
      this.relativePoints = []
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2
        this.relativePoints.push(
          new Phaser.Math.Vector2(
            Math.cos(angle) * baseRadius,
            Math.sin(angle) * baseRadius,
          ),
        )
      }
      this.initialized = true
    }
    // Hide hole and overlay
    this.scene.hole.setVisible(false)
    // Create or reuse graphics
    if (!this.graphics) {
      this.graphics = this.scene.add.graphics({
        fillStyle: { color: 0x000000 },
      })
    }
    // Draw polygon
    this.update()
  }
  resetMode(): void {
    this.graphics?.destroy()
    this.graphics = undefined
  }
  update(): void {
    if (!this.graphics) return
    this.graphics.clear()
    const cx = this.scene.hole.x
    const cy = this.scene.hole.y
    // Draw using current relativePoints
    const absCoords: number[] = []
    this.relativePoints.forEach((p) => {
      absCoords.push(cx + p.x, cy + p.y)
    })
    this.polygon = new Phaser.Geom.Polygon(absCoords)
    this.graphics.fillPoints(this.polygon.points, true)
  }
  isInsideHole(zombie: Phaser.Physics.Arcade.Sprite): boolean {
    return Phaser.Geom.Polygon.Contains(this.polygon, zombie.x, zombie.y)
  }
  /** Grow a random vertex outward by given amount */
  growRandomNode(amount: number): void {
    if (this.relativePoints.length === 0) return
    const idx = Phaser.Math.Between(0, this.relativePoints.length - 1)
    const node = this.relativePoints[idx]
    const len = node.length()
    node.scale((len + amount) / len)
  }
}

export class ShaderMode implements HoleMode {
  private overlay: Phaser.GameObjects.Image
  constructor(private scene: MainScene) {
    // Create overlay for shader mode
    this.overlay = this.scene.add.image(
      this.scene.hole.x,
      this.scene.hole.y,
      "bigHoleOverlay",
    )
    this.overlay.setOrigin(0.5, 0.5)
    this.overlay.setDisplaySize(this.scene.hole.width, this.scene.hole.height)
    this.overlay.setDepth(10)
    this.overlay.setVisible(false)
  }
  applyMode(): void {
    this.scene.hole.setVisible(true)
    this.overlay.setVisible(true)
    // placeholder shader effect: continuous rotation
    this.scene.tweens.add({
      targets: this.overlay,
      angle: 360,
      duration: 2000,
      repeat: -1,
    })
  }
  resetMode(): void {
    this.scene.tweens.killTweensOf(this.overlay)
    this.overlay.setAngle(0)
    this.overlay.setVisible(false)
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
  update(): void {
    this.overlay.x = this.scene.hole.x
    this.overlay.y = this.scene.hole.y
    this.overlay.setDisplaySize(
      this.scene.hole.width * this.scene.hole.scaleX,
      this.scene.hole.height * this.scene.hole.scaleY,
    )
  }
}
