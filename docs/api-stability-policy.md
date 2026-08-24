# API stability policy

This document narrows a specific gap called out in [`production-readiness.md`](production-readiness.md)'s adoption matrix: an "explicit API-stability commitment." It defines which public API SliceFx currently commits to keeping stable, on what terms, and what stays explicitly out of scope while the project is pre-1.0.

This is a **scoped** commitment, not a claim that SliceFx as a whole is stable. See [`production-readiness.md`](production-readiness.md) for the full production-readiness picture and [`product-direction.md`](product-direction.md) for where the satellite packages are headed.

## In scope

These `SliceFx.Core` types have kept the same public shape across every preview release and are what every sample, doc example, and the maintainer's own dogfooded production app ([`slicefx-inbox`](https://github.com/sano-suguru/slicefx-inbox)) build on:

| Type | Purpose |
|---|---|
| `[Feature]` (`FeatureAttribute`) | Declares a feature's HTTP method and route pattern. |
| `[Filter<T>]` (`FilterAttribute<T>`) | Attaches an ASP.NET `IEndpointFilter` to a feature. |
| `ISliceValidator<T>` | Closed validator interface for request types needing rules beyond DataAnnotations. |
| `SliceValidationResult` | Success/failure result type returned by `ISliceValidator<T>`. |
| `SliceResult<T>` / `SliceResult` | Host-neutral typed result type for success/error responses across ASP.NET, WASI, and Lambda. |

**Commitment:** a breaking change to the public shape of these types (removing or renaming a member, changing a signature, changing accepted values in an incompatible way) requires:

1. A stated reason that is a correctness or design-flaw fix, not routine churn — the same bar this project already applies to any pre-1.0 breaking change.
2. A breaking-change callout in that version's GitHub Release notes describing what changed and how to migrate.

This is an **advance-notice** policy, not a hard freeze: SliceFx is still 0.x, and pre-1.0 breaking changes remain possible when they fix a real problem. What this policy adds is that changes to the types above cannot land silently — they must be justified and called out.

## Out of scope

Everything else is unconstrained and may change without notice while still pre-1.0, in particular:

- **`SliceFx.SourceGenerator`'s emitted code shape and diagnostic catalog (SLICE0xx)** — actively evolving as new hosting paths and validation rules are added.
- **`SliceFx.Wasi`, `SliceFx.Wasi.KeyValue`, `SliceFx.Wasi.HttpClient`, `SliceFx.Wasi.Spin`** — experimental; WASI 0.3 migration is upstream-blocked (see [`docs/wasi-0.3-migration.md`](wasi-0.3-migration.md)), and the underlying `componentize-dotnet` / NativeAOT-LLVM toolchain is preview-quality.
- **`SliceFx.Lambda.FunctionPerFeature`** — explicitly an MVP (see [`product-direction.md`](product-direction.md#lambda-function-per-feature-mvp-scope)).
- **`SliceFx.Lambda`, `SliceFx.TestHost`** — satellite adapters, not yet covered by a stability commitment.
- **`SliceFx.Cli` output formats** (`slicefx routes`, `slicefx client csharp`/`typescript`, `slicefx openapi`, `slicefx manifest`/`package aws-lambda`) — CLI surface and generated-artifact shape may change.
- **`[SliceFilter<T>]` / `ISliceFilter`** (host-neutral filters) — newer than the types above; not yet included in scope.

## Growing this scope

As satellite packages mature (WASI tooling stabilizes upstream, Lambda function-per-feature moves past MVP), the scope above can expand — that is a deliberate decision made by editing this document, not an automatic consequence of a package reaching some age or version number. A 1.0 milestone, if and when one is set, would be tracked here and in [`product-direction.md`](product-direction.md).
