# WASI Compatibility Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every independent reason a route is excluded/degraded on the WASI dispatch path visible simultaneously — including per-property DataAnnotations detail — through the generated manifest and `slicefx routes`, instead of the current single first-match reason string.

**Architecture:** A new pure function `JsonContextPlanner.GetWasiCompatibilityIssues` evaluates all WASI-eligibility checks without short-circuiting and returns a list of `WasiCompatibilityIssue{Code, Category, Message}` structs (Code = an existing SLICE02x diagnostic ID, reused as a structured key — no new diagnostics). The list is serialized into a new tail-appended optional argument on `SliceFeatureRouteAttribute`, decoded by the CLI's raw-metadata reader, and surfaced through `RouteTargetCapabilities`/`slicefx routes` alongside the existing (unchanged) `WasiDispatchStatus`/`WasiDispatchReason` fields.

**Tech Stack:** C# / .NET 10, Roslyn incremental source generator (`SliceFx.SourceGenerator`), `System.CommandLine`-based CLI (`SliceFx.Cli`), xUnit v3.

**Spec:** `docs/superpowers/specs/2026-08-22-wasi-compatibility-reporting-design.md`

## Global Constraints

- `src/SliceFx.Core` must never gain a `<PackageReference>` — this plan doesn't touch its dependencies, but no task may add one.
- No per-request reflection. Everything in this plan runs at build/generation time or in the CLI, never per HTTP request.
- Scope is **WASI only** — do not touch `JsonContextPlanner.ReasonForLambda` / `GetLambdaStructuralSkipReason` or any Lambda function-per-feature diagnostics/eligibility.
- No new diagnostic IDs — reuse SLICE020/021/022/023 as `WasiCompatibilityIssue.Code` values. Do not edit `AnalyzerReleases.Unshipped.md`.
- `SliceRouteManifestSchema.CurrentVersion` stays `"1"`. Only `AttributeConstructorArgumentCount` bumps (26 → 27), because this is a purely additive tail-appended argument.
- Do not touch `SliceRouteDescriptor` (the public generated record from `GetSliceRoutesGenerated()`) — compatibility issues are a CLI/tooling concern surfaced only through `SliceFeatureRouteAttribute`.
- Do not touch `WasiRegistrationEmitter.GetSkipReason` or `RouteManifestEmitter`'s private `ClassifyPortability`/`GetWasiStructuralSkipReason` (the `Portability`/`PortabilityReason` computation) — these are separate, pre-existing near-duplicates of the same "first WASI skip reason" idea, but they drive different fields (actual compile-time SLICE020/022/023 diagnostics, and the `Portability` manifest field, respectively) that are explicitly out of scope. Leaving them alone means diagnostic counts during a normal build are unaffected by this change.
- Run `dotnet build` then the relevant `dotnet test` commands from the repo root after each task (see CLAUDE.md `Commands`). Use `--filter "Category!=RequiresPublish"` for local runs.

---

### Task 1: Property name for unsupported DataAnnotations attributes

**Files:**
- Modify: `src/SliceFx.SourceGenerator/Model/FeatureModel.cs` (`UnsupportedValidationAttributeModel`, `FeatureModel.GetUnsupportedValidationAttributes()`)
- Modify: `src/SliceFx.SourceGenerator/SliceFeatureGenerator.cs` (`CreateValidationRules`, `SerializeUnsupportedValidationAttribute`, `SerializeUnsupportedValidationType`, `SerializeUnsupportedValidation`)
- Test: `tests/SliceFx.SourceGenerator.Tests/UnsupportedValidationAttributeModelTests.cs` (new file)

**Interfaces:**
- Produces: `UnsupportedValidationAttributeModel` gains `string? PropertyName` (10th field). `FeatureModel.GetUnsupportedValidationAttributes()` parses 10 pipe-delimited fields (was 9); the 10th is `Decode(parts[9])`, mapped to `null` when the decoded string is empty. Consumed by Task 2.

Today, `UnsupportedValidationAttributeModel` (`Model/FeatureModel.cs:266-286`) carries `FeatureName`/`AttributeName`/location but not which property the unsupported attribute sits on. `SliceFeatureGenerator.CreateValidationRules` (`SliceFeatureGenerator.cs:1095-1177`) already knows the property (it's iterating `requestType.GetMembers().OfType<IPropertySymbol>()`) but never passes it through.

- [ ] **Step 1: Write the failing unit test for the deserializer**

Create `tests/SliceFx.SourceGenerator.Tests/UnsupportedValidationAttributeModelTests.cs`:

```csharp
namespace SliceFx.SourceGenerator.Tests;

public sealed class UnsupportedValidationAttributeModelTests
{
    [Fact]
    public void GetUnsupportedValidationAttributes_decodes_property_name_when_present()
    {
        var feature = BuildFeature(
            serializedUnsupportedValidationAttributes: EncodeUnsupportedValidationAttribute(
                featureName: "CreateUser",
                propertyName: "Email",
                attributeName: "CustomValidationAttribute"));

        var unsupported = Assert.Single(feature.GetUnsupportedValidationAttributes());

        Assert.Equal("CreateUser", unsupported.FeatureName);
        Assert.Equal("CustomValidationAttribute", unsupported.AttributeName);
        Assert.Equal("Email", unsupported.PropertyName);
    }

    [Fact]
    public void GetUnsupportedValidationAttributes_returns_null_property_name_for_type_level_entries()
    {
        var feature = BuildFeature(
            serializedUnsupportedValidationAttributes: EncodeUnsupportedValidationAttribute(
                featureName: "CreateUser",
                propertyName: null,
                attributeName: "IValidatableObject"));

        var unsupported = Assert.Single(feature.GetUnsupportedValidationAttributes());

        Assert.Null(unsupported.PropertyName);
    }

    private static string EncodeUnsupportedValidationAttribute(string featureName, string? propertyName, string attributeName)
        => string.Join("|",
            "", "-1", "-1", "-1", "-1", "-1", "-1",
            Encode(featureName),
            Encode(attributeName),
            Encode(propertyName ?? ""));

    private static string Encode(string value)
        => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(value));

    private static FeatureModel BuildFeature(string serializedUnsupportedValidationAttributes)
        => new(
            FullyQualifiedTypeName: "global::TestApp.CreateUser",
            TypeName: "CreateUser",
            Tag: "Default",
            EndpointName: "TestApp.CreateUser",
            HttpMethod: "POST",
            Pattern: "/users",
            Summary: null,
            ReturnTypeFqn: "global::System.String",
            ReturnsAspNetResult: false,
            SerializedParams: "",
            SerializedFilterFqns: "",
            SerializedSliceFilterFqns: "",
            SerializedValidationRules: "",
            RequiresReflectionValidation: true,
            SerializedUnsupportedValidationAttributes: serializedUnsupportedValidationAttributes,
            SerializedFilterOrderHints: "",
            LambdaStartupTypeFqn: null,
            FeatureLocationFilePath: "",
            FeatureLocationSourceStart: -1,
            FeatureLocationSourceLength: -1,
            FeatureLocationStartLine: -1,
            FeatureLocationStartCharacter: -1,
            FeatureLocationEndLine: -1,
            FeatureLocationEndCharacter: -1);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test tests/SliceFx.SourceGenerator.Tests --filter "FullyQualifiedName~UnsupportedValidationAttributeModelTests"`
Expected: FAIL — `UnsupportedValidationAttributeModel` has no `PropertyName` member yet (compile error), or (once it compiles against a stub) the parser rejects the 10-field line because the length check is still `!= 9`.

- [ ] **Step 3: Add `PropertyName` to the model and its deserializer**

In `src/SliceFx.SourceGenerator/Model/FeatureModel.cs`, change:

```csharp
internal readonly record struct UnsupportedValidationAttributeModel(
    string FilePath,
    int SourceStart,
    int SourceLength,
    int StartLine,
    int StartCharacter,
    int EndLine,
    int EndCharacter,
    string FeatureName,
    string AttributeName,
    string? PropertyName)
```

and in `GetUnsupportedValidationAttributes()`, change the length guard and add the new field:

```csharp
if (parts.Length != 10
    || !int.TryParse(parts[1], out var sourceStart)
    || !int.TryParse(parts[2], out var sourceLength)
    || !int.TryParse(parts[3], out var startLine)
    || !int.TryParse(parts[4], out var startCharacter)
    || !int.TryParse(parts[5], out var endLine)
    || !int.TryParse(parts[6], out var endCharacter))
{
    continue;
}

var propertyName = Decode(parts[9]);
builder.Add(new UnsupportedValidationAttributeModel(
    Decode(parts[0]),
    sourceStart,
    sourceLength,
    startLine,
    startCharacter,
    endLine,
    endCharacter,
    Decode(parts[7]),
    Decode(parts[8]),
    string.IsNullOrEmpty(propertyName) ? null : propertyName));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `dotnet test tests/SliceFx.SourceGenerator.Tests --filter "FullyQualifiedName~UnsupportedValidationAttributeModelTests"`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the property name through the generator's serializer**

In `src/SliceFx.SourceGenerator/SliceFeatureGenerator.cs`:

Change `SerializeUnsupportedValidation` to accept and append the property name:

```csharp
private static string SerializeUnsupportedValidation(
    string featureName,
    string? propertyName,
    string attributeName,
    DiagnosticLocationModel location)
    => string.Join("|", [
        Encode(location.FilePath),
        location.SourceStart.ToString(System.Globalization.CultureInfo.InvariantCulture),
        location.SourceLength.ToString(System.Globalization.CultureInfo.InvariantCulture),
        location.StartLine.ToString(System.Globalization.CultureInfo.InvariantCulture),
        location.StartCharacter.ToString(System.Globalization.CultureInfo.InvariantCulture),
        location.EndLine.ToString(System.Globalization.CultureInfo.InvariantCulture),
        location.EndCharacter.ToString(System.Globalization.CultureInfo.InvariantCulture),
        Encode(featureName),
        Encode(attributeName),
        Encode(propertyName ?? ""),
    ]);
```

Change the two callers to thread the property name through:

```csharp
private static string SerializeUnsupportedValidationAttribute(string featureName, string? propertyName, AttributeData attribute)
{
    var location = attribute.ApplicationSyntaxReference is null
        ? DiagnosticLocationModel.None
        : CreateDiagnosticLocation(attribute.ApplicationSyntaxReference.SyntaxTree.GetLocation(attribute.ApplicationSyntaxReference.Span));
    var attributeName = attribute.AttributeClass?.Name ?? "ValidationAttribute";
    return SerializeUnsupportedValidation(featureName, propertyName, attributeName, location);
}

private static string SerializeUnsupportedValidationType(string featureName, INamedTypeSymbol type, string attributeName)
{
    var location = CreateDiagnosticLocation(type.Locations.Length > 0 ? type.Locations[0] : null);
    return SerializeUnsupportedValidation(featureName, propertyName: null, attributeName, location);
}
```

In `CreateValidationRules` (`SliceFeatureGenerator.cs:1095-1177`), update the two call sites inside the property loop to pass `property.Name`:

- The type-level attribute loop (around line 1110-1119, `foreach (var attribute in requestType.GetAttributes().Where(IsValidationAttribute))`) has no property — leave its call as `SerializeUnsupportedValidationAttribute(handle.ContainingType.Name, propertyName: null, attribute)`.
- The `IValidatableObject` call (around line 1121-1125) has no single property — unchanged (already calls `SerializeUnsupportedValidationType`, which now passes `null` internally).
- The per-property attribute loop (around line 1148-1160, `foreach (var attribute in attributes)` inside `foreach (var property in requestType.GetMembers().OfType<IPropertySymbol>())`) — change `SerializeUnsupportedValidationAttribute(handle.ContainingType.Name, attribute)` to `SerializeUnsupportedValidationAttribute(handle.ContainingType.Name, property.Name, attribute)`.

- [ ] **Step 6: Run the full source generator test suite to confirm no regressions**

Run: `dotnet build && dotnet test tests/SliceFx.SourceGenerator.Tests --filter "Category!=RequiresPublish"`
Expected: PASS, including existing SLICE010/SLICE022/SLICE034/SLICE072 tests (their diagnostic messages don't include the property name today and are unaffected by this change).

- [ ] **Step 7: Commit**

```bash
git add src/SliceFx.SourceGenerator/Model/FeatureModel.cs src/SliceFx.SourceGenerator/SliceFeatureGenerator.cs tests/SliceFx.SourceGenerator.Tests/UnsupportedValidationAttributeModelTests.cs
git commit -m "feat(source-generator): carry property name on unsupported validation attributes"
```

---

### Task 2: `WasiCompatibilityIssue` + exhaustive `GetWasiCompatibilityIssues` + manifest wiring

**Files:**
- Modify: `src/SliceFx.SourceGenerator/Model/JsonContextPlan.cs` (add `WasiCompatibilityIssue` + category constants)
- Modify: `src/SliceFx.SourceGenerator/JsonContextPlanner.cs` (add `GetWasiCompatibilityIssues`; reimplement `ReasonForWasi`/`StatusForWasi` in terms of it)
- Modify: `src/SliceFx.Core/SliceFeatureRouteAttribute.cs` (tail-append `serializedWasiCompatibilityIssues`)
- Modify: `src/Shared/SliceRouteManifestSchema.cs` (`AttributeConstructorArgumentCount` 26 → 27)
- Modify: `src/SliceFx.SourceGenerator/Emit/RouteManifestEmitter.cs` (compute + serialize issues; emit as arg 27)
- Modify: `tests/SliceFx.Cli.Tests/CliFixtureTests.cs` (update the "expected 26...found 17" assertion to 27)
- Test: `tests/SliceFx.SourceGenerator.Tests/SourceGeneratorCompileTests.cs` (new `[Fact]`s)

**Interfaces:**
- Consumes: `FeatureModel.GetUnsupportedValidationAttributes()` (Task 1, now carries `PropertyName`); `SourceGenerationHelpers.SelectBodyParameter`, `SourceGenerationHelpers.ResolveParameterBinding`; `JsonContextPlanner.FindExclusion`.
- Produces: `internal readonly record struct WasiCompatibilityIssue(string Code, string Category, string Message)`; `internal static ImmutableArray<WasiCompatibilityIssue> JsonContextPlanner.GetWasiCompatibilityIssues(FeatureModel feature, JsonContextPlan plan)`. Consumed by Task 3 (CLI decode) via the serialized manifest field, and by Task 4 indirectly through the CLI.

- [ ] **Step 1: Write the failing full-compile test for exhaustive parameter-binding issues**

Add to `tests/SliceFx.SourceGenerator.Tests/SourceGeneratorCompileTests.cs` (same file, same helper conventions — `CreateHostCompilation`, `CreateDriver`, `GetGeneratedSource`):

```csharp
[Fact]
public void Manifest_reports_every_unsupported_wasi_parameter_not_just_the_first()
{
    var source = """
        using System.Threading.Tasks;
        using Microsoft.AspNetCore.Http;
        using SliceFx;

        namespace WasiIssuesApp.Features.Orders
        {
            [Feature("GET /orders/{id}")]
            public static class GetOrder
            {
                public static Task<string> Handle(
                    string id,
                    [AsParameters] Filter a,
                    [AsParameters] Filter b) => Task.FromResult(id);

                public sealed record Filter(string Value);
            }
        }
        """;

    var compilation = CreateHostCompilation("WasiIssuesApp", source, includeWasiReference: true);
    GeneratorDriver driver = CreateDriver();
    driver = driver.RunGeneratorsAndUpdateCompilation(compilation, out _, out var diags, TestContext.Current.CancellationToken);

    Assert.DoesNotContain(diags, static d => d.Severity == DiagnosticSeverity.Error);
    var manifest = GetGeneratedSource(driver, "SliceRouteManifest.g.cs");
    var issues = ExtractWasiCompatibilityIssues(manifest, "WasiIssuesApp.Features.Orders.GetOrder");
    Assert.Equal(2, issues.Count(static i => i.Code == "SLICE023"));
}
```

`[AsParameters]` (ASP.NET's real attribute, `Microsoft.AspNetCore.Http.AsParametersAttribute`) forces `HandlerParameterBindingSource.Unsupported` for both `a` and `b` regardless of their type — `ResolveParameterBinding`'s `"parameters" => Unsupported(...)` branch (`SourceGenerationHelpers.cs:276`) always rejects it. That gives two independent, easy-to-construct SLICE023 issues in one feature.

Also add the shared test helper (private method in `SourceGeneratorCompileTests.cs`, near `GetGeneratedSource`) that decodes the new manifest field out of the raw attribute literal text:

```csharp
private static IReadOnlyList<(string Code, string Category, string Message)> ExtractWasiCompatibilityIssues(string manifestSource, string featureTypeFqn)
{
    // The route attribute literal is one long line; find the one for this feature by its FQN
    // literal, then take the 27th (0-indexed 26th) string argument — the tail-appended
    // serializedWasiCompatibilityIssues — which is either `null` or a C# verbatim string literal.
    var marker = $"\"{featureTypeFqn}\"";
    var lineStart = manifestSource.IndexOf(marker, StringComparison.Ordinal);
    Assert.True(lineStart >= 0, $"Could not find route attribute for '{featureTypeFqn}'.");
    var lineEnd = manifestSource.IndexOf(")]", lineStart, StringComparison.Ordinal);
    var line = manifestSource[lineStart..lineEnd];

    var lastArgStart = line.LastIndexOf(", ", StringComparison.Ordinal) + 2;
    var rawArg = line[lastArgStart..].Trim();
    if (rawArg == "null")
    {
        return [];
    }

    // rawArg is a C# string literal like "SLICE023|parameter-binding|<base64>\nSLICE023|...".
    var decoded = System.Text.Json.JsonSerializer.Deserialize<string>(
        "\"" + rawArg[1..^1].Replace("\\\"", "\"") + "\"")!;
    var result = new List<(string Code, string Category, string Message)>();
    foreach (var entry in decoded.Split('\n', StringSplitOptions.RemoveEmptyEntries))
    {
        var parts = entry.Split('|');
        result.Add((parts[0], parts[1], System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(parts[2]))));
    }

    return result;
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test tests/SliceFx.SourceGenerator.Tests --filter "FullyQualifiedName~Manifest_reports_every_unsupported_wasi_parameter_not_just_the_first"`
Expected: FAIL — the new manifest argument doesn't exist yet (the `AttributeConstructorArgumentCount`/attribute/emitter changes below haven't been made), so `ExtractWasiCompatibilityIssues` either throws or the helper's indexing is wrong for the current (26-argument) literal shape. This is expected to fail loudly; that's fine — the point is it fails for the right reason (feature not yet implemented), not a typo. Proceed to implement.

- [ ] **Step 3: Add `WasiCompatibilityIssue` and category constants**

In `src/SliceFx.SourceGenerator/Model/JsonContextPlan.cs`, add near the other small structs (`JsonRootType`, `FeatureJsonExclusion`):

```csharp
internal readonly record struct WasiCompatibilityIssue(string Code, string Category, string Message)
{
    // Fixed category vocabulary for WASI compatibility issues. A duplicate set of the same four
    // string literals exists on the CLI side (tools/SliceFx.Cli/Internal/RouteTargetCapabilities.cs)
    // — keep both in sync deliberately, the same way "portable"/"partial"/"aspnet-only" and
    // "eligible"/"ineligible" are already independently duplicated across generator and CLI.
    public const string CategoryReturnType = "return-type";
    public const string CategoryValidation = "validation";
    public const string CategoryParameterBinding = "parameter-binding";
    public const string CategoryJsonContext = "json-context";
}
```

- [ ] **Step 4: Add `GetWasiCompatibilityIssues` to `JsonContextPlanner`**

In `src/SliceFx.SourceGenerator/JsonContextPlanner.cs`, add (near `ReasonForWasi`):

```csharp
/// <summary>
/// Returns every independent reason <paramref name="feature"/> is excluded/degraded on the WASI
/// dispatch path, without short-circuiting on the first one found. Unlike
/// <see cref="GetWasiStructuralSkipReason"/> (an if-chain used by <see cref="CreatePlan"/> to decide
/// whether to collect JSON roots at all), this evaluates every independent check. The JSON-context
/// check at the end relies on <see cref="CreatePlan"/>'s existing invariant: an exclusion is only
/// ever recorded for a feature when none of the structural checks below already applied to it, so
/// calling <see cref="FindExclusion"/> unconditionally is safe — it naturally returns null whenever
/// a structural issue was already found.
/// </summary>
public static ImmutableArray<WasiCompatibilityIssue> GetWasiCompatibilityIssues(FeatureModel feature, JsonContextPlan plan)
{
    var issues = ImmutableArray.CreateBuilder<WasiCompatibilityIssue>();

    if (feature.ReturnsAspNetResult)
    {
        issues.Add(new WasiCompatibilityIssue(
            "SLICE020", WasiCompatibilityIssue.CategoryReturnType, "IResult is ASP.NET-specific"));
    }

    if (feature.RequiresReflectionValidation)
    {
        foreach (var unsupported in feature.GetUnsupportedValidationAttributes())
        {
            var message = string.IsNullOrEmpty(unsupported.PropertyName)
                ? $"DataAnnotations attribute '{unsupported.AttributeName}' requires reflection and is not supported in the WASI path."
                : $"Property '{unsupported.PropertyName}': DataAnnotations attribute '{unsupported.AttributeName}' requires reflection and is not supported in the WASI path.";
            issues.Add(new WasiCompatibilityIssue("SLICE022", WasiCompatibilityIssue.CategoryValidation, message));
        }
    }

    var serializableTypes = plan.GetSerializableTypesSet();
    var selection = SourceGenerationHelpers.SelectBodyParameter(feature, serializableTypes);
    if (selection.AmbiguousWith is not null)
    {
        issues.Add(new WasiCompatibilityIssue(
            "SLICE023", WasiCompatibilityIssue.CategoryParameterBinding, "multiple body parameters are not supported"));
    }
    else
    {
        foreach (var p in feature.GetParams())
        {
            if (p.TypeFqn == "global::System.Threading.CancellationToken")
            {
                continue;
            }

            var binding = SourceGenerationHelpers.ResolveParameterBinding(p, feature.Pattern, selection.Body);
            if (binding.Source == HandlerParameterBindingSource.Unsupported)
            {
                issues.Add(new WasiCompatibilityIssue(
                    "SLICE023",
                    WasiCompatibilityIssue.CategoryParameterBinding,
                    binding.UnsupportedReason ?? "parameter binding is unsupported"));
            }
        }
    }

    var exclusion = FindExclusion(plan, feature);
    if (exclusion is not null)
    {
        issues.Add(new WasiCompatibilityIssue("SLICE021", WasiCompatibilityIssue.CategoryJsonContext, exclusion.Value.Reason));
    }

    return issues.ToImmutable();
}
```

Reimplement `ReasonForWasi` and `StatusForWasi` in terms of it (replacing their current bodies):

```csharp
public static string StatusForWasi(FeatureModel feature, JsonContextPlan plan)
    => GetWasiCompatibilityIssues(feature, plan).IsEmpty
        ? SourceGenerationHelpers.ManifestEligible
        : SourceGenerationHelpers.ManifestIneligible;

public static string? ReasonForWasi(FeatureModel feature, JsonContextPlan plan)
{
    var issues = GetWasiCompatibilityIssues(feature, plan);
    return issues.IsEmpty ? null : issues[0].Message;
}
```

Do not modify `GetWasiStructuralSkipReason`, `GetLambdaStructuralSkipReason`, `ReasonForLambda`, or `CreatePlan` — they stay exactly as they are; `CreatePlan` is what makes the "no double-reporting" invariant this method relies on hold.

- [ ] **Step 5: Bump the manifest schema and add the constructor argument**

In `src/Shared/SliceRouteManifestSchema.cs`:

```csharp
internal const int AttributeConstructorArgumentCount = 27;
```

In `src/SliceFx.Core/SliceFeatureRouteAttribute.cs`, change the constructor signature's tail from:

```csharp
        // arg index 25 (tail-appended — do NOT insert before this)
        string? serializedSliceFilterTypes = null)
```

to:

```csharp
        // arg index 25 (tail-appended — do NOT insert before this)
        string? serializedSliceFilterTypes = null,
        // arg index 26 (tail-appended — do NOT insert before this)
        string? serializedWasiCompatibilityIssues = null)
```

and add `SerializedWasiCompatibilityIssues = serializedWasiCompatibilityIssues;` in the constructor body (alongside the existing `SerializedSliceFilterTypes = serializedSliceFilterTypes;` line), plus a matching property:

```csharp
/// <summary>
/// Gets newline-separated WASI compatibility issues, each encoded as
/// <c>code|category|base64(message)</c>. Null when the route has no WASI compatibility issues.
/// </summary>
public string? SerializedWasiCompatibilityIssues { get; }
```

- [ ] **Step 6: Wire issue computation and serialization into `RouteManifestEmitter`**

In `src/SliceFx.SourceGenerator/Emit/RouteManifestEmitter.cs`:

Add `SerializedWasiCompatibilityIssues` to the `RouteManifestEntry` record:

```csharp
internal readonly record struct RouteManifestEntry(
    FeatureModel Feature,
    string Portability,
    string? PortabilityReason,
    string WasiStatus,
    string? WasiReason,
    string? SerializedWasiCompatibilityIssues,
    string? LambdaStatus,
    ...
```

(Insert the new field right after `WasiReason`, before `LambdaStatus`. The record's other fields — `LambdaStatus` through `LambdaRuntimeIdentifier` — are unchanged; only add the one new field in this one spot.)

In `BuildRouteManifestEntries`, this existing block:

```csharp
var (portability, portabilityReason) = ClassifyPortability(feature, serializableTypes);
var wasiStatus = JsonContextPlanner.StatusForWasi(feature, wasiJsonContextPlan);
var wasiReason = JsonContextPlanner.ReasonForWasi(feature, wasiJsonContextPlan);
var lambda =
    GetEmittedLambdaMetadata(feature, assemblyName, emitLambdaFunctionPerFeatureHandlers, lambdaJsonContextPlan);
routes.Add(new RouteManifestEntry(
    feature,
    portability,
    portabilityReason,
    wasiStatus,
    wasiReason,
    lambda.Status,
    lambda.Reason,
    lambda.HandlerAssembly,
    lambda.HandlerType,
    lambda.HandlerMethod,
    lambda.ArtifactId,
    lambda.ArtifactLayout,
    lambda.ArtifactCodeUri,
    lambda.BootstrapMode,
    lambda.RuntimeIdentifier));
```

becomes:

```csharp
var (portability, portabilityReason) = ClassifyPortability(feature, serializableTypes);
var wasiIssues = JsonContextPlanner.GetWasiCompatibilityIssues(feature, wasiJsonContextPlan);
var wasiStatus = wasiIssues.IsEmpty ? SourceGenerationHelpers.ManifestEligible : SourceGenerationHelpers.ManifestIneligible;
var wasiReason = wasiIssues.IsEmpty ? null : wasiIssues[0].Message;
var serializedWasiIssues = SerializeWasiCompatibilityIssues(wasiIssues);
var lambda =
    GetEmittedLambdaMetadata(feature, assemblyName, emitLambdaFunctionPerFeatureHandlers, lambdaJsonContextPlan);
routes.Add(new RouteManifestEntry(
    feature,
    portability,
    portabilityReason,
    wasiStatus,
    wasiReason,
    serializedWasiIssues,
    lambda.Status,
    lambda.Reason,
    lambda.HandlerAssembly,
    lambda.HandlerType,
    lambda.HandlerMethod,
    lambda.ArtifactId,
    lambda.ArtifactLayout,
    lambda.ArtifactCodeUri,
    lambda.BootstrapMode,
    lambda.RuntimeIdentifier));
```

(This removes the calls to `JsonContextPlanner.StatusForWasi`/`ReasonForWasi` from this call site — they remain defined, per Step 4, but are no longer used here since `GetWasiCompatibilityIssues` computes both in one pass. They may still be called elsewhere or by tests; do not delete them.)

Add the serializer (near `SerializeFilterTypes`/`SerializeSliceFilterTypes`, reusing the existing private `EncodeManifestField`):

```csharp
private static string? SerializeWasiCompatibilityIssues(ImmutableArray<WasiCompatibilityIssue> issues)
    => issues.IsEmpty
        ? null
        : string.Join("\n", issues.Select(static issue => $"{issue.Code}|{issue.Category}|{EncodeManifestField(issue.Message)}"));
```

In `EmitRouteAttributes`, the single long `sb.AppendLine($"[assembly: global::SliceFx.SliceFeatureRouteAttribute(...)]")` line currently ends with `..., {CSharpNullableStringLiteral(SerializeSliceFilterTypes(feature))})]");`. Change that trailing part to append one more argument:

```csharp
..., {CSharpNullableStringLiteral(SerializeSliceFilterTypes(feature))}, {CSharpNullableStringLiteral(route.SerializedWasiCompatibilityIssues)})]");
```

`EmitRoutesField`/`SliceRouteDescriptor` are unchanged (per the Global Constraints — the public descriptor doesn't carry this).

- [ ] **Step 7: Update the existing hardcoded schema-mismatch test**

In `tests/SliceFx.Cli.Tests/CliFixtureTests.cs`, the test asserting `"expected 26 constructor arguments but found 17"` (around line 446) must become:

```csharp
Assert.Contains("expected 27 constructor arguments but found 17", exception.Message, StringComparison.Ordinal);
```

- [ ] **Step 8: Run the new test and the full suite**

Run: `dotnet build && dotnet test tests/SliceFx.SourceGenerator.Tests --filter "Category!=RequiresPublish"`
Expected: PASS, including `Manifest_reports_every_unsupported_wasi_parameter_not_just_the_first`.

Add and run one more full-compile assertion in the same file, confirming property names surface (closes the loop on Task 1):

```csharp
[Fact]
public void Manifest_reports_property_name_for_each_unsupported_validation_attribute()
{
    var source = """
        using System.ComponentModel.DataAnnotations;
        using System.Threading.Tasks;
        using SliceFx;

        namespace WasiValidationIssuesApp.Features.Users
        {
            [Feature("POST /users")]
            public static class CreateUser
            {
                public sealed record Request(
                    [CustomValidation(typeof(CreateUser), nameof(ValidateName))] string Name,
                    [CustomValidation(typeof(CreateUser), nameof(ValidateEmail))] string Email);

                public static Task<string> Handle(Request req) => Task.FromResult(req.Name);

                public static ValidationResult? ValidateName(string value, ValidationContext context) => ValidationResult.Success;
                public static ValidationResult? ValidateEmail(string value, ValidationContext context) => ValidationResult.Success;
            }
        }
        """;

    var compilation = CreateHostCompilation("WasiValidationIssuesApp", source, includeWasiReference: true);
    GeneratorDriver driver = CreateDriver();
    driver = driver.RunGeneratorsAndUpdateCompilation(compilation, out _, out var diags, TestContext.Current.CancellationToken);

    var manifest = GetGeneratedSource(driver, "SliceRouteManifest.g.cs");
    var issues = ExtractWasiCompatibilityIssues(manifest, "WasiValidationIssuesApp.Features.Users.CreateUser");

    Assert.Contains(issues, i => i.Code == "SLICE022" && i.Message.Contains("Property 'Name'", StringComparison.Ordinal));
    Assert.Contains(issues, i => i.Code == "SLICE022" && i.Message.Contains("Property 'Email'", StringComparison.Ordinal));
}
```

`[CustomValidation]` requires reflection to invoke the referenced method, so it is a genuinely unsupported attribute for compile-time generation — a real trigger for `RequiresReflectionValidation`, matching how existing SLICE022 tests already exercise it.

Run: `dotnet test tests/SliceFx.SourceGenerator.Tests --filter "Category!=RequiresPublish"`
Expected: PASS (all facts in the file, including the two new ones).

Then run the CLI test project to confirm Step 7's fix:

Run: `dotnet test tests/SliceFx.Cli.Tests --filter "Category!=RequiresPublish"`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/SliceFx.SourceGenerator/Model/JsonContextPlan.cs src/SliceFx.SourceGenerator/JsonContextPlanner.cs src/SliceFx.Core/SliceFeatureRouteAttribute.cs src/Shared/SliceRouteManifestSchema.cs src/SliceFx.SourceGenerator/Emit/RouteManifestEmitter.cs tests/SliceFx.SourceGenerator.Tests/SourceGeneratorCompileTests.cs tests/SliceFx.Cli.Tests/CliFixtureTests.cs
git commit -m "feat(source-generator): report every WASI compatibility issue, not just the first"
```

---

### Task 3: CLI decode — `SliceRouteInfo.WasiCompatibilityIssues` + `RouteTargetCapabilities`

**Files:**
- Modify: `tools/SliceFx.Cli/Internal/RouteCatalog.cs` (`WasiCompatibilityIssue` record, `SliceRouteInfo.WasiCompatibilityIssues`)
- Modify: `tools/SliceFx.Cli/Internal/GeneratedRouteCatalog.cs` (decode arg 26)
- Modify: `tools/SliceFx.Cli/Internal/RouteTargetCapabilities.cs` (`RouteCapability.Issues`)
- Test: `tests/SliceFx.Cli.Tests/CliFixtureTests.cs`

**Interfaces:**
- Consumes: the `serializedWasiCompatibilityIssues` manifest field from Task 2 (arg index 26 in the decoded `CustomAttribute`).
- Produces: `internal sealed record WasiCompatibilityIssue(string Code, string Category, string Message)` (CLI-side, independent of the generator-side type of the same name — they never share an assembly); `SliceRouteInfo.WasiCompatibilityIssues` (`WasiCompatibilityIssue[]`, default `[]`); `RouteCapability.Issues` (`IReadOnlyList<WasiCompatibilityIssue>`, default `[]`). Consumed by Task 4.

- [ ] **Step 1: Write the failing unit test for `RouteTargetCapabilities`**

In `tests/SliceFx.Cli.Tests/CliFixtureTests.cs`, add a new `[Fact]` right after `Route_target_capabilities_are_orthogonal_to_wasi_portability` (reusing its `portableRoute` construction pattern):

```csharp
[Fact]
public void Route_target_capabilities_surface_wasi_compatibility_issues()
{
    var baseRoute = new SliceRouteInfo(
        "POST",
        "/orders",
        "My.App.Features.Orders",
        "CreateOrder",
        "Orders",
        "Orders.CreateOrder",
        null,
        null,
        "global::System.String",
        RouteCatalog.PortabilityPortable,
        null,
        [],
        []);

    var routeWithIssues = baseRoute with
    {
        ManifestSchemaVersion = "1",
        WasiDispatchStatus = RouteTargetCapabilities.Ineligible,
        WasiDispatchReason = "multiple body parameters are not supported",
        WasiCompatibilityIssues =
        [
            new WasiCompatibilityIssue("SLICE023", "parameter-binding", "multiple body parameters are not supported"),
            new WasiCompatibilityIssue("SLICE022", "validation", "Property 'Email': DataAnnotations attribute 'CustomValidationAttribute' requires reflection and is not supported in the WASI path."),
        ],
    };

    var capability = RouteTargetCapabilities.Classify(routeWithIssues).WasiDispatch;

    Assert.Equal(RouteTargetCapabilities.Ineligible, capability.Status);
    Assert.Equal(2, capability.Issues.Count);
    Assert.Equal("SLICE023", capability.Issues[0].Code);
    Assert.Equal("SLICE022", capability.Issues[1].Code);
    Assert.Contains("Property 'Email'", capability.Issues[1].Message, StringComparison.Ordinal);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test tests/SliceFx.Cli.Tests --filter "FullyQualifiedName~Route_target_capabilities_surface_wasi_compatibility_issues"`
Expected: FAIL to compile — `SliceRouteInfo` has no `WasiCompatibilityIssues` init property and `WasiCompatibilityIssue` doesn't exist on the CLI side yet.

- [ ] **Step 3: Add `WasiCompatibilityIssue` and the `SliceRouteInfo` field**

In `tools/SliceFx.Cli/Internal/RouteCatalog.cs`, add near `SliceRouteInfo`:

```csharp
internal sealed record WasiCompatibilityIssue(string Code, string Category, string Message);
```

and add a new trailing field to `SliceRouteInfo` (after `SliceFilters`):

```csharp
    // arg index 25 (tail-appended to SliceFeatureRouteAttribute)
    string[]? SliceFilters = null,
    // arg index 26 (tail-appended to SliceFeatureRouteAttribute)
    WasiCompatibilityIssue[] WasiCompatibilityIssues = [])
```

- [ ] **Step 4: Add `RouteCapability.Issues`**

In `tools/SliceFx.Cli/Internal/RouteTargetCapabilities.cs`, change:

```csharp
internal sealed record RouteCapability(string Status, string? Reason, IReadOnlyList<WasiCompatibilityIssue> Issues = []);
```

and in `Classify`, pass the issues through only for the generated-metadata WASI branch:

```csharp
var wasi = !string.IsNullOrWhiteSpace(route.WasiDispatchStatus)
    ? new RouteCapability(route.WasiDispatchStatus, route.WasiDispatchReason, route.WasiCompatibilityIssues)
    : route.HasGeneratedMetadata
        ? new RouteCapability(Unknown, "WASI dispatch metadata missing")
        : new RouteCapability(route.Portability, route.PortabilityReason);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `dotnet test tests/SliceFx.Cli.Tests --filter "FullyQualifiedName~Route_target_capabilities_surface_wasi_compatibility_issues"`
Expected: PASS.

- [ ] **Step 6: Wire the raw-metadata decoder**

In `tools/SliceFx.Cli/Internal/GeneratedRouteCatalog.cs`, add a decode helper (near `ReadParameters`):

```csharp
private static WasiCompatibilityIssue[] ReadWasiCompatibilityIssues(string? value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return [];
    }

    var issues = new List<WasiCompatibilityIssue>();
    foreach (var line in SplitLines(value))
    {
        var parts = line.Split('|');
        if (parts.Length != 3)
        {
            continue;
        }

        issues.Add(new WasiCompatibilityIssue(parts[0], parts[1], DecodeManifestField(parts[2])));
    }

    return [.. issues];
}
```

In `DecodeRoute` (`GeneratedRouteCatalog.cs:341+`), after the existing `var sliceFilters = SplitLines(GetString(args[25]));` line, add:

```csharp
// arg index 26: WASI compatibility issues, tail-appended in schema version 1.
var wasiCompatibilityIssues = ReadWasiCompatibilityIssues(GetString(args[26]));
```

and add `WasiCompatibilityIssues: wasiCompatibilityIssues` to the trailing named arguments of the `return new SliceRouteInfo(...)` call, after `SliceFilters: sliceFilters`.

- [ ] **Step 7: Write the failing end-to-end fixture test**

Add to `tests/SliceFx.Cli.Tests/CliFixtureTests.cs`, modeled on `Route_catalog_prefers_generated_metadata_from_built_project` (same `CliProjectFixture` pattern, but referencing `SliceFx.Wasi` so the WASI columns populate):

```csharp
[Fact]
public async Task Route_catalog_decodes_wasi_compatibility_issues_from_a_built_project()
{
    using var fixture = CliProjectFixture.Create(
        "wasi-issues-app",
        $$"""
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net10.0</TargetFramework>
            <RootNamespace>WasiIssuesApp</RootNamespace>
          </PropertyGroup>
          <ItemGroup>
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.Core", "SliceFx.Core.csproj")}}" />
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.SourceGenerator", "SliceFx.SourceGenerator.csproj")}}" OutputItemType="Analyzer" ReferenceOutputAssembly="false" />
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.Wasi", "SliceFx.Wasi.csproj")}}" />
          </ItemGroup>
        </Project>
        """);

    fixture.WriteFeature(
        "Features/Orders/GetOrder.cs",
        """
        using System.Threading.Tasks;
        using Microsoft.AspNetCore.Http;
        using SliceFx;

        namespace WasiIssuesApp.Features.Orders;

        [Feature("GET /orders/{id}")]
        public static class GetOrder
        {
            public static Task<string> Handle(
                string id,
                [AsParameters] Filter a,
                [AsParameters] Filter b) => Task.FromResult(id);

            public sealed record Filter(string Value);
        }
        """);

    await fixture.BuildAsync();

    var route = Assert.Single(RouteCatalog.Discover(ProjectContextDiscovery.Discover(fixture.ProjectFile.FullName)));

    Assert.Equal(2, route.WasiCompatibilityIssues.Length);
    Assert.All(route.WasiCompatibilityIssues, issue => Assert.Equal("SLICE023", issue.Code));
}
```

`CliProjectFixture.Create(string projectName, string? projectSource = null)`, `fixture.WriteFeature(string relativePath, string source)`, and `await fixture.BuildAsync()` (no arguments; runs `dotnet build` on `fixture.ProjectFile.FullName` and asserts exit code 0) are the exact signatures defined at the bottom of `CliFixtureTests.cs` (`private sealed class CliProjectFixture`) — the code above matches them as written, no adjustment needed.

- [ ] **Step 8: Run the test to verify it fails, then passes**

Run: `dotnet test tests/SliceFx.Cli.Tests --filter "FullyQualifiedName~Route_catalog_decodes_wasi_compatibility_issues_from_a_built_project"`
Expected: this test is written after Steps 3-6 (the decode wiring) are already in place, so it should PASS on first run — confirming the full round trip. If it fails, check the fixture's real `dotnet build` output (surfaced in the assertion message by `BuildAsync`) for generator errors before assuming the decode logic itself is wrong.

- [ ] **Step 9: Run the full CLI test suite**

Run: `dotnet build && dotnet test tests/SliceFx.Cli.Tests --filter "Category!=RequiresPublish"`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add tools/SliceFx.Cli/Internal/RouteCatalog.cs tools/SliceFx.Cli/Internal/GeneratedRouteCatalog.cs tools/SliceFx.Cli/Internal/RouteTargetCapabilities.cs tests/SliceFx.Cli.Tests/CliFixtureTests.cs
git commit -m "feat(cli): decode WASI compatibility issues from the route manifest"
```

---

### Task 4: `slicefx routes` surface — table summary + JSON `issues`

**Files:**
- Modify: `tools/SliceFx.Cli/Commands/ListRoutesCommand.cs`
- Test: `tests/SliceFx.Cli.Tests/CliFixtureTests.cs`

**Interfaces:**
- Consumes: `RouteCapability.Issues` (Task 3).
- Produces: no new public API — this is the terminal presentation layer.

- [ ] **Step 1: Write the failing fixture test for both output formats**

Add to `tests/SliceFx.Cli.Tests/CliFixtureTests.cs`. This codebase's existing tests duplicate fixture setup across facts rather than sharing helpers (see `Route_catalog_prefers_generated_metadata_from_built_project` vs. `Project_option_accepts_directory_path`, each with their own inline project/feature source), so the two facts below each build the same `wasi-issues-app` fixture from Task 3's Step 7 test independently:

```csharp
[Fact]
public async Task Routes_json_output_includes_wasi_compatibility_issues()
{
    using var fixture = CliProjectFixture.Create(
        "wasi-issues-app-json",
        $$"""
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net10.0</TargetFramework>
            <RootNamespace>WasiIssuesApp</RootNamespace>
          </PropertyGroup>
          <ItemGroup>
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.Core", "SliceFx.Core.csproj")}}" />
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.SourceGenerator", "SliceFx.SourceGenerator.csproj")}}" OutputItemType="Analyzer" ReferenceOutputAssembly="false" />
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.Wasi", "SliceFx.Wasi.csproj")}}" />
          </ItemGroup>
        </Project>
        """);
    fixture.WriteFeature(
        "Features/Orders/GetOrder.cs",
        """
        using System.Threading.Tasks;
        using Microsoft.AspNetCore.Http;
        using SliceFx;

        namespace WasiIssuesApp.Features.Orders;

        [Feature("GET /orders/{id}")]
        public static class GetOrder
        {
            public static Task<string> Handle(
                string id,
                [AsParameters] Filter a,
                [AsParameters] Filter b) => Task.FromResult(id);

            public sealed record Filter(string Value);
        }
        """);
    await fixture.BuildAsync();

    var originalOut = Console.Out;
    var writer = new StringWriter();
    Console.SetOut(writer);
    int exitCode;
    try
    {
        exitCode = await ListRoutesCommand.Build()
            .Parse(["--project", fixture.ProjectFile.FullName, "--format", "json"])
            .InvokeAsync(cancellationToken: TestContext.Current.CancellationToken);
    }
    finally
    {
        Console.SetOut(originalOut);
    }

    Assert.Equal(0, exitCode);
    using var document = JsonDocument.Parse(writer.ToString());
    var route = document.RootElement.EnumerateArray().Single();
    var issues = route.GetProperty("capabilities").GetProperty("wasiDispatch").GetProperty("issues");
    Assert.Equal(2, issues.GetArrayLength());
    Assert.Equal("SLICE023", issues[0].GetProperty("code").GetString());
}

[Fact]
public async Task Routes_table_output_summarizes_multiple_issues()
{
    using var fixture = CliProjectFixture.Create(
        "wasi-issues-app-table",
        $$"""
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net10.0</TargetFramework>
            <RootNamespace>WasiIssuesApp</RootNamespace>
          </PropertyGroup>
          <ItemGroup>
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.Core", "SliceFx.Core.csproj")}}" />
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.SourceGenerator", "SliceFx.SourceGenerator.csproj")}}" OutputItemType="Analyzer" ReferenceOutputAssembly="false" />
            <ProjectReference Include="{{Path.Combine(FindRepoRoot(), "src", "SliceFx.Wasi", "SliceFx.Wasi.csproj")}}" />
          </ItemGroup>
        </Project>
        """);
    fixture.WriteFeature(
        "Features/Orders/GetOrder.cs",
        """
        using System.Threading.Tasks;
        using Microsoft.AspNetCore.Http;
        using SliceFx;

        namespace WasiIssuesApp.Features.Orders;

        [Feature("GET /orders/{id}")]
        public static class GetOrder
        {
            public static Task<string> Handle(
                string id,
                [AsParameters] Filter a,
                [AsParameters] Filter b) => Task.FromResult(id);

            public sealed record Filter(string Value);
        }
        """);
    await fixture.BuildAsync();

    var originalOut = Console.Out;
    var writer = new StringWriter();
    Console.SetOut(writer);
    int exitCode;
    try
    {
        exitCode = await ListRoutesCommand.Build()
            .Parse(["--project", fixture.ProjectFile.FullName])
            .InvokeAsync(cancellationToken: TestContext.Current.CancellationToken);
    }
    finally
    {
        Console.SetOut(originalOut);
    }

    Assert.Equal(0, exitCode);
    Assert.Contains("(+1 more)", writer.ToString(), StringComparison.Ordinal);
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/SliceFx.Cli.Tests --filter "FullyQualifiedName~Routes_json_output_includes_wasi_compatibility_issues|FullyQualifiedName~Routes_table_output_summarizes_multiple_issues"`
Expected: FAIL — JSON has no `issues` property yet; table has no `(+1 more)` suffix yet.

- [ ] **Step 3: Add the JSON field**

In `tools/SliceFx.Cli/Commands/ListRoutesCommand.cs`, no explicit code change is needed for the JSON shape itself — `RouteJson.Capabilities` already serializes the full `RouteCapabilities` record (including the now-present `WasiDispatch.Issues`) via the existing `JsonSerializer.Serialize(jsonRoutes, JsonOptions)` call in `WriteJson`, and `JsonOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase` already camel-cases new record properties automatically. Confirm this by re-running Step 2's JSON test now — if it still fails, the compile itself (from Task 3) succeeded but check for a naming mismatch (`Code`/`Category`/`Message` → `code`/`category`/`message`) before writing any new code here.

- [ ] **Step 4: Add the table summary**

In `WriteTable`, change:

```csharp
foreach (var route in routes)
{
    var capabilities = RouteTargetCapabilities.Classify(route);
    var note = capabilities.WasiDispatch.Reason ?? route.PortabilityReason ?? "-";
    if (capabilities.WasiDispatch.Issues.Count > 1)
    {
        note += $" (+{capabilities.WasiDispatch.Issues.Count - 1} more)";
    }

    Console.WriteLine(
        $"{Pad(route.Method, 6)}  {Pad(route.Pattern, 28)}  {Pad(route.EndpointName, 26)}  {Pad(route.SourceAssemblyName ?? "-", 24)}  {Pad(route.Portability, 12)}  {Pad(capabilities.WasiDispatch.Status, 10)}  {note}");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test tests/SliceFx.Cli.Tests --filter "FullyQualifiedName~Routes_json_output_includes_wasi_compatibility_issues|FullyQualifiedName~Routes_table_output_summarizes_multiple_issues"`
Expected: PASS.

- [ ] **Step 6: Run the full test suite and format check**

Run:
```bash
dotnet build
dotnet test SliceFx.slnx --configuration Release --no-build --no-restore --filter "Category!=RequiresPublish"
dotnet format SliceFx.slnx --verify-no-changes --severity info --exclude-diagnostics CS1591 xUnit1004
```
Expected: all PASS (this is the CI-equivalent gate from CLAUDE.md, minus the 10+ minute `RequiresPublish` trim test).

- [ ] **Step 7: Commit**

```bash
git add tools/SliceFx.Cli/Commands/ListRoutesCommand.cs tests/SliceFx.Cli.Tests/CliFixtureTests.cs
git commit -m "feat(cli): surface WASI compatibility issues in slicefx routes output"
```
