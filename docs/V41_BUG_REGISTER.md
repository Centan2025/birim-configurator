# V4.1 Bug register

Initial findings, recorded before changes. Reproduction uses local synthetic projects only.

| ID | Priority | Area | Observed / expected | Reproduction | Root / affected function | Regression / remaining risk |
|---|---|---|---|---|---|---|
| V41-01 | P1 | Handles | No door handle / selected category visible | Select knob then bar in V4 inspector | mesh-generator: door handle generation absent | Category, leaf binding, open/closed geometry tests; generic visual models remain representative |
| V41-02 | P0 | BOM cache | Stale measurements / recompute all changed inputs | Same project/version, change shelf elevation or gap | computeProjectBOMKey excludes data | Full-input cache key; bounded cache |
| V41-03 | P0 | Cut list | Panel width becomes thickness / actual smallest panel axis | Generate base top, shelf, drawer bottom | generateBOMForProject thickness/axis selection | Per-role dimensions assertions |
| V41-04 | P0 | Production | Unverified holes and approval claims / block pending validation | Select catalog bar; inspect holes and approval | drilling-engine generic handle assumptions, compatibility | No generated unverified handle holes; approval gate |
| V41-05 | P1 | Doors | Lift rotation ignored / transform all axes around explicit pivot | Open lift in Studio | V3ThreeViewport Y-only branch | Shared transformed component centers tests + browser |
| V41-06 | P1 | Door state | Old canonical system overrides new legacy type / synchronized type and system | Select V4 double then V2 right single | setBayDoorType only changes type | State regression |
| V41-07 | P0 | Persistence | Save reports success on quota error / explicit failure | Storage setItem throws | saveToStorage catch ignores error | Failure injection, schema-validated load |
| V41-08 | P1 | Materials | Drawer override ignored in cut list / same material in 3D/BOM | Set frontMaterialId | BOM drawer_front uses doorMat | Material override regression |
| V41-09 | P0 | Approval | Approval survives edit / draft after mutation | Approve then change dimensions | cloneProject and adapter commits preserve status | Mutation invalidates approval |
| V41-10 | P1 | 2D | Bay offsets assume 18mm / actual thickness | Set 16/22mm panel | generateElevation2D | Dimension line regression |
| V41-11 | P1 | Library | Synthetic SHA256 and automatic verification / evidence based draft catalog | Inspect default admin entries/releases | seedFromCanonicalLibrary, publishNewRelease | Honest verification defaults and real digest |
| V41-12 | P1 | Duplicate | Child IDs copied / unique child identities | Duplicate module and inspect component IDs | duplicateActiveModule | Unique IDs across copies |

| V41-13 | P0 | Nesting | Rounded kerf coordinates, incomplete new-sheet rotation, mixed thickness / precise valid placements | Nest parts with fractional kerf, vary trim and thickness | sheet-nesting: optimizeSheetNesting | Preserve fractional coordinates, check both axes, separate thickness; bounds/kerf regression passes |
| V41-14 | P1 | Studio controls | Add control covered by door toggle as list grows / reachable Add | Append modules until pill overflows | V3UnifiedWorkspace floating pill flex container | Pin Add outside scrolling module list; real 20/50 append browser test |
| V41-15 | P1 | Legacy resize | V4 template limits break master resize / preserve V2 behavior | Default wardrobe, change width to 2200 | defaults references different V4 template | Correct legacy template reference; browser V2/V3 resize and new unit regression |
| V41-16 | P1 | Drawer defaults | External drawer templates default to handleless / bar handles by default | Apply three-drawer base | buildTemplateFromSeed handles all open carcasses as handleless | Distinguish external drawer fronts; mesh/material/drawer-travel browser regression |
| V41-17 | P1 | Save indicator | UI says automatically saved without a storage write / honest save state | Open root then edit | initial autoSaveStatus and app/page.tsx label | Start unsaved, mark edits unsaved, show explicit save state; root browser flow |

For V41-01 through V41-12, the applied repairs and exact regression scenarios are detailed in V41_FIX_REPORT.md and V41_ROOT_CAUSE_ANALYSIS.md. All corrected cases retain the general risk of unverified production geometry/rules. Remaining capabilities are registered separately below; they are not silently treated as fixes.

## Remaining gaps

| ID | Priority | Area / file | Status | Reproduction / expected behavior | Remaining work |
|---|---|---|---|---|---|
| V41-R01 | P1 | Advanced motion / mesh-generator.ts | PARTIALLY WORKING | Open folding/pocket/tambour; compare to an actual product linkage | Sourced motion constraints, hierarchical linkage and exact sweep/collision models |
| V41-R02 | P1 | Corner/appliance/special modules / v4-module-taxonomy.ts | PARTIALLY WORKING | Instantiate corner/sloped/appliance seeds and inspect panels/openings | Real panel topology and physical recess/service requirements |
| V41-R03 | P1 | Admin / v4-library-admin.ts + V3UnifiedWorkspace.tsx | UI ONLY | Admin lists records but cannot author runtime geometry/rules from UI | Persisted custom definitions, schema editor, auth, full content releases and rollback |
| V41-R04 | P1 | Multi-selection / useConfiguratorStore.ts | NOT IMPLEMENTED | Select multiple modules and request a bulk material edit | Selection model, grouped edits and atomic undo |
| V41-R05 | P1 | Materials / pbrMaterialSystem.ts | UNVERIFIED | Compare physical grain scale and bronze mirror to calibrated samples | Physical UV scale, calibrated mirror/frame and compressed texture asset pipeline |
| V41-R06 | P0 | Manufacturing / drilling-engine.ts, selco-adapter.ts | UNVERIFIED | Attempt CNC/ERP approval | Verified manufacturer and factory rule sources plus physical sample/postprocessor validation; production remains blocked |
| V41-R07 | P2 | Performance / V3ThreeViewport.tsx | PARTIALLY WORKING | Change a front on a 50-module design | Full scene rebuild still occurs; selective update/instancing/worker improvements need measured design |
| V41-R08 | P2 | Visual regression / e2e-v41-audit.spec.ts | PARTIALLY WORKING | Run screenshots on another host | Current images are candidate evidence, not an approved portable pixel-diff baseline |
