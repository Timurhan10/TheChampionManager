// The Champion Manager — Phaser.js 2D maç sahnesi (YATAY saha)
// Bu modül YALNIZCA client'ta dinamik import edilmelidir (Phaser window'a bağlıdır).
//
// Kaleler solda (x=0) ve sağda (x=W). Ev sahibi SOL yarıda başlar, sağa hücum eder.
// İki mod: ambient (motorsuz süs akışı — eski replay'ler) ve driven (motor pozisyonları).

import Phaser from "phaser";

const W = 960;
const H = 600;

// Yatay taban yerleşim (4-3-3 benzeri): ev sahibi sol yarı, deplasman sağ yarı.
const HOME_POS: [number, number][] = [
  [60, 300], // GK
  [170, 100], [160, 240], [160, 360], [170, 500], // DF
  [290, 160], [285, 300], [290, 440], // MF
  [400, 140], [410, 300], [400, 460], // FW
];
const AWAY_POS: [number, number][] = [
  [900, 300], // GK
  [790, 500], [800, 360], [800, 240], [790, 100], // DF
  [670, 440], [675, 300], [670, 160], // MF
  [560, 460], [550, 300], [560, 140], // FW
];

export interface MatchController {
  setScore: (home: number, away: number) => void;
  setClock: (minute: number, label?: string) => void;
  goal: (team: "home" | "away") => void;
  card: (team: "home" | "away", color: "yellow" | "red") => void;
  // Motor-güdümlü mod: normalize [0,1] pozisyonlar (x=uzunluk, ev sahibi solda)
  setPositions: (home: { x: number; y: number }[], away: { x: number; y: number }[]) => void;
  setBall: (x: number, y: number) => void;
  trigger: (kind: "goal" | "save" | "shot" | "tackle", team: "home" | "away") => void;
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

  // Ambient akış durumu
  possession: "home" | "away" = "home";
  ballTargetX = W / 2;
  ballTargetY = H / 2;
  ballControlled = false;
  passAccum = 0;
  passInterval = 800;

  // Motor-güdümlü mod
  driven = false;
  homeTarget: [number, number][] = [];
  awayTarget: [number, number][] = [];

  constructor() {
    super("match");
  }

  init(data: { homeColor?: number; awayColor?: number }) {
    if (data.homeColor) this.homeColor = data.homeColor;
    if (data.awayColor) this.awayColor = data.awayColor;
  }

  create() {
    // Saha (yatay şeritler dikey bantlar halinde)
    this.add.rectangle(W / 2, H / 2, W, H, 0x0f3d2a);
    for (let i = 0; i < W; i += 96) {
      this.add.rectangle(i + 48, H / 2, 48, H, 0x0d3525).setAlpha(i % 192 === 0 ? 0.5 : 0);
    }
    const line = 0xffffff;
    const g = this.add.graphics({ lineStyle: { width: 2, color: line, alpha: 0.25 } });
    g.strokeRect(20, 20, W - 40, H - 40);
    g.lineBetween(W / 2, 20, W / 2, H - 20);        // orta çizgi (dikey)
    g.strokeCircle(W / 2, H / 2, 62);
    // Ceza sahaları (sol/sağ)
    g.strokeRect(20, H / 2 - 115, 105, 230);
    g.strokeRect(W - 125, H / 2 - 115, 105, 230);
    // Kale ağızları
    g.strokeRect(12, H / 2 - 46, 8, 92);
    g.strokeRect(W - 20, H / 2 - 46, 8, 92);

    // Oyuncular
    HOME_POS.forEach(([x, y]) => {
      const dot = this.add.circle(x, y, 11, this.homeColor).setStrokeStyle(2, 0xffffff, 0.6);
      this.homeDots.push(dot);
    });
    AWAY_POS.forEach(([x, y]) => {
      const dot = this.add.circle(x, y, 11, this.awayColor).setStrokeStyle(2, 0xffffff, 0.6);
      this.awayDots.push(dot);
    });

    // Top
    this.ball = this.add.circle(W / 2, H / 2, 7, 0xffffff).setStrokeStyle(1, 0x000000, 0.3);

    // Skor + saat üst overlay
    this.scoreText = this.add.text(W / 2, 28, "0 - 0", { fontFamily: "monospace", fontSize: "26px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.clockText = this.add.text(W / 2, 56, "0'", { fontFamily: "monospace", fontSize: "14px", color: "#cbd5e1" }).setOrigin(0.5);

    this.pickBallTarget();
  }

  // Ambient: topun yeni hedefi — topu tutan takımın bir oyuncusuna doğru (hücum yönüne nudge'lı).
  pickBallTarget() {
    const dots = this.possession === "home" ? this.homeDots : this.awayDots;
    const idx = Math.random() < 0.6 ? Phaser.Math.Between(5, dots.length - 1) : Phaser.Math.Between(1, dots.length - 1);
    const p = dots[idx] ?? dots[0];
    const attackDir = this.possession === "home" ? 1 : -1; // ev sahibi sağa
    this.ballTargetX = Phaser.Math.Clamp(p.x + attackDir * Phaser.Math.Between(0, 80) + Phaser.Math.Between(-30, 30), 55, W - 55);
    this.ballTargetY = Phaser.Math.Clamp(p.y + Phaser.Math.Between(-40, 40), 40, H - 40);
  }

  update(_time: number, delta: number) {
    if (this.driven) { this.driveUpdate(delta); return; }
    if (!this.ballControlled) {
      const kb = Math.min(1, (delta / 1000) * 3.2);
      this.ball.x += (this.ballTargetX - this.ball.x) * kb;
      this.ball.y += (this.ballTargetY - this.ball.y) * kb;

      this.passAccum += delta;
      if (this.passAccum >= this.passInterval) {
        this.passAccum = 0;
        this.passInterval = Phaser.Math.Between(550, 1100);
        if (Math.random() < 0.22) this.possession = this.possession === "home" ? "away" : "home";
        this.pickBallTarget();
      }
    }

    this.moveTeam(this.homeDots, HOME_POS, this.possession === "home", 1, delta);
    this.moveTeam(this.awayDots, AWAY_POS, this.possession === "away", -1, delta);
  }

  // Ambient: bir takımın oyuncularını taban pozisyon + topa çekim ile hareket ettirir.
  moveTeam(
    dots: Phaser.GameObjects.Arc[],
    base: [number, number][],
    attacking: boolean,
    attackDir: number,
    delta: number,
  ) {
    let closest = -1, cd = Infinity;
    for (let i = 1; i < dots.length; i++) {
      const dx = dots[i].x - this.ball.x, dy = dots[i].y - this.ball.y;
      const d = dx * dx + dy * dy;
      if (d < cd) { cd = d; closest = i; }
    }
    const k = Math.min(1, (delta / 1000) * 2.2);
    for (let i = 0; i < dots.length; i++) {
      const [bx, by] = base[i];
      let tx = bx, ty = by;
      if (i === 0) {
        ty = by + (this.ball.y - by) * 0.05; // kaleci genişlikte kayar
      } else {
        const pull = i === closest ? 0.62 : 0.15;
        tx = bx + (this.ball.x - bx) * pull;
        ty = by + (this.ball.y - by) * pull;
        if (attacking) tx += attackDir * 20; // hücumda hattı ileri taşı
      }
      tx = Phaser.Math.Clamp(tx, 30, W - 30);
      ty = Phaser.Math.Clamp(ty, 28, H - 28);
      dots[i].x += (tx - dots[i].x) * k;
      dots[i].y += (ty - dots[i].y) * k;
    }
  }

  setScore(home: number, away: number) {
    this.scoreText?.setText(`${home} - ${away}`);
  }

  setClock(minute: number, label?: string) {
    this.clockText?.setText(label ? `${minute}' ${label}` : `${minute}'`);
  }

  goal(team: "home" | "away") {
    // Ambient gol: top hızla rakip kaleye + flash. (Driven modda trigger('goal') kullanılır.)
    this.ballControlled = true;
    const targetX = team === "home" ? W - 36 : 36;
    this.tweens.killTweensOf(this.ball);
    this.tweens.add({
      targets: this.ball, x: targetX, y: H / 2, duration: 350, ease: "Cubic.easeIn",
      onComplete: () => {
        this.celebrate(team);
        this.time.delayedCall(700, () => {
          this.ball.setPosition(W / 2, H / 2);
          this.ballTargetX = W / 2; this.ballTargetY = H / 2;
          this.passAccum = 0;
          this.ballControlled = false;
        });
      },
    });
  }

  card(team: "home" | "away", color: "yellow" | "red") {
    const x = team === "home" ? W * 0.3 : W * 0.7;
    const rect = this.add.rectangle(x, H / 2, 16, 22, color === "yellow" ? 0xf59e0b : 0xef4444).setStrokeStyle(1, 0xffffff);
    rect.setScale(0);
    this.tweens.add({ targets: rect, scale: 1.4, duration: 250, yoyo: true, hold: 600, onComplete: () => rect.destroy() });
  }

  // --- Motor-güdümlü mod ---
  setPositions(home: { x: number; y: number }[], away: { x: number; y: number }[]) {
    this.driven = true;
    this.homeTarget = home.map((p) => [p.x * W, p.y * H]);
    this.awayTarget = away.map((p) => [p.x * W, p.y * H]);
  }

  setBall(x: number, y: number) {
    this.ballTargetX = x * W;
    this.ballTargetY = y * H;
  }

  driveUpdate(delta: number) {
    const kp = Math.min(1, (delta / 1000) * 9);
    for (let i = 0; i < this.homeDots.length; i++) {
      const t = this.homeTarget[i]; if (!t) { this.homeDots[i].setVisible(false); continue; }
      this.homeDots[i].setVisible(true);
      this.homeDots[i].x += (t[0] - this.homeDots[i].x) * kp;
      this.homeDots[i].y += (t[1] - this.homeDots[i].y) * kp;
    }
    for (let i = 0; i < this.awayDots.length; i++) {
      const t = this.awayTarget[i]; if (!t) { this.awayDots[i].setVisible(false); continue; }
      this.awayDots[i].setVisible(true);
      this.awayDots[i].x += (t[0] - this.awayDots[i].x) * kp;
      this.awayDots[i].y += (t[1] - this.awayDots[i].y) * kp;
    }
    const kb = Math.min(1, (delta / 1000) * 13);
    this.ball.x += (this.ballTargetX - this.ball.x) * kb;
    this.ball.y += (this.ballTargetY - this.ball.y) * kb;
  }

  trigger(kind: "goal" | "save" | "shot" | "tackle", team: "home" | "away") {
    if (kind === "goal") { this.celebrate(team); return; }
    if (kind === "save") {
      // Kurtaran takımın kalesi: ev sahibi solda korur
      const x = team === "home" ? 44 : W - 44;
      const f = this.add.circle(x, H / 2, 30, 0x38bdf8).setAlpha(0.5);
      this.tweens.add({ targets: f, alpha: 0, scale: 1.6, duration: 400, onComplete: () => f.destroy() });
    } else if (kind === "tackle") {
      const f = this.add.circle(this.ball.x, this.ball.y, 12, 0xf59e0b).setAlpha(0.6);
      this.tweens.add({ targets: f, alpha: 0, scale: 1.8, duration: 350, onComplete: () => f.destroy() });
    }
  }

  celebrate(team: "home" | "away") {
    const targetX = team === "home" ? W - 40 : 40;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff).setAlpha(0.55);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    for (let i = 0; i < 24; i++) {
      const c = this.add.circle(targetX, H / 2, 4, Phaser.Display.Color.RandomRGB().color);
      this.tweens.add({ targets: c, x: targetX + Phaser.Math.Between(-120, 120), y: H / 2 + Phaser.Math.Between(-200, 200), alpha: 0, duration: 900, onComplete: () => c.destroy() });
    }
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
    setPositions: (h, a) => scene()?.setPositions(h, a),
    setBall: (x, y) => scene()?.setBall(x, y),
    trigger: (k, t) => scene()?.trigger(k, t),
    destroy: () => game.destroy(true),
  };
}
