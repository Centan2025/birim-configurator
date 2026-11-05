# V4.1 Geometry validation

Coordinate convention: millimetres in the parametric model. Modules use X width, Y height, Z depth (front at positive Z). Component position is its unrotated box origin. An explicit module-space pivot and Euler XYZ rotation describe motion. `component-transform.ts` transforms points in the same order as Three.js; `componentMesh.ts` consumes those same fields.

Module position denotes the minimum world-plan X/Z corner. `calculateModulePlacement` computes rotated bounds and the translated render origin, so 90/180/270-degree cases do not drift from plan coordinates. Collision AABBs now use rotated extents. This is conservative AABB checking, not exact swept-volume interference.

Evidence: 92 seed schema/geometry/BOM checks; no default front-dimension mismatches after sliding-width correction; hinge pivot, width conservation, 22mm projection offsets and 180-degree placement regressions; nine browser motion scenarios and kitchen views.

Remaining: corner/slope modules still use generic rectangular components in several cases; special fittings are representative shelf boxes; framed glass, feet, hinges and true curved/special meshes are incomplete. 2D rotated projections use axis-aligned bounds, not projected polygons. Open-state view bounds can extend outside fixed viewboxes. Physical grain scale and mirror calibration are unverified. These limits prevent full system geometry acceptance.
