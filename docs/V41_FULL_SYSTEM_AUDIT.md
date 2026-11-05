# V4.1 Independent system audit

Baseline: 27e3938, clean main; isolated branch codex/v41-independent-audit. Audit date: 2026-11-05. No ERP/Store repository or remote database access. Baseline 66/66 unit tests pass; this does not establish browser or manufacturing acceptance.

## Initial inventory (before repairs)

| System | Implementation / entry point | Initial status | Independent finding / reproduction |
|---|---|---|---|
| Parametric core | packages/core/src/rules.ts, v4-profiles.ts | PARTIALLY WORKING | Geometry and four-space dimensions use separate formulas; validate across catalog. |
| Module library | packages/catalog/src/v4-module-taxonomy.ts, templates.ts | UNVERIFIED | 92 seeds; instantiate every seed and inspect bounds, geometry and BOM. |
| Carcass | geometry/src/mesh-generator.ts:generateModuleGeometry | PARTIALLY WORKING | Back/joint rules are generic; physical factory verification unavailable. |
| Doors | geometry/src/mesh-generator.ts | PARTIALLY WORKING | V3 viewport applies Y rotation only; lift X rotations ignored. Folding/pocket paths are representative. |
| Handles | geometry/src/mesh-generator.ts | BROKEN | Select bar/knob: no door_handle components exist. Drawers always generic box. |
| Opening technology | core/src/v4-compatibility.ts | PARTIALLY WORKING | Separate model exists; production claims exceed independently verified evidence. |
| Drawers | geometry/src/mesh-generator.ts; manufacturing/src/bom-generator.ts | BROKEN | Drawer material override ignored in BOM; dimensions/thickness and runner per drawer need review. |
| Internal fittings | mesh-generator.ts | PARTIALLY WORKING | Special fittings represented as shelf boxes. |
| Materials | apps/configurator/src/v3/materials/pbrMaterialSystem.ts | UNVERIFIED | Cached procedural materials; no measured physical texture validation. |
| 2D | geometry/src/projection2d.ts | PARTIALLY WORKING | Elevation uses hardcoded 18mm bay offsets and ignores rotations. |
| 3D | V3ThreeViewport.tsx; components/ThreeCanvas.tsx | BROKEN | Renderers duplicate door pivot interpretation; X rotations ignored. |
| Studio/Plan/Showroom | v3/components/V3UnifiedWorkspace.tsx | UNVERIFIED | Browser acceptance required; routes share workspace and adapter. |
| BOM | manufacturing/src/bom-generator.ts | BROKEN | Cache key omits shelf positions, drawer elevations, overrides and status; panel width used as thickness. |
| Drilling/CNC | manufacturing/src/drilling-engine.ts, selco-adapter.ts | PARTIALLY WORKING | Generic unverified handle holes; no verified complete production rules. |
| Nesting | manufacturing/src/sheet-nesting.ts | UNVERIFIED | Existing 2 tests insufficient for grain/overlap/bounds coverage. |
| Pricing | pricing/src/pricing-engine.ts | PARTIALLY WORKING | Depends on incorrect BOM inputs; catalog prices are estimates. |
| Persistence | store/useConfiguratorStore.ts | BROKEN | Save catches failure then returns success ID; load skips schema validation. |
| Revision/history | useConfiguratorStore.ts, useV3Adapter.ts | PARTIALLY WORKING | Direct adapter mutations bypass recomputation/history; approval not invalidated on edit. |
| Library administration | catalog/src/v4-library-admin.ts | UI ONLY | UI is read-only; draft records are metadata, no runtime custom template integration. Release SHA256 is fabricated. |
| Compatibility | core/src/v4-compatibility.ts | PARTIALLY WORKING | Generic rules; no independently verified handle mounting data. |
| API/security | integrations/src/*; tests/security-validation.test.ts | PARTIALLY WORKING | No backend API routes; adapters are local contracts. No external integration exercised. |
| Testing | tests; vitest.config.ts; playwright.config.ts | PARTIALLY WORKING | 66 baseline tests pass. Existing browser assertions emphasize labels, not scene/data consistency. |

Final evidence and residual limitations are recorded in the companion V41 reports. WORKING denotes only the specific behavior exercised by recorded tests; it never implies factory certification.

## Final validation status

87 unit/regression tests and 27 Chromium tests pass. The initial table is deliberately retained as the before-repair inventory. Fixed defects and their source/test mapping are recorded in V41_FIX_REPORT.md; the final system acceptance is PARTIAL, with exact residual items in V41_ACCEPTANCE_REPORT.md and V41_BUG_REGISTER.md.

WORKING within tested scope: handle selection/render binding/persistence, ordinary hinged transforms, explicit save/load and failure reporting, corrected BOM dimensions/cache/material mapping, tested nesting invariants, ordinary UI operations, mode transitions and 20/50 module add/fit scenarios.

PARTIALLY WORKING: overall parametric/product catalog, 2D projections, advanced door systems, internal fittings, kitchen layout/geometry, materials, performance and revision handling. UI ONLY: full library authoring interface (read-only listing). NOT IMPLEMENTED: complete multi-selection/bulk-edit workflow, user-authored runtime geometry/rule editor and content release rollback. UNVERIFIED: factory/manufacturer machining, full hardware kinematics, true physical texture scale, all-device performance, production postprocessor and external integration operation. No full system or production acceptance is claimed.
