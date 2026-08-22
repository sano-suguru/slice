# WASI compatibility reporting: structured, multi-reason issues

- **Date:** 2026-08-22
- **Status:** Approved (design)
- **Scope:** `src/SliceFx.SourceGenerator` (`JsonContextPlanner`, `SliceFeatureGenerator`, `RouteManifestEmitter`), `src/Shared/SliceRouteManifestSchema.cs`, `src/SliceFx.Core/SliceFeatureRouteAttribute.cs`, `tools/SliceFx.Cli` (`GeneratedRouteCatalog`, `RouteTargetCapabilities`, `ListRoutesCommand`)
- **Origin:** `docs/product-direction.md` Directional focus: "Near-term WASI work should focus on better manifest-driven compatibility reporting and source-generated JSON/validation coverage before introducing another public routing API."

## Problem

`JsonContextPlanner.ReasonForWasi(FeatureModel, JsonContextPlan)` returns a single `string?`. Internally it is `GetWasiStructuralSkipReason(...) ?? FindExclusion(...)?.Reason`, and `GetWasiStructuralSkipReason` is an if-chain:

```csharp
if (feature.ReturnsAspNetResult) return "IResult is ASP.NET-specific";
if (feature.RequiresReflectionValidation) return "DataAnnotations validation requires reflection";
return GetParameterBindingSkipReason(feature, serializableTypes); // returns on the FIRST unsupported parameter
```

Three independent problems fall out of this:

1. **Only the first applicable structural reason is ever surfaced.** A feature that both requires reflection-bound validation *and* has an unsupported parameter type only ever reports the validation reason; the parameter problem is invisible until the validation problem is fixed and the route is re-evaluated.
2. **`GetParameterBindingSkipReason` short-circuits on the first unsupported parameter** (`SliceFx.SourceGenerator/JsonContextPlanner.cs:547-575`) — a handler with two unsupported parameters only ever names one.
3. **DataAnnotations reflection-validation collapses to one generic string** (`"DataAnnotations validation requires reflection"`), even though the generator already computes per-attribute detail (`FeatureModel.GetUnsupportedValidationAttributes()`, feature name + attribute type name + source location) for diagnostic messages SLICE010/022/034/072. That detail is discarded before it reaches the manifest, and it currently lacks the property name.

Note: JSON-context-missing (`SLICE021`, the `FindExclusion` branch) cannot currently co-occur with a structural reason in the output, but not because of a masking bug — `JsonContextPlanner.CreatePlan` `continue`s past root collection entirely once a structural skip reason is found, so no exclusion is ever recorded for that feature in that case. This is correct as-is (a route returning `IResult` has no JSON root to validate) and is out of scope to change.

Consumers (`tools/SliceFx.Cli/Internal/RouteTargetCapabilities.cs`, `slicefx routes --format json`) inherit this single-reason limitation: external tooling cannot enumerate or filter by the distinct reasons a route is WASI-ineligible, and cannot tell "returns IResult" apart from "has an unsupported parameter" without string-matching free text.

## Goal

Make every independent WASI-eligibility problem for a route visible simultaneously, at the granularity needed to act on it (including which DataAnnotations property/attribute pair is unsupported), without:

- adding a new public routing API (non-goal per `docs/product-direction.md`),
- adding a `<PackageReference>` to `SliceFx.Core`,
- introducing per-request reflection,
- breaking existing consumers of `WasiDispatchStatus` / `WasiDispatchReason` / `slicefx routes --format json`'s existing fields.

**Scope is WASI only.** `JsonContextPlanner`'s Lambda function-per-feature path (`ReasonForLambda`, `GetLambdaStructuralSkipReason`) shares the same single-reason shape and has the same latent issue, but Lambda function-per-feature already has its own SLICE03x diagnostic family and its own eligibility surface; folding it into this change would double the diff for a target the product-direction doc does not call out. Left as a documented future follow-up using the same `WasiCompatibilityIssue` shape.

## Design

### 1. `WasiCompatibilityIssue`: the structured multi-reason shape

New type in `SliceFx.SourceGenerator` (internal, generator-only — never public API):

```csharp
internal readonly record struct WasiCompatibilityIssue(string Code, string Category, string Message);
```

- `Code` is an **existing** SLICE02x diagnostic ID: `SLICE020` (return type), `SLICE021` (JSON context missing), `SLICE022` (validation), `SLICE023` (parameter binding). No new diagnostic IDs are introduced — this reuses the diagnostic catalog's own identifiers as the structured key, so `AnalyzerReleases.Unshipped.md` needs no changes.
- `Category` is one of four fixed strings: `"return-type"`, `"validation"`, `"parameter-binding"`, `"json-context"`. Defined as `internal const string` fields, one set colocated with `JsonContextPlanner` (generator side) and a duplicate set colocated with `RouteTargetCapabilities` (CLI side) — this repo's existing convention for cross-project vocabulary (see `SourceGenerationHelpers.ManifestEligible`/`RouteTargetCapabilities.Eligible`, both `"eligible"`, defined independently on each side). A code comment on both sides cross-references the other so they stay in sync deliberately, not accidentally.
- `Message` is free text, human-readable, matching today's reason strings in tone (and, for the structural cases, byte-for-byte identical to what `GetWasiStructuralSkipReason` produces today, so `WasiDispatchReason`'s "first issue" stays stable — see Compatibility).

### 2. `JsonContextPlanner.GetWasiCompatibilityIssues`

New method, additive (does not remove `StatusForWasi`/`ReasonForWasi`/`GetWasiStructuralSkipReason`):

```csharp
internal static ImmutableArray<WasiCompatibilityIssue> GetWasiCompatibilityIssues(
    FeatureModel feature, JsonContextPlan plan)
```

Evaluates every check without short-circuiting:

1. `feature.ReturnsAspNetResult` → one `return-type` / `SLICE020` issue. When true, skip response-type JSON root collection for the rest of this method (an `IResult` feature has no JSON root to validate — matches existing `CollectRoots` behavior via `IsPassthroughResponseType`).
2. `feature.RequiresReflectionValidation` → iterate `feature.GetUnsupportedValidationAttributes()` in full (not just take the first) and emit one `validation` / `SLICE022` issue **per attribute occurrence**, with the property name folded into the message (see part 3 below). One `IValidatableObject` implementation, if present, is its own issue with no property name (type-level, matching today's `SerializeUnsupportedValidationType` behavior).
3. Parameter binding — loop every handler parameter (mirroring `GetParameterBindingSkipReason`'s loop) and emit one `parameter-binding` / `SLICE023` issue **per unsupported parameter**, instead of returning after the first. The existing ambiguous-body-parameter case (`selection.AmbiguousWith is not null`) is also its own single issue (a handler either has one ambiguity or none — multiplicity doesn't apply here).
4. JSON-context-missing — reuse `FindExclusion(plan, feature)`; if non-null, one `json-context` / `SLICE021` issue. Per the Problem section, this only fires when none of 1–3 already caused a structural skip (unchanged control-flow boundary, since `JsonContextPlan` is built by `CreatePlan`, which still `continue`s past root collection on a structural skip — this method does not change `CreatePlan`).

Returns `ImmutableArray<WasiCompatibilityIssue>.Empty` when the route is fully WASI-portable.

`ReasonForWasi` is reimplemented in terms of this method (`GetWasiCompatibilityIssues(...).FirstOrDefault().Message`, or `null` if empty) so its externally-observable behavior is unchanged: same first-reason string as today, because the evaluation order above matches the existing if-chain order for the structural cases, and JSON-context exclusion is still evaluated last. `StatusForWasi` is unchanged (`eligible` iff the issue list is empty).

### 3. DataAnnotations: property-level detail

`SliceFeatureGenerator.CreateValidationRules` (`SliceFeatureGenerator.cs:1095-1177`) already walks each public property (and matching primary-constructor parameter) of the request type and calls `SerializeUnsupportedValidationAttribute(featureName, attribute)` when a property's attribute can't be compiled. Add the property name as a parameter through the chain:

- `SerializeUnsupportedValidationAttribute(string featureName, string? propertyName, AttributeData attribute)`
- `SerializeUnsupportedValidation(string featureName, string? propertyName, string attributeName, DiagnosticLocationModel location)` — append `Encode(propertyName ?? "")` as a 10th pipe-delimited field.
- `UnsupportedValidationAttributeModel` (`Model/FeatureModel.cs:266-286`) gains `string? PropertyName` (empty decoded string → `null`). `GetUnsupportedValidationAttributes()`'s strict `parts.Length != 9` guard becomes `!= 10`.
- The two call sites in `CreateValidationRules` (`SliceFeatureGenerator.cs:1118`, `:1159`) pass the property name; the `IValidatableObject` call site (`SerializeUnsupportedValidationType`, `:1525`) passes `null` (type-level, no single property).

This is a purely internal, single-build-scoped serialization format (produced and consumed within the same incremental generator pipeline invocation) — not the cross-version manifest contract — so there is no compatibility concern in changing its shape from 9 to 10 fields.

`FindAspNetUnsupportedValidationDiagnostics` (`SliceFeatureGenerator.cs:1637-1653`, which reports SLICE010) is unaffected: it only reads `FeatureName`/`AttributeName`/location, which are unchanged.

The `validation` issue message in `GetWasiCompatibilityIssues` becomes, e.g.:
`"Property 'Email': DataAnnotations attribute 'CustomValidationAttribute' requires reflection and is not supported in the WASI path."` (type-level `IValidatableObject` case omits the `Property '...'` prefix.)

### 4. Manifest wiring

`SliceFeatureRouteAttribute` (`src/SliceFx.Core/SliceFeatureRouteAttribute.cs`) gains one more tail-appended optional constructor parameter, following the exact precedent set by `serializedSliceFilterTypes` (arg index 25, comment "do NOT insert before this"):

```csharp
// arg index 26 (tail-appended — do NOT insert before this)
string? serializedWasiCompatibilityIssues = null
```

with a corresponding `public string? SerializedWasiCompatibilityIssues { get; }`.

`SliceRouteManifestSchema.AttributeConstructorArgumentCount` bumps `26 → 27`. `SliceRouteManifestSchema.CurrentVersion` **stays `"1"`** — this is a purely additive field; nothing in the existing 26-argument contract changes meaning, and a CLI build unaware of index 26 simply never reads it. (The two guards serve different purposes: `AttributeConstructorArgumentCount` is a mechanical positional-arity check that must always exactly match the emitted attribute shape, and bumps on every new argument regardless of "additive" semantics; `CurrentVersion` is the semantic manifest-format version gate `GeneratedRouteCatalog.DecodeRoute` throws `UnsupportedRouteManifestSchemaException` on, and only needs to move when the *meaning* of existing fields changes. Precedent: the `SerializedSliceFilterTypes` addition bumped the arg count 25→26 without moving `CurrentVersion` off `"1"`.)

Encoding (matches `SerializeParameters`'s existing pattern of pipe-delimited fields joined by newlines, with base64 for free text):

```
{code}|{category}|{base64(message)}
```

one per line, joined by `\n`; empty string when there are no issues (mirrors `SerializeFilterTypes` returning `null`/absent for the empty case — here, `null` when `GetWasiCompatibilityIssues` returns empty, matching how `route.WasiReason` is already `null` in the eligible case).

`RouteManifestEmitter`:

- `RouteManifestEntry` gains a field carrying the serialized issues string (computed once per route, alongside the existing `wasiStatus`/`wasiReason` computation in `BuildRouteManifestEntries`).
- `EmitRouteAttributes` appends the new literal as the 27th constructor argument.
- `EmitRoutesField`/`SliceRouteDescriptor` are **not** changed — the generated `SliceRouteDescriptor` record (consumed by user code via `GetSliceRoutesGenerated()`) is a separate, smaller projection that never carried Lambda-artifact-per-issue-level detail either; adding the raw serialized issue string there would leak an internal wire format into a public-facing generated API. Compatibility reporting is a CLI/tooling concern, not a runtime-dispatch concern, so it belongs only in the assembly-level `SliceFeatureRouteAttribute` that `slicefx routes` reads via raw metadata, not in `SliceRouteDescriptor`.

### 5. CLI decoding and surface

`GeneratedRouteCatalog.DecodeRoute` (`tools/SliceFx.Cli/Internal/GeneratedRouteCatalog.cs:341+`) reads `args[26]` the same way it reads `args[25]` today (`SplitLines`-style, but each line further split on `|` with the third field base64-decoded). New CLI-side record:

```csharp
internal sealed record WasiCompatibilityIssue(string Code, string Category, string Message);
```

`SliceRouteInfo` (`RouteCatalog.cs:445+`) gains `IReadOnlyList<WasiCompatibilityIssue> WasiCompatibilityIssues = []`. The source-scan fallback path (unbuilt projects) has no generator-computed data to decode and leaves this empty — consistent with how `WasiDispatchStatus` already falls back to `unknown` there.

`RouteTargetCapabilities.Classify` / `RouteCapability` (`RouteTargetCapabilities.cs`): `RouteCapability` gains `IReadOnlyList<WasiCompatibilityIssue>? Issues = null`; `Classify` populates it from `route.WasiCompatibilityIssues` on the `WasiDispatch` capability only (Lambda capabilities untouched, matching the WASI-only scope). `Status`/`Reason` computation is unchanged.

`ListRoutesCommand`:

- **table format**: NOTE column unchanged in structure; when `Issues.Count > 1`, append `" (+{N-1} more)"` after the primary reason so the fixed-width table stays readable. Full column layout is not renegotiated.
- **json format**: `RouteCapabilities`/the serialized `WasiDispatch` capability gains an `issues` array (`[{ code, category, message }]`) alongside the existing `status`/`reason` fields, which are left untouched. This is an additive field on the existing JSON contract, consistent with `docs/product-direction.md`'s framing of the manifest/CLI JSON as improvable so long as existing fields don't change meaning.

## Testing (TDD)

`SliceFx.SourceGenerator.Tests`:
- A feature with an unsupported parameter type *and* an unsupported DataAnnotations attribute produces both a `parameter-binding` issue and a `validation` issue (regression guard for the exact bug in the Problem section: neither check gates on the other in the new method).
- A feature with two unsupported parameters produces two `parameter-binding` issues, each naming its own parameter.
- A feature with two unsupported DataAnnotations attributes on different properties produces two `validation` issues, each with the correct property name in the message.
- A feature with an `IValidatableObject` implementation produces one `validation` issue with no `Property '...'` prefix.
- A fully portable feature: `GetWasiCompatibilityIssues` returns empty; `ReasonForWasi` returns `null`; `StatusForWasi` returns `eligible` (regression guard against the refactor).
- `ReasonForWasi`'s returned string, for each single-issue scenario, is byte-for-byte identical to today's pre-refactor output (locks in the "first issue = same string as before" compatibility claim).

`SliceFx.Cli.Tests`:
- `routes --format json` output gains `issues` under the WASI capability for a route with multiple problems; existing `status`/`reason` fields are asserted unchanged for existing fixture routes.
- A route with 3+ issues in table format shows the primary reason plus `(+2 more)`.
- `GeneratedRouteCatalog` correctly decodes a 27-argument attribute; the existing arg-count-mismatch exception path (simulate a stale 26-argument attribute, or bump a test double's expected count) still throws `InvalidRouteManifestException` with the expected/found counts in the message.

No changes to `AnalyzerReleases.Unshipped.md` (no new diagnostic IDs). No changes to `SliceRouteDescriptor` (public generated surface unaffected).

## Out of scope

- Lambda function-per-feature (`ReasonForLambda`/`GetLambdaStructuralSkipReason`) getting the same multi-issue treatment — same shape, future follow-up, not bundled here to keep this change reviewable and scoped to what `product-direction.md` calls out.
- A full "which DataAnnotations rules are supported" positive coverage matrix (e.g., "this route supports `Required`, `StringLength`" for every property) — out of scope; this design only reports what's *unsupported* (the blocking factor), which is the data the generator already computes.
- Changing `SliceRouteDescriptor` (the public generated record consumed by user code via `GetSliceRoutesGenerated()`) to carry compatibility issues — that type is for runtime/tooling consumption of route shape, not compatibility diagnostics; issues live only in the CLI-facing `SliceFeatureRouteAttribute` metadata.
- Any new public API surface in `SliceFx.Wasi` or a new routing model — this is reporting-only, per the non-goal in `docs/product-direction.md`.
