import { Connection, type ConfirmedSignatureInfo, type PublicKey } from '@solana/web3.js'

const DEFAULTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://solana.drpc.org',
  'https://rpc.ankr.com/solana',
  'https://solana.llamarpc.com',
]

export function rpcEndpoints(): string[] {
  const extra = import.meta.env.VITE_RPC_URL
  const list = extra && extra.startsWith('http') ? [extra, ...DEFAULTS] : DEFAULTS
  return [...new Set(list)]
}

export class RpcPool {
  endpoints: string[]
  index = 0
  private conns: Connection[]

  constructor(endpoints: string[]) {
    this.endpoints = endpoints.length ? endpoints : DEFAULTS
    this.conns = this.endpoints.map(
      (url) =>
        new Connection(url, {
          commitment: 'confirmed',
          disableRetryOnRateLimit: true,
          confirmTransactionInitialTimeout: 8000,
        }),
    )
  }

  get url(): string {
    return this.endpoints[this.index % this.endpoints.length]!
  }

  get host(): string {
    try {
      return new URL(this.url).host.replace(/^www\./, '')
    } catch {
      return 'rpc'
    }
  }

  rotate(): string {
    this.index = (this.index + 1) % this.endpoints.length
    return this.url
  }

  private conn(): Connection {
    return this.conns[this.index % this.conns.length]!
  }

  async withRetry<T>(fn: (c: Connection) => Promise<T>): Promise<{ value: T; rttMs: number }> {
    let last: unknown
    for (let i = 0; i < this.endpoints.length; i++) {
      const t0 = performance.now()
      try {
        const value = await fn(this.conn())
        return { value, rttMs: performance.now() - t0 }
      } catch (err) {
        last = err
        this.rotate()
      }
    }
    throw last instanceof Error ? last : new Error('all rpc endpoints failed')
  }

  getSlot() {
    return this.withRetry((c) => c.getSlot('confirmed'))
  }

  getPerf() {
    return this.withRetry((c) => c.getRecentPerformanceSamples(4))
  }

  getSigs(address: PublicKey, limit = 16) {
    return this.withRetry((c) => c.getSignaturesForAddress(address, { limit }))
  }
}

export function sampleTps(
  samples: { samplePeriodSecs: number; numTransactions: number; numNonVoteTransactions?: number }[],
): number | null {
  const s = samples[0]
  if (!s || s.samplePeriodSecs <= 0) return null
  const tx = s.numNonVoteTransactions ?? s.numTransactions
  return tx / s.samplePeriodSecs
}

export type SigInfo = ConfirmedSignatureInfo
