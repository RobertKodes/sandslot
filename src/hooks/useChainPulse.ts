import { useEffect, useRef, useState } from 'react'
import { type Family, WATCH } from '../lib/programs.ts'
import { RpcPool, rpcEndpoints, sampleTps, type SigInfo } from '../lib/rpc.ts'
import type { TxSpec } from '../engine/hourglass.ts'

export type PulseHud = {
  slot: number | null
  tps: number | null
  rttMs: number | null
  host: string
  degraded: boolean
  live: boolean
}

const EMPTY: PulseHud = {
  slot: null,
  tps: null,
  rttMs: null,
  host: '—',
  degraded: false,
  live: false,
}

export function useChainPulse(paused: boolean) {
  const [hud, setHud] = useState<PulseHud>(EMPTY)
  const queueRef = useRef<TxSpec[]>([])
  const seenRef = useRef(new Set<string>())
  const mixRef = useRef<Family[]>(['SYS', 'TKN', '???'])
  const poolRef = useRef<RpcPool | null>(null)
  if (!poolRef.current) poolRef.current = new RpcPool(rpcEndpoints())

  useEffect(() => {
    if (paused) return
    const pool = poolRef.current!
    const ac = new AbortController()
    let watchAt = 0
    let lastSlot = -1e12
    let lastPerf = -1e12
    let lastSig = -1e12
    let fails = 0

    const tick = async () => {
      if (ac.signal.aborted) return
      const now = performance.now()
      try {
        if (now - lastSlot > 450) {
          lastSlot = now
          const { value: slot, rttMs } = await pool.getSlot()
          if (ac.signal.aborted) return
          fails = 0
          setHud((h) => ({
            ...h,
            slot,
            rttMs,
            host: pool.host,
            degraded: false,
            live: true,
          }))
        }
        if (now - lastPerf > 8000) {
          lastPerf = now
          const { value: samples, rttMs } = await pool.getPerf()
          if (ac.signal.aborted) return
          const tps = sampleTps(samples)
          setHud((h) => ({
            ...h,
            tps,
            rttMs: h.rttMs ?? rttMs,
            host: pool.host,
            live: true,
            degraded: false,
          }))
        }
        if (now - lastSig > 2200) {
          lastSig = now
          const watch = WATCH[watchAt % WATCH.length]!
          watchAt += 1
          const { value: sigs } = await pool.getSigs(watch.key, 14)
          if (ac.signal.aborted) return
          ingest(sigs, watch.family)
        }
      } catch {
        fails += 1
        if (fails >= 2) {
          setHud((h) => ({ ...h, degraded: true, live: false }))
        }
      }
    }

    const ingest = (sigs: SigInfo[], family: Family) => {
      const seen = seenRef.current
      const fresh: TxSpec[] = []
      for (const s of sigs) {
        if (seen.has(s.signature)) continue
        seen.add(s.signature)
        fresh.push({ family, sig: s.signature })
      }
      if (fresh.length) {
        mixRef.current = [...mixRef.current.slice(-24), ...fresh.map((f) => f.family)]
        queueRef.current.push(...fresh.reverse())
        if (queueRef.current.length > 80) {
          queueRef.current.splice(0, queueRef.current.length - 80)
        }
        if (seen.size > 400) {
          const keep = [...seen].slice(-200)
          seenRef.current = new Set(keep)
        }
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 280)
    return () => {
      ac.abort()
      window.clearInterval(id)
    }
  }, [paused])

  const pull = (): TxSpec | null => {
    const q = queueRef.current
    if (q.length) return q.shift() ?? null
    const mix = mixRef.current
    const family = mix[Math.floor(Math.random() * mix.length)] ?? '???'
    return { family, sig: null }
  }

  return { hud, pull }
}
