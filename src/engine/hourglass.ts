import { familyColor, type Family } from '../lib/programs.ts'
import { PALETTE } from '../lib/palette.ts'

export type Grain = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  family: Family
  color: string
  sig: string | null
  born: number
}

export type TxSpec = {
  family: Family
  sig: string | null
}

const MAX_GRAINS = 380
const REST = 0.05
const FRICTION = 0.72
const GRAV = 1.85

/** Hourglass half-width in normalized y ∈ [-1, 1], 0 at the neck. */
export function glassHalfW(y: number): number {
  const ay = Math.min(1, Math.abs(y))
  if (ay < 0.048) return 0.036 + ay * 0.45
  const u = (ay - 0.048) / 0.952
  const bulb = Math.sin(Math.pow(u, 0.9) * Math.PI)
  return 0.055 + bulb * 0.36
}

export function spawnRateFromTps(tps: number | null): number {
  if (tps == null || !Number.isFinite(tps)) return 8
  const n = Math.max(0, Math.min(6000, tps))
  return 8 + n / 110
}

export class HourglassSim {
  grains: Grain[] = []
  frozen = false
  reduced = false
  tps: number | null = null
  private spawnAcc = 0
  private neckAcc = 0
  private rng = 0.37

  private rand(): number {
    this.rng = (this.rng * 16807 + 0.1) % 1
    return this.rng
  }

  seed(n = 170) {
    this.grains = []
    const families: Family[] = ['SYS', 'TKN', 'JUP', 'RAY', 'STK', '???']
    for (let i = 0; i < n; i++) {
      const family = families[i % families.length]!
      const y = -0.88 + this.rand() * 0.62
      const hw = Math.max(0.02, glassHalfW(y) - 0.025)
      const x = (this.rand() * 2 - 1) * hw
      this.grains.push(this.makeGrain(x, y, family, null))
    }
  }

  makeGrain(x: number, y: number, family: Family, sig: string | null): Grain {
    const r = 0.0072 + this.rand() * 0.0038
    return {
      x,
      y,
      vx: (this.rand() - 0.5) * 0.08,
      vy: this.rand() * 0.04,
      r,
      family,
      color: familyColor(family),
      sig,
      born: performance.now(),
    }
  }

  spawn(spec: TxSpec) {
    if (this.grains.length >= MAX_GRAINS) this.cull()
    const y = -0.78 - this.rand() * 0.08
    const hw = Math.max(0.04, glassHalfW(y) - 0.04)
    const x = (this.rand() * 2 - 1) * hw * 0.72
    this.grains.push(this.makeGrain(x, y, spec.family, spec.sig))
  }

  private cull() {
    let bestI = 0
    let bestY = -2
    for (let i = 0; i < this.grains.length; i++) {
      const g = this.grains[i]!
      if (g.y > bestY) {
        bestY = g.y
        bestI = i
      }
    }
    this.grains.splice(bestI, 1)
  }

  step(dt: number, pull: () => TxSpec | null) {
    const t = Math.min(0.033, dt)
    if (this.frozen) return
    if (this.reduced) {
      this.layoutStatic(pull)
      return
    }

    this.spawnAcc += spawnRateFromTps(this.tps) * t
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      const spec = pull() ?? { family: '???' as const, sig: null }
      this.spawn(spec)
    }

    const tps = this.tps ?? 1200
    this.neckAcc += (3.5 + Math.min(36, tps / 110)) * t
    for (const g of this.grains) {
      g.vy += GRAV * t
      if (g.y < -0.02 && g.y > -0.22) {
        g.vx += -g.x * 8 * t
      }
      const nextY = g.y + g.vy * t * 1.15
      if (g.y < -0.015 && nextY >= -0.015) {
        if (this.neckAcc >= 1) {
          this.neckAcc -= 1
        } else {
          g.vy = Math.min(g.vy, 0)
          g.y = Math.min(g.y, -0.03)
          g.vx *= 0.6
          g.x += g.vx * t * 18
          this.constrain(g)
          continue
        }
      }
      if (Math.abs(g.y) < 0.12) {
        g.vx += (this.rand() - 0.5) * 0.4 * t
        g.vx *= 0.9
      }
      g.x += g.vx * t * 18
      g.y += g.vy * t
      this.constrain(g)
    }
    this.collide()
  }

  /** Place grains as two piles — diagram, not a movie. */
  private layoutStatic(pull: () => TxSpec | null) {
    this.spawnAcc += spawnRateFromTps(this.tps) * 0.016
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      const spec = pull() ?? { family: '???' as const, sig: null }
      this.spawn(spec)
    }
    const n = this.grains.length
    const upper = Math.ceil(n * 0.55)
    for (let i = 0; i < n; i++) {
      const g = this.grains[i]!
      g.vx = 0
      g.vy = 0
      const inUpper = i < upper
      const k = inUpper ? i / Math.max(1, upper) : (i - upper) / Math.max(1, n - upper)
      const y = inUpper ? -0.78 + k * 0.55 : 0.28 + k * 0.55
      const hw = Math.max(0.05, glassHalfW(y) - 0.03)
      const row = Math.floor(k * 8)
      const col = i % 9
      g.y = y + (row % 2) * 0.004
      g.x = ((col - 4) / 5) * hw * 0.9
      this.constrain(g)
    }
  }

  private constrain(g: Grain) {
    const y = Math.max(-0.96, Math.min(0.96, g.y))
    g.y = y
    const hw = glassHalfW(y)
    const limit = hw - g.r * 0.92
    if (g.x > limit) {
      g.x = limit
      g.vx = Math.min(0, g.vx) * REST - 0.01
    } else if (g.x < -limit) {
      g.x = -limit
      g.vx = Math.max(0, g.vx) * REST + 0.01
    }
    if (g.y > 0.96 - g.r) {
      g.y = 0.96 - g.r
      g.vy *= -REST
      g.vx *= FRICTION
    }
    if (g.y < -0.96 + g.r) {
      g.y = -0.96 + g.r
      g.vy = Math.abs(g.vy) * REST
    }
  }

  private collide() {
    const list = this.grains
    const n = list.length
    const cell = 0.022
    const buckets = new Map<number, number[]>()
    const key = (ix: number, iy: number) => iy * 4096 + ix
    for (let i = 0; i < n; i++) {
      const g = list[i]!
      const ix = Math.floor(g.x / cell)
      const iy = Math.floor(g.y / cell)
      const k = key(ix, iy)
      const b = buckets.get(k)
      if (b) b.push(i)
      else buckets.set(k, [i])
    }
    const neigh = [-1, 0, 1]
    for (let i = 0; i < n; i++) {
      const a = list[i]!
      const ix = Math.floor(a.x / cell)
      const iy = Math.floor(a.y / cell)
      for (const dy of neigh) {
        for (const dx of neigh) {
          const bkt = buckets.get(key(ix + dx, iy + dy))
          if (!bkt) continue
          for (const j of bkt) {
            if (j <= i) continue
            const b = list[j]!
            const rx = b.x - a.x
            const ry = b.y - a.y
            const min = a.r + b.r
            const d2 = rx * rx + ry * ry
            if (d2 > min * min || d2 < 1e-10) continue
            const d = Math.sqrt(d2)
            const nx = rx / d
            const ny = ry / d
            const overlap = (min - d) * 0.5
            a.x -= nx * overlap
            a.y -= ny * overlap
            b.x += nx * overlap
            b.y += ny * overlap
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
            if (rv < 0) {
              const imp = rv * 0.5 * (1 + REST)
              a.vx += imp * nx
              a.vy += imp * ny
              b.vx -= imp * nx
              b.vy -= imp * ny
            }
            a.vx *= 0.995
            b.vx *= 0.995
          }
        }
      }
    }
  }
}

export type DrawHud = {
  frozen: boolean
  flip: number
}

export function drawHourglass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sim: HourglassSim,
  hud: DrawHud,
) {
  ctx.clearRect(0, 0, w, h)
  const cx = w * 0.5
  const cy = h * 0.5
  const gh = Math.min(w * 0.92, h * 0.86) * 0.5

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(hud.flip)

  drawStand(ctx, gh)
  drawFrame(ctx, gh)

  ctx.save()
  glassPath(ctx, gh)
  ctx.clip()
  ctx.fillStyle = 'rgba(22, 19, 16, 0.55)'
  ctx.fillRect(-gh, -gh * 1.05, gh * 2, gh * 2.1)
  drawGrains(ctx, sim, gh)
  ctx.restore()

  strokeGlass(ctx, gh)
  drawFerrules(ctx, gh)
  drawTicks(ctx, gh)

  ctx.restore()
}

function glassPath(ctx: CanvasRenderingContext2D, gh: number) {
  ctx.beginPath()
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const y = -1 + (i / steps) * 2
    const x = glassHalfW(y) * gh
    if (i === 0) ctx.moveTo(x, y * gh)
    else ctx.lineTo(x, y * gh)
  }
  for (let i = steps; i >= 0; i--) {
    const y = -1 + (i / steps) * 2
    const x = -glassHalfW(y) * gh
    ctx.lineTo(x, y * gh)
  }
  ctx.closePath()
}

function strokeGlass(ctx: CanvasRenderingContext2D, gh: number) {
  glassPath(ctx, gh)
  ctx.strokeStyle = PALETTE.celeste
  ctx.globalAlpha = 0.85
  ctx.lineWidth = Math.max(1.2, gh * 0.012)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.save()
  glassPath(ctx, gh)
  ctx.clip()
  ctx.beginPath()
  ctx.moveTo(-gh * 0.42, -gh * 0.9)
  ctx.quadraticCurveTo(-gh * 0.5, 0, -gh * 0.28, gh * 0.88)
  ctx.strokeStyle = 'rgba(228, 213, 184, 0.22)'
  ctx.lineWidth = gh * 0.018
  ctx.stroke()
  ctx.restore()
}

function drawGrains(ctx: CanvasRenderingContext2D, sim: HourglassSim, gh: number) {
  for (const g of sim.grains) {
    const x = g.x * gh
    const y = g.y * gh
    const r = Math.max(1.15, g.r * gh)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = g.color
    ctx.fill()
    ctx.fillStyle = 'rgba(228, 213, 184, 0.28)'
    ctx.beginPath()
    ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, gh: number) {
  const post = gh * 0.07
  const wood = PALETTE.oxide
  ctx.fillStyle = wood
  roundRect(ctx, -gh * 0.72, -gh * 1.08, gh * 1.44, post * 1.35, 3)
  ctx.fill()
  roundRect(ctx, -gh * 0.72, gh * 0.95, gh * 1.44, post * 1.35, 3)
  ctx.fill()
  roundRect(ctx, -gh * 0.7, -gh * 1.05, post * 0.85, gh * 2.1, 2)
  ctx.fill()
  roundRect(ctx, gh * 0.7 - post * 0.85, -gh * 1.05, post * 0.85, gh * 2.1, 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(201, 137, 58, 0.25)'
  ctx.lineWidth = 1
  for (let i = 0; i < 6; i++) {
    const y = -gh * 0.9 + i * gh * 0.36
    ctx.beginPath()
    ctx.moveTo(-gh * 0.7, y)
    ctx.lineTo(-gh * 0.7 + post * 0.85, y + post * 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(gh * 0.7, y)
    ctx.lineTo(gh * 0.7 - post * 0.85, y + post * 0.3)
    ctx.stroke()
  }

  ctx.fillStyle = PALETTE.brass
  const bolts = [
    [-gh * 0.62, -gh * 1.01],
    [gh * 0.62, -gh * 1.01],
    [-gh * 0.62, gh * 1.02],
    [gh * 0.62, gh * 1.02],
  ] as const
  for (const [bx, by] of bolts) {
    ctx.beginPath()
    ctx.arc(bx, by, gh * 0.028, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = PALETTE.soot
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(bx - gh * 0.016, by)
    ctx.lineTo(bx + gh * 0.016, by)
    ctx.stroke()
  }
}

function drawFerrules(ctx: CanvasRenderingContext2D, gh: number) {
  ctx.fillStyle = PALETTE.brass
  ctx.globalAlpha = 0.92
  ctx.fillRect(-gh * 0.12, -gh * 0.045, gh * 0.24, gh * 0.09)
  ctx.globalAlpha = 1
  ctx.strokeStyle = PALETTE.oxide
  ctx.lineWidth = 1
  ctx.strokeRect(-gh * 0.12, -gh * 0.045, gh * 0.24, gh * 0.09)
}

function drawTicks(ctx: CanvasRenderingContext2D, gh: number) {
  ctx.strokeStyle = PALETTE.celeste
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
  for (const y of [-0.7, -0.35, 0.35, 0.7]) {
    const hw = glassHalfW(y) * gh
    ctx.beginPath()
    ctx.moveTo(hw + gh * 0.04, y * gh)
    ctx.lineTo(hw + gh * 0.09, y * gh)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawStand(ctx: CanvasRenderingContext2D, gh: number) {
  ctx.fillStyle = '#241c16'
  roundRect(ctx, -gh * 0.82, gh * 1.12, gh * 1.64, gh * 0.08, 4)
  ctx.fill()
  ctx.fillStyle = PALETTE.brass
  ctx.globalAlpha = 0.4
  ctx.fillRect(-gh * 0.3, gh * 1.12, gh * 0.6, 2)
  ctx.globalAlpha = 1
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
