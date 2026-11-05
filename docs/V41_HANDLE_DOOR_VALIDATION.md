# V4.1 Handle and door validation

## Tested handle matrix

`tests/v41-independent-audit.test.ts` exercises each category on left, right, double and drawer fronts, closed and open: knob, bar_handle, long_profile_handle, edge_profile, recessed_grip, gola_profile, j_pull, milled_wood_grip, decorative_bespoke, handleless_plain. It verifies parent linkage, transforms, positive dimensions, drawer travel, SKU and quantity, and absence of invented mounting holes.

Actual Chromium selection verifies meshes, transforms, all ten categories in closed/open screenshots, undo/redo, save and reload. The UI category and the saved JSON category agree. Gola remains fixed as the leaf opens. Bar and long bar have mounts and grips; knob uses a stem and ellipsoid; decorative handles add rosettes; edge/Gola use profile sections; recessed and J-pull remain marked representative. These are not manufacturer CAD models. The long handle is visually clamped to a small front; compatibility remains responsible for fit restrictions.

## Tested motion

Browser changes and opens hinged_single, hinged_double, sliding_top_hung, lift_up_stay, lift_parallel, lift_bi_fold, folding_side, pocket_retractable and tambour_roller. Actual mesh matrices must change. Sliding translates rather than rotates; the top-hinged stay rotates about its top edge. All leaf-attached handles share the explicit front transform.

**PARTIALLY WORKING:** lift-parallel, bi-fold, folding, pocket and tambour paths remain representative. The tests establish transform application and linkage, not manufacturer kinematics or sweep/collision certification. Tambour uses a shrinking visible panel rather than individual articulated slats; framed glass is not a constructed frame assembly. Full product motion, track overlaps and hardware anchoring still need implementation and sourced validation.

Handle and opening technology remain separate fields. Existing incompatible handleless/manual combinations remain blocked. No handles were forced on a handleless front. Internal drawers do not get external handle BOM items.
