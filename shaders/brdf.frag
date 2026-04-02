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
    float metallic;
    float sheen;
    float clearcoat;
    float clearcoatGloss;
    float subsurface;
    flat int brdfMode;
} DataIn;

out vec4 outputColor;

uniform samplerCube environmentMap;

const float PI = 3.14159265359;

// Fresnel-Schlick Function
vec3 F(vec3 F0, vec3 V, vec3 H) {
    return F0 + (vec3(1.0) - F0) * pow(clamp(1.0 - max(dot(V, H), 0.0), 0.0, 1.0), 5.0);
}

// Fresnel-Schlick com roughness
vec3 fresnelSchlickRoughness(vec3 F0, float cosTheta, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec2 integratebrdf(float NdotV, float roughness) {
    const vec4 c0 = vec4(-1, -0.0275, -0.572, 0.022);
    const vec4 c1 = vec4( 1,  0.0425,  1.04, -0.04);
    vec4  r   = roughness * c0 + c1;
    float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    return vec2(-1.04, 1.04) * a004 + r.zw;
}

// GGX/Trowbridge-Reitz Normal Distribution Function
float D(float alpha, vec3 N, vec3 H) {

    float numerator = pow(alpha, 2.0);

    float NdotH = max(dot(N, H), 0.0);
    float denominator = PI * pow(pow(NdotH, 2.0) * (pow(alpha, 2.0) - 1.0) + 1.0, 2.0);
    denominator = max(denominator, 0.000001);

    return numerator / denominator;
}

// Schlick-Beckmann Geometry Shadowing Function
float G1(float k, vec3 N, vec3 X) {

    float numerator = max(dot(N, X), 0.0);
    float denominator = max(dot(N, X), 0.0) * (1.0 - k) + k;
    denominator = max(denominator, 0.000001);

    return numerator / denominator;
}

// Smith Model
float G(float roughness, vec3 N, vec3 V, vec3 L) {

    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    return G1(k, N, V) * G1(k, N, L);
}

// Rendering Equation for one light source
vec3 PBR() {

    vec3 N = normalize(DataIn.normal);
    vec3 V = normalize(DataIn.cameraPosition - DataIn.fragmentPosition);
    vec3 L = normalize(-DataIn.lightDirection);
    vec3 H = normalize(V + L);

    vec3  F0    = DataIn.baseflectance;
    float alpha = DataIn.roughness * DataIn.roughness;

    vec3 ks_direct = F(F0, V, H);
    vec3 kd_direct = vec3(1.0) - ks_direct;

    vec3 lambert = DataIn.albedoMesh / PI;

    vec3  cookTorranceNumerator   = D(alpha, N, H) * G(DataIn.roughness, N, V, L) * ks_direct;
    float cookTorranceDenominator = 4.0 * max(dot(V, N), 0.0) * max(dot(L, N), 0.0);
    cookTorranceDenominator = max(cookTorranceDenominator, 0.000001);
    vec3 cookTorrance = cookTorranceNumerator / cookTorranceDenominator;

    vec3 BRDF_direct = kd_direct * lambert + cookTorrance;
    vec3 directLight = BRDF_direct * DataIn.lightColor * max(dot(L, N), 0.0);

    // Calculamos o NdotV (Garante que esta é a ÚNICA vez que declaras 'float NdotV' na função)
    float NdotV = max(dot(N, V), 0.0);

    // 1. Calculamos o Fresnel para o IBL (com injeção de roughness)
    vec3 F_IBL = fresnelSchlickRoughness(F0, NdotV, DataIn.roughness);

    // 2. Cálculo do Specular IBL (com a LUT Analítica / integratebrdf)
    vec3 R = reflect(-V, N);
    R.y = -R.y; 
    const float MAX_REFLECTION_LOD = 5.0;
    vec3 prefilteredColor = textureLod(environmentMap, R, DataIn.roughness * MAX_REFLECTION_LOD).rgb;
    
    vec2 envBRDF = integratebrdf(NdotV, DataIn.roughness);
    vec3 specularIBL = prefilteredColor * (F_IBL * envBRDF.x + envBRDF.y);

    // 3. Cálculo do Diffuse IBL (com conservação de energia correta)
    vec3 kS_IBL = F_IBL; // O Fresnel determina quanta luz é refletida
    vec3 kD_IBL = 1.0 - kS_IBL; // O resto é refratado/difuso
    
    vec3 irradiance = textureLod(environmentMap, N, 5.0).rgb;
    // Multiplicamos por kD_IBL aqui...
    vec3 diffuseIBL = kD_IBL * irradiance * DataIn.albedoMesh;

    // 4. Luz Ambiente Final
    // ... Logo, já não precisamos de multiplicar aqui de novo!
    vec3 ambientLight = diffuseIBL + specularIBL;

    vec3 outgoingLight = DataIn.emissivityMesh + ambientLight + directLight;

    return outgoingLight;
}

void main() {
    outputColor = vec4(PBR(), 1.0);
}
