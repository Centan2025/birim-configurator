# V4.1 Manufacturing validation

**NOT PRODUCTION READY.** Production approval is blocked by `V41_FACTORY_RULES_UNVERIFIED`. ERP export uses its existing fail-closed compatibility gate. BOM approval status remains draft. Selco packages retain `DRAFT_UNVERIFIED_PENDING_FACTORY_CONFIRMATION` and their unverified machine notes. No manufacturer rules, physical sample validation or CNC controller format were invented or approved.

Verified computational repairs: physical panel thickness and drawer-bottom/back cut axes; individual drawer runner resolution; selected handle SKU/quantity/cost; internal-drawer handle exclusion; front material overrides; full-input BOM invalidation; nesting trim/kerf/no overlap/bounds and separate thickness groups. Unverified handle mounting holes are omitted. Generic hinge, connector and shelf drilling still exist as draft engineering estimates and require review for actual thickness, face conventions, hardware and tool paths.

The regression suite covers programmatic handle and drawer counts, same-version changes, kerf and grain. A screenshot cannot validate cut dimensions; these are separately asserted. Independent factory confirmation is still needed for all mounting coordinates, hinge counts/selection, appliance recesses, load/deflection rules, grain machining direction, actual kerf, grippers, minimum parts and Selco postprocessor output. J-pull/recessed routing is not emitted as a certified machining operation.

Nesting is a guillotine heuristic, not a certified global optimum or machine cutting sequence. Tests prove the recorded sample's geometry constraints; they do not certify all future input combinations. Pricing remains an estimate using bundled EUR/TRY and tax assumptions, not a live validated quote.
