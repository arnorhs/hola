import Phaser from "phaser"
import { MainScene } from "./scenes/MainScene"
import { HUDScene } from "./scenes/HUDScene"

// Hole mode system
// New HUD scene that overlays the score
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
