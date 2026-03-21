#version 460

in Data {
    vec3 fragmentPosition;
    vec3 normal;
    vec3 cameraPosition;
    vec3 lightDirection;
    vec3 lightColor;
    vec3 albedoMesh;
    vec3 emissivityMesh;
    float roughness;
    vec3 baseflectance;
} DataIn;

out vec4 outputColor;

const float PI = 3.14159265359;

// Fresnel-Schlick Function
vec3 F(vec3 F0, vec3 V, vec3 H) {

    return F0 + (vec3(1.0) - F0) * pow(1.0 - max(dot(V, H), 0.0), 5.0);
}

// GGX/Trowbridge-Reitz Normal Distribution Function
float D(float alpha, vec3 N, vec3 H) {

    float numerator = pow(alpha, 2.0);

    float NdotH = max(dot(N,H), 0.0);
    float denominator = PI * pow(pow(NdotH, 2.0) * (pow(alpha, 2.0) - 1.0) + 1.0, 2.0);
    denominator = max(denominator, 0.000001);

    return numerator/denominator;
}

// Schlick-Beckmann Geometry Shadowing Function
float G1(float alpha, vec3 N, vec3 X) {

    float numerator = max(dot(N, X), 0.0);

    float k = alpha / 2.0;
    float denominator = max(dot(N, X), 0.0) * (1.0 - k) + k;
    denominator = max(denominator, 0.000001);

    return numerator / denominator;
}

// Smith Model
float G(float alpha, vec3 N, vec3 V, vec3 L) {

    return G1(alpha, N, V) * G1(alpha, N, L);
}

// Rendering Equation for one light source
vec3 PBR() {

    // Main vectors
    vec3 N = normalize(DataIn.normal);
    vec3 V = normalize(DataIn.cameraPosition - DataIn.fragmentPosition);
    // For directional lights
    vec3 L = normalize(-DataIn.lightDirection);
    vec3 H = normalize(V + L);

    vec3 F0 = DataIn.baseflectance;
    float alpha = DataIn.roughness * DataIn.roughness;
    
    vec3 ks = F(F0, V, H);
    vec3 kd = vec3(1.0) - ks;

    vec3 lambert = DataIn.albedoMesh / PI;

    vec3 cookTorranceNumerator = D(alpha, N, H) * G(alpha, N, V, L) * ks;
    float cookTorranceDenominator = 4.0 * max(dot(V, N), 0.0) * max(dot(L, N), 0.0);
    cookTorranceDenominator = max(cookTorranceDenominator, 0.000001);
    vec3 cookTorrance = cookTorranceNumerator / cookTorranceDenominator;

    vec3 BRDF = kd * lambert + cookTorrance;
    vec3 outgoingLight = DataIn.emissivityMesh + (BRDF * DataIn.lightColor * max(dot(L, N), 0.0));

    return outgoingLight;
}

void main() {

    vec3 debugNormal = normalize(DataIn.normal) * 0.5 + 0.5;
    
    outputColor = vec4(debugNormal, 1.0);
    
    outputColor = vec4(PBR(), 1.0);
}