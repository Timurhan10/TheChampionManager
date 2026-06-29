// The Champion Manager — Phaser.js 2D maç sahnesi
// Bu modül YALNIZCA client'ta dinamik import edilmelidir (Phaser window'a bağlıdır).

import Phaser from "phaser";

const W = 800;
const H = 600;

// 4-3-3 benzeri sabit yerleşim (ev sahibi alt yarı, deplasman üst yarı)
const HOME_POS: [number, number][] = [
  [400, 545], // GK
  [140, 460], [300, 470], [500, 470], [660, 460], // DF
  [220, 385], [400, 380], [580, 385], // MF
  [260, 320], [400, 315], [540, 320], // FW
];
const AWAY_POS: [number, number][] = [
  [400, 55], // GK
  [140, 140], [300, 130], [500, 130], [660, 140], // DF
  [220, 215], [400, 220], [580, 215], // MF
  [260, 280], [400, 285], [540, 280], // FW
];

export interface MatchController {
  setScore: (home: number, away: number) => void;
  setClock: (minute: number, label?: string) => void;
  goal: (team: "home" | "away") => void;
  card: (team: "home" | "away", color: "yellow" | "red") => void;
  destroy: () => void;
}

class MatchScene extends Phaser.Scene {
  homeColor = 0x3b82f6;
  awayColor = 0xef4444;
  ball!: Phaser.GameObjects.Arc;
  homeDots: Phaser.GameObjects.Arc[] = [];
  awayDots: Phaser.GameObjects.Arc[] = [];
  scoreText!: Phaser.GameObjects.Text;
  clockText!: Phaser.GameObjects.Text;

  constructor() {
    super("match");
  }

  init(data: { homeColor?: number; awayColor?: number }) {
    if (data.homeColor) this.homeColor = data.homeColor;
    if (data.awayColor) this.awayColor = data.awayColor;
  }

  create() {
    // Saha
    this.add.rectangle(W / 2, H / 2, W, H, 0x0f3d2a);
    for (let i = 0; i < H; i += 72) {
      this.add.rectangle(W / 2, i + 36, W, 36, 0x0d3525).setAlpha(i % 144 === 0 ? 0.5 : 0);
    }
    const line = 0xffffff;
    const g = this.add.graphics({ lineStyle: { width: 2, color: line, alpha: 0.25 } });
    g.strokeRect(20, 20, W - 40, H - 40);
    g.lineBetween(20, H / 2, W - 20, H / 2);
    g.strokeCircle(W / 2, H / 2, 60);
    // Ceza alanları
    g.strokeRect(W / 2 - 110, 20, 220, 80);
    g.strokeRect(W / 2 - 110, H - 100, 220, 80);

    // Oyuncular
    HOME_POS.forEach(([x, y]) => {
      const dot = this.add.circle(x, y, 11, this.homeColor).setStrokeStyle(2, 0xffffff, 0.6);
      this.homeDots.push(dot);
      this.idle(dot, x, y);
    });
    AWAY_POS.forEach(([x, y]) => {
      const dot = this.add.circle(x, y, 11, this.awayColor).setStrokeStyle(2, 0xffffff, 0.6);
      this.awayDots.push(dot);
      this.idle(dot, x, y);
    });

    // Top
    this.ball = this.add.circle(W / 2, H / 2, 7, 0xffffff).setStrokeStyle(1, 0x000000, 0.3);
    this.idleBall();

    // Skor + saat üst overlay
    this.scoreText = this.add.text(W / 2, 28, "0 - 0", { fontFamily: "monospace", fontSize: "26px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.clockText = this.add.text(W / 2, 56, "0'", { fontFamily: "monospace", fontSize: "14px", color: "#cbd5e1" }).setOrigin(0.5);
  }

  idle(dot: Phaser.GameObjects.Arc, baseX: number, baseY: number) {
    this.tweens.add({
      targets: dot,
      x: baseX + Phaser.Math.Between(-14, 14),
      y: baseY + Phaser.Math.Between(-14, 14),
      duration: Phaser.Math.Between(900, 1600),
      yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }

  idleBall() {
    this.tweens.add({
      targets: this.ball,
      x: W / 2 + Phaser.Math.Between(-80, 80),
      y: H / 2 + Phaser.Math.Between(-60, 60),
      duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }

  setScore(home: number, away: number) {
    this.scoreText?.setText(`${home} - ${away}`);
  }

  setClock(minute: number, label?: string) {
    this.clockText?.setText(label ? `${minute}' ${label}` : `${minute}'`);
  }

  goal(team: "home" | "away") {
    // Top hızla rakip kaleye + flash
    const targetY = team === "home" ? 40 : H - 40;
    this.tweens.killTweensOf(this.ball);
    this.tweens.add({
      targets: this.ball, x: W / 2, y: targetY, duration: 350, ease: "Cubic.easeIn",
      onComplete: () => {
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setAlpha(0.6);
        this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
        // Konfeti
        for (let i = 0; i < 24; i++) {
          const c = this.add.circle(W / 2, targetY, 4, Phaser.Display.Color.RandomRGB().color);
          this.tweens.add({
            targets: c, x: W / 2 + Phaser.Math.Between(-200, 200), y: targetY + Phaser.Math.Between(-120, 120),
            alpha: 0, duration: 900, onComplete: () => c.destroy(),
          });
        }
        this.time.delayedCall(700, () => { this.ball.setPosition(W / 2, H / 2); this.idleBall(); });
      },
    });
  }

  card(team: "home" | "away", color: "yellow" | "red") {
    const y = team === "home" ? H - 120 : 120;
    const rect = this.add.rectangle(W / 2, y, 16, 22, color === "yellow" ? 0xf59e0b : 0xef4444).setStrokeStyle(1, 0xffffff);
    rect.setScale(0);
    this.tweens.add({ targets: rect, scale: 1.4, duration: 250, yoyo: true, hold: 600, onComplete: () => rect.destroy() });
  }
}

export function createMatchGame(
  parent: HTMLElement,
  opts: { homeColor?: number; awayColor?: number }
): MatchController {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent,
    backgroundColor: "#0C1524",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: MatchScene,
  });

  game.scene.start("match", opts);

  function scene(): MatchScene | null {
    return (game.scene.getScene("match") as MatchScene) ?? null;
  }

  return {
    setScore: (h, a) => scene()?.setScore(h, a),
    setClock: (m, l) => scene()?.setClock(m, l),
    goal: (t) => scene()?.goal(t),
    card: (t, c) => scene()?.card(t, c),
    destroy: () => game.destroy(true),
  };
}
