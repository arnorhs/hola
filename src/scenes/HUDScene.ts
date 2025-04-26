import type { MainScene } from "./MainScene"

export class HUDScene extends Phaser.Scene {
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
