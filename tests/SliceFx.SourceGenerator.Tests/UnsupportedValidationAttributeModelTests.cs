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
