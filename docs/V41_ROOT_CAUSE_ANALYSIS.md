# V4.1 Root cause analysis

## Handle pipeline (V41-01)

The inspector's `setBayV4DoorConfig` already persisted `handleCategory` through `commitActiveModuleUpdate`. The schema and migration also preserved it. The failure was downstream: `generateModuleGeometry` never emitted door handle components. It only emitted a fixed drawer handle box, independent of selected category. The BOM separately resolved handles from the category, so hardware could be charged while absent in the viewport.

The repair emits category-specific component assemblies from the front geometry. Each handle retains `parentComponentId`, category, and the same explicit pivot/rotation as its front. Both V2 `ThreeCanvas` and V3 `V3ThreeViewport` use `componentMesh.ts:createComponentMesh`, which consumes all rotation axes. Selection, project JSON, compatibility, geometry and BOM all use the same bay door configuration. No remount, synchronization effect or copied UI state was added.

Gola visual channels are fixed to the carcass reference rather than the moving leaf. J-pull and recessed profiles are visual approximations, not certified routing geometry. No unverified handle mounting holes are generated.

## Manufacturing calculation failures (V41-02/03/08)

The BOM cache used counts rather than full configuration: shelf elevations/thicknesses, door gaps, per-front materials and other inputs could change without invalidation. It now keys on complete project and material inputs and evicts after 32 entries. Nesting uses the complete sheet configuration (including trim) and piece records, also bounded to 32 entries.

Cut thickness formerly fell back to `comp.dimensions.width`; a cabinet top therefore could be hundreds of millimetres thick. Thickness now comes from the panel's smallest physical axis. Drawer bottom/back cut axes are mapped explicitly; runner selection resolves the matching drawer ID rather than drawer zero. Front material overrides are honored in BOM.

## Motion and space failures (V41-05/06/10)

Renderers inferred pivots from roles and applied only Y rotation; lift X rotations disappeared. Geometry now defines pivots explicitly, and the top-hinged stay's hinge remains fixed. Representative complex mechanisms are not mechanically certified. Shared `transformComponentPoint` / `componentBounds` supply 2D projection bounds.

Legacy door-type updates left `doorSystemId` unchanged, allowing old canonical state to override a new type. Both setters now synchronize the fields. Module rotations also omitted 180 degrees; `calculateModulePlacement` now supplies consistent origins and footprints for 2D, 3D and collision checks.

## Persistence and approval (V41-04/07/09/11/12)

Save swallowed storage errors and returned a success ID. It now throws an actionable error handled by both save dialogs. Loads validate the schema before mutation. Imported/loaded approval status resets to draft. The project construction profile field, previously stripped by the schema, is preserved.

Edits now invalidate approval; adapter commits recompute derived state in one transaction. Duplicating a module regenerates child identities. Library seed metadata no longer asserts physical validation without evidence, and release SHA-256 is computed from an actual immutable entry snapshot rather than a formatted timestamp.

Factory rules, mounting coordinates and postprocessors have not been independently verified. A production-blocking UNVERIFIED issue now reaches compatibility and ERP gates; BOM remains draft. This is a deliberate safety correction, not a completed factory verification.

## Nesting failures (V41-13)

Rounding X/Y coordinates after calculating free rectangles with a 4.4mm kerf could reduce actual spacing. Coordinates retain precision. New-sheet rotation now tests both dimensions; material groups also separate thickness, so 8mm and 18mm material cannot share a cutting sheet.
