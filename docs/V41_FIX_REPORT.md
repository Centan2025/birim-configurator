# V4.1 Fix report

Changes are isolated to the Configurator repository on `codex/v41-independent-audit`, based on `27e3938`. V2/V3 source routes remain present. Main and all prior commits are preserved. No deployment, Supabase access, customer data mutation or other repository edit was performed.

| Repair | Implementation | Regression evidence |
|---|---|---|
| Ten handle categories and removal | geometry/src/handle-geometry.ts; mesh-generator.ts | V41 unit category matrix + Chromium mesh/persistence test |
| Shared 3D transforms and fixed top hinge | components/componentMesh.ts; geometry/src/component-transform.ts | Unit fixed pivot + browser nine motion modes |
| Precise 2D bounds / actual bay thickness | geometry/src/projection2d.ts | 22mm panel regression; elevation browser |
| BOM cache, thickness, axes, drawer material and runner | manufacturing/src/bom-generator.ts | Same-version mutation and per-role assertions |
| Nesting trim cache / kerf / orientation / thickness | manufacturing/src/sheet-nesting.ts | Bounds, kerf, grain and thickness regression |
| Save failure and validated load | store/useConfiguratorStore.ts; V3ProjectModal.tsx | Quota injection and actual saved JSON reload |
| Consistent door setters and unique duplication IDs | store/useConfiguratorStore.ts; useV3Adapter.ts | Undo/redo, copy, legacy canonical sync |
| Draft after edit; unverified production blocked | core/v4-compatibility.ts; BOM; adapter transaction | Approval and mock ERP fail-closed tests |
| Template limits and mixed drawer elevations | catalog/v4-module-taxonomy.ts; store | Catalog inventory; resize constraints |
| Fixed-first-bay width remainder | core/rules.ts | Width conservation assertion |
| 180° and arbitrary Y placement | core/rules.ts; both renderers; kitchenSpatialEngine.ts | Core placement test, existing spatial suite |
| Honest library metadata and real release digest | catalog/v4-library-admin.ts | Draft lifecycle, duplicate ID and immutable SHA-256 test |
| Glass color/depth writing and wooden handle material | v3/materials/pbrMaterialSystem.ts; viewport | Material browser flow; visual inspection |

React review: no render-time side effects added; event handlers perform writes; shared geometry/materials are reused; WebGL initialization remains stable; storage feedback has a status role; the new drawer slider has an accessible name. Remaining full scene rebuild and rendering limits are documented in performance results.

Use `npm test`, `npx tsc --noEmit`, and the isolated browser instructions in V41_PLAYWRIGHT_REPORT.md. Build outputs and QA evidence are intentionally ignored by Git; reports and regression source are reviewable tracked changes.

Final browser follow-up: quota errors use red alert styling and an error icon; the tablet storage-error test passed after this visual correction. The Add control is pinned outside the scrolling module list, and a fit-all camera action uses actual scene bounds. The legacy master uses its original template identity so V4 limits do not break resizing.
