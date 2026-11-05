# V4.1 Performance results

Measured locally on 2026-11-05 using Node/Vitest and Playwright Chromium against an isolated optimized Next build. These are single-host samples, not a hardware-independent SLA. All results below are measured rather than the prior suite's fabricated per-mesh GPU-memory estimates.

## Computation (fresh synthetic base modules)

| Modules | Components | Cut parts | Geometry ms | BOM + nesting ms | Pricing ms | Total ms | Mutation p50 / p95 ms |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 220 | 160 | 0.28 | 4.28 | 0.12 | 4.69 | 4.36 / 6.64 |
| 50 | 550 | 400 | 0.39 | 14.19 | 0.21 | 14.80 | 7.72 / 14.41 |

Ten successive first-module dimension mutations supply the small p50/p95 sample. BOM time includes nesting; there is no claim of a separate uncached nesting time here. Process heap snapshots include the whole test runner and are not module or GPU memory estimates.

## Browser (default master plus adjacent modules, full-scene fit)

| Modules | Meshes | Add interaction ms | CPU render submission ms | Draw calls | Triangles | Geometries / textures | Browser heap bytes |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 272 | 199 | 3.20 | 498 | 4994 | 13 / 7 | 37300000 |
| 50 | 632 | 123 | 3.60 | 1158 | 11474 | 13 / 7 | 37300000 |

The browser suite appends 49 modules through actual clicks, checks scene module counts and fits all meshes within the camera frustum. `browser-add-progress.json` contains each pure click/assertion duration; the older `lastAddMs` field in browser-performance.json also includes fit/screenshot overhead and must not be presented as pure add latency. Headless Chrome heap is coarse and cannot prove absence of leaks. `renderCpuMs` measures the CPU call to renderer.render, not GPU completion. The old suite's approximately 60 FPS is requestAnimationFrame cadence, not sustained scene render FPS, and is not a large-project acceptance result.

Repairs: shared unit box/sphere/cylinder geometry, shared cached materials, bounded 32-entry BOM/nesting caches, no selection-driven mesh rebuild, correct full-scene fit with camera clipping/distance adjustment, and reachable Add control outside the scrolling module list.

Remaining: 1,158 draw calls at 50 modules is high; ordinary edits still rebuild the scene, the manufacturing worker is an asynchronous client abstraction rather than a proven off-main-thread pipeline, and React render counts, GPU timer queries, true sustained moving-scene FPS, long-duration memory growth, initial-load percentiles and all tablet hardware have not been measured. Therefore performance is **PARTIALLY WORKING**, not universally accepted.

Evidence: [computation](v41-evidence/computation-performance.json), [browser](v41-evidence/browser-performance.json), [add interactions](v41-evidence/browser-add-progress.json). Reproduce with the V41 test commands in the Playwright report.
