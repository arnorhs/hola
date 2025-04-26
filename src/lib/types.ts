export enum ModeType {
  Normal = "normal",
  Shape = "shape",
  Shader = "shader",
}

export interface HoleMode {
  applyMode(): void
  resetMode(): void
  isInsideHole(zombie: Phaser.Physics.Arcade.Sprite): boolean
  update?(): void
}
