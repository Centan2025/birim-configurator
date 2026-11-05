# V4.1 Playwright report

Final full run: **27 passed, 0 failed, 0 skipped, 0 flaky**, approximately 120 seconds. Unit/regression run: **87 passed, 0 failed**. TypeScript validation and the optimized build passed. The final subsequent save-dialog visual correction is separately checked by the targeted tablet storage-error test.

## Reproduce without disrupting port 3300

PowerShell, from the Configurator root:

```powershell
npm test
npm run lint
$env:BIRIM_AUDIT_BUILD='1'
npm run build
npm run test:e2e:v41
```

`playwright.v41.config.ts` starts the isolated `.next-v41` optimized output at localhost:3311 and refuses to reuse another server. The regular development port is 3300. Existing browser tests now honor configured baseURL instead of hardcoding that port. No deployment is performed. Artifacts appear under `test-results`; a compact permanent subset is retained in `docs/v41-evidence`.

## Exercised flows

- V2 load and WebGL; 3D/elevation/plan/section switching; numeric dimensions/sliders; bays/shelves/drawers/rails; add/duplicate/move; cut list/nesting modal; actual local storage save/reload; linear/L/U presets.
- V2 simple/technical modes, preset steppers, keyboard shortcuts and collapsible panels.
- V3 Studio/Plan/Showroom desktop/tablet flows; persistent canvas across modes, undo, direct numeric/shelf/bay edits, obstacles, kitchen corner coordinates and material showcase.
- V4 catalog browsing, complementary generation, smart-wall layout, interior wizard, incompatible handle/opening checks, hardware pricing and read-only library inspection.
- New V41 actual mesh category/parent/transform checks for ten handles, open/closed screenshots, selected state saved to JSON then reloaded, undo/redo, nine motion systems, three material selections saved to both drawer/front configuration and rendered mesh IDs, price changes, actual drawer translation, 20/50-module append/fit/renderer telemetry, tablet selection and quota-error feedback.

Diagnostics are opt-in via `?audit=1`: they serialize actual Three mesh transforms and render counters. The production model is not replaced with a test fixture. Tests do not inject design state through a hidden store. Computational checks separately validate BOM/geometry consistency; a DOM label is not used as the only evidence.

## Failures discovered during the audit

The first full run passed 23/27. It exposed a legacy wardrobe template-limit regression, incorrect external drawer handle defaults, and an Add control overlapped by the door toggle as the module list grew. Those defects were repaired and the full 27-test run passed. The initial diagnostics attempts against port 3300 were invalidated by development/build server interference; all acceptance evidence uses the isolated port/build.

## Visual evidence

The screenshots are reproducible candidate references, not a completed portable pixel-diff approval process. Camera/theme are fixed within each tested scenario and handle closed/open captures use the same camera. Material scenario captures use the same module and view. Different module scenarios intentionally use different fitted dimensions. Selected images were visually inspected for visible handles, drawer travel, glass, kitchen layout, tablet errors and full-scene fit. Factory accuracy is separately unverified.

[Evidence index](v41-evidence/README.md) and [test summary](v41-evidence/test-summary.json). Advanced door paths and kitchen collisions may be visible in candidate images; they have not been disguised as accepted manufacturer geometry.
