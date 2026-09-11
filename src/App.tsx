import { useCallback, useEffect, useRef, useState } from 'react'
import { drawHourglass, HourglassSim } from './engine/hourglass.ts'
import { useChainPulse } from './hooks/useChainPulse.ts'
import { FAMILIES, familyColor, familyLabel, type Family } from './lib/programs.ts'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<HourglassSim | null>(null)
  if (!simRef.current) {
    const sim = new HourglassSim()
    sim.seed(96)
    simRef.current = sim
  }

  const reduced = usePrefersReducedMotion()
  const [frozen, setFrozen] = useState(false)
  const [flip, setFlip] = useState(0)
  const frozenRef = useRef(false)
  const flipRef = useRef(0)
  const targetFlip = useRef(0)
  const reducedRef = useRef(reduced)
  frozenRef.current = frozen
  reducedRef.current = reduced

  const { hud, pull } = useChainPulse(frozen)
  const pullRef = useRef(pull)
  pullRef.current = pull
  const tpsRef = useRef(hud.tps)
  tpsRef.current = hud.tps

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    const sim = simRef.current!
    let raf = 0
    let last = performance.now()

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const goal = targetFlip.current
      if (reducedRef.current) {
        flipRef.current = goal
      } else {
        const k = 1 - Math.pow(0.0008, dt)
        flipRef.current += (goal - flipRef.current) * k
        if (Math.abs(goal - flipRef.current) < 0.002) flipRef.current = goal
      }
      sim.frozen = frozenRef.current
      sim.reduced = reducedRef.current
      sim.tps = tpsRef.current
      sim.step(dt, () => pullRef.current())
      const rect = canvas.getBoundingClientRect()
      drawHourglass(ctx, rect.width, rect.height, sim, {
        frozen: frozenRef.current,
        flip: flipRef.current,
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const flipGlass = useCallback(() => {
    const next = !frozenRef.current
    setFrozen(next)
    const goal = next ? Math.PI : 0
    targetFlip.current = goal
    setFlip(goal)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        flipGlass()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipGlass])

  const slot = hud.slot != null ? hud.slot.toLocaleString('en-US') : '—'
  const tps = hud.tps != null ? Math.round(hud.tps).toLocaleString('en-US') : '—'
  const rtt = hud.rttMs != null ? `${Math.round(hud.rttMs)}` : '—'

  return (
    <div className="bench">
      <header className="plate">
        <div className="mast">
          <p className="kicker">bench instrument · mainnet</p>
          <h1>Sandslot</h1>
          <p className="lede">the chain, as an hourglass</p>
        </div>
        <button
          type="button"
          className={frozen ? 'flip held' : 'flip'}
          onClick={flipGlass}
          aria-pressed={frozen}
          aria-label={frozen ? 'Resume live feed' : 'Flip glass to freeze sample'}
        >
          <span className="flip-knob" data-flip={flip > 1 ? '1' : '0'} />
          <span className="flip-label">{frozen ? 'held' : 'flip'}</span>
        </button>
      </header>

      <main className="stage">
        <canvas ref={canvasRef} className="glass" role="img" aria-label="Hourglass of recent Solana transactions" />
      </main>

      <footer className="hud">
        <Readout k="slot" v={slot} live={hud.live && !frozen} />
        <Readout k="tps" v={tps} live={hud.live && !frozen} />
        <Readout k="rtt" v={rtt} unit="ms" live={hud.live && !frozen} />
        <Readout k="rpc" v={hud.degraded ? 'degraded' : hud.host} live={hud.live && !frozen} />
        <ol className="legend">
          {FAMILIES.map((f) => (
            <li key={f}>
              <i style={{ background: familyColor(f as Family) }} />
              {familyLabel(f as Family)}
            </li>
          ))}
        </ol>
      </footer>
    </div>
  )
}

function Readout({
  k,
  v,
  unit,
  live,
}: {
  k: string
  v: string
  unit?: string
  live: boolean
}) {
  return (
    <div className={live ? 'read live' : 'read'}>
      <span className="k">{k}</span>
      <span className="v">
        {v}
        {unit ? <em>{unit}</em> : null}
      </span>
    </div>
  )
}
