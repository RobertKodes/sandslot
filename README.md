# sandslot

Hourglass of the chain.

The bench is dark; the glass is the only lamp.
Sand is the chain’s recent memory — each grain a transaction, dyed by the program family that touched it.
The neck is a metronome: flow tracks recent TPS, not a chart.
Flip the glass to pin a sample (physics pauses, the grain set stays); flip again and the present resumes.
It should feel like a scientific instrument left on a workshop table, not a product.

Live: https://robertkodes.github.io/sandslot/

## How to read it

| Glass | Chain |
| --- | --- |
| Grain | A recent transaction |
| Dye / callsign | Program family (system, JUP, RAY, token, stake, unknown) |
| Fall through the neck | Live slot activity / approx TPS |
| Flip → **held** | Frozen sample: pause physics, keep that grain set, freeze the plate |
| Flip again | Resume the live feed |

Not an explorer. Not a wallet. Not a dossier. Browser talks JSON-RPC; sand falls.

## Palette

Named hex, workshop glass, six dyes:

| Token | Hex | Use |
| --- | --- | --- |
| **soot** | `#161310` | Bench void |
| **vellum** | `#E4D5B8` | Labels, mast, pale token grains |
| **ochre** | `#C4893A` | Warm sand, system grains, live digits |
| **celeste** | `#6E9AA3` | Cool glass rim, stake grains, kicker |
| **brass** | `#A9844A` | Fittings, flip plate, JUP grains |
| **oxide** | `#5C3A28` | Timber frame |

RAY rust (`#B45A32`) is ochre mixed toward oxide. Unknown ash (`#6B6358`) is vellum mixed into soot. Neither is a seventh brand color.

## Type

- **Newsreader** — journal optical serif on the nameplate. Not Inter, not a SaaS geometric.
- **Azeret Mono** — stamped HUD, callsigns, the flip legend.

## Tinkerer notes

```bash
npm i
npm run dev
```

Vite serves at `/sandslot/`. Open that path, not `/`.

```bash
npm run build
```

must pass. Static `dist/` is force-pushed to the `gh-pages` branch at root (`index.html`, `assets/`, `.nojekyll`). Repo Pages source should be **branch `gh-pages` / folder `/`**. If the live URL 404s: GitHub → Settings → Pages → source **`gh-pages` / root**.

Public RPC, rotating on failure (no API keys):

- `solana-rpc.publicnode.com`
- `api.mainnet-beta.solana.com`
- `solana.drpc.org`
- `rpc.ankr.com/solana`
- `solana.llamarpc.com`

Override with `VITE_RPC_URL`. Methods: `getSlot`, `getRecentPerformanceSamples`, rotating `getSignaturesForAddress` on a short program roster via `@solana/web3.js`. If RPC flakes, the glass keeps the last mix and the plate marks **degraded**.

`prefers-reduced-motion`: grains sit as a static diagram; slot / TPS / RTT still update until you flip.

Space or the brass plate flips the glass.
