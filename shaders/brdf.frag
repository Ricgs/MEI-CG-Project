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

uniform samplerCube environmentMap;

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
    
    vec3 ks_direct = F(F0, V, H);
    vec3 kd_direct = vec3(1.0) - ks_direct;

    vec3 lambert = DataIn.albedoMesh / PI;

    vec3 cookTorranceNumerator = D(alpha, N, H) * G(alpha, N, V, L) * ks_direct;
    float cookTorranceDenominator = 4.0 * max(dot(V, N), 0.0) * max(dot(L, N), 0.0);
    cookTorranceDenominator = max(cookTorranceDenominator, 0.000001);
    vec3 cookTorrance = cookTorranceNumerator / cookTorranceDenominator;

    vec3 BRDF_direct = kd_direct * lambert + cookTorrance;
    vec3 directLight = BRDF_direct * DataIn.lightColor * max(dot(L, N), 0.0);

    // -----------------------------------------------------------------------
    // 2. ILUMINAÇÃO AMBIENTE (IBL Simplificado)
    // -----------------------------------------------------------------------
    // Para a luz ambiente, como a luz vem de todas as direções, não há um único vetor 'H' (Half-vector).
    // Usamos a Normal (N) e a Visão (V) como aproximação na função de Fresnel.
    vec3 ks_env = F(F0, N, V);
    vec3 kd_env = vec3(1.0) - ks_env;

    // A. Irradiância (Luz Difusa Ambiente)
    // Usamos o textureLod com um valor alto (5.0) para amostrar uma versão muito desfocada do Cubemap
    vec3 irradiance = textureLod(environmentMap, N, 5.0).rgb;
    vec3 diffuseIBL = irradiance * DataIn.albedoMesh;

    // B. Reflexo Especular (Luz Especular Ambiente)
    vec3 R = reflect(V, N); // O vetor que "espelha" a nossa câmara
    const float MAX_REFLECTION_LOD = 5.0; // Assume-se que o teu Cubemap gerou pelo menos 5 níveis de mipmap
    // O roughness determina quão nítido ou desfocado é o reflexo (0.0 = mipmap 0, 1.0 = mipmap 5)
    vec3 prefilteredColor = textureLod(environmentMap, R, DataIn.roughness * MAX_REFLECTION_LOD).rgb;
    
    // Multiplicamos o reflexo pela componente especular de Fresnel
    vec3 specularIBL = prefilteredColor * ks_env; 

    // Somamos a luz difusa e especular do ambiente
    vec3 ambientLight = (kd_env * diffuseIBL) + specularIBL;

    // -----------------------------------------------------------------------
    // 3. RESULTADO FINAL
    // -----------------------------------------------------------------------
    // Luz de saída = Emissividade + Luz do Ambiente + Luz do Sol
    vec3 outgoingLight = DataIn.emissivityMesh + ambientLight + directLight;

    return outgoingLight;
}

void main() {

    vec3 debugNormal = normalize(DataIn.normal) * 0.5 + 0.5;
    
    outputColor = vec4(debugNormal, 1.0);
    
    outputColor = vec4(PBR(), 1.0);
}