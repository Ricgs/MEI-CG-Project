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
    float baseflectance;
    float specularWeight;
} DataIn;

uniform int BRDF_model;
uniform int IBL;

uniform samplerCube environmentMap;

out vec4 outputColor;

const float PI = 3.14159265359;

// ==============================================================================
// ==============================================================================
//                         1. ORIGINAL COOK-TORRANCE
// ==============================================================================
// ==============================================================================

// Fresnel Function
float F_Original(float n, vec3 V, vec3 H) {
    float c = max(dot(V, H), 0.0);
    float g2 = n * n + c * c - 1.0;
    float g = sqrt(max(g2, 0.0));

    float gMinusC = g - c;
    float gPlusC = max(g + c, 0.000001);

    float termo1 = (gMinusC * gMinusC) / (gPlusC * gPlusC);

    float termo2_num = (c * gPlusC - 1.0);
    float termo2_den = (c * gMinusC + 1.0);
    float termo2 = 1.0 + (termo2_num * termo2_num) / (termo2_den * termo2_den);

    return 0.5 * termo1 * termo2;
}

// Beckmann Normal Distribution Function
float D_Original(float m, vec3 N, vec3 H) {
    float NdotH = clamp(dot(N, H), 0.000001, 1.0);
    float NdotH2 = NdotH * NdotH;
    float m2 = m * m;

    // Identidade trigonométrica: tan^2(alpha) = (1 - cos^2(alpha)) / cos^2(alpha)
    float tan2Alpha = max(1.0 - NdotH2, 0.0) / max(NdotH2, 0.000001);

    float numerator = exp(-tan2Alpha / m2);
    float denominator = m2 * NdotH2 * NdotH2;

    return numerator / denominator;
}

// Função Geométrica Original de Cook-Torrance (V-Cavities)
float G_Original(vec3 N, vec3 V, vec3 L, vec3 H) {
    float NdotH = max(dot(N, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float VdotH = max(dot(V, H), 0.000001); // Evitar divisão por zero

    float masking = (2.0 * NdotH * NdotV) / VdotH;
    float shadowing = (2.0 * NdotH * NdotL) / VdotH;

    return min(1.0, min(masking, shadowing));
}

// ==============================================================================
// ==============================================================================
//                          2. MODERN COOK-TORRANCE (GGX)
// ==============================================================================
// ==============================================================================

// Fresnel-Schlick
vec3 F_Modern(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Trowbridge-Reitz GGX Normal Distribution Function
float D_Modern(float roughness, vec3 N, vec3 H) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / max(denom, 0.000001);
}

// Schlick-GGX Geometry Function
float GeometrySchlickGGX(float NdotV, float roughness) {
    // Para luzes diretas, mapeia-se o K assim:
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    return num / denom;
}

// Smith Geometry Function
float G_Modern(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = GeometrySchlickGGX(NdotV, roughness);
    float ggx2 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

// ==============================================================================
// ==============================================================================
//                          3. RENDERING EQUATION (PBR)
// ==============================================================================
// ==============================================================================

vec3 PBR() {

    // Main vectors
    vec3 N = normalize(DataIn.normal);
    vec3 V = normalize(DataIn.cameraPosition - DataIn.fragmentPosition);
    vec3 L = normalize(DataIn.lightDirection);
    vec3 H = normalize(V + L);

    float tweakedRoughness = DataIn.roughness * DataIn.roughness;
    float alpha = max(tweakedRoughness, 0.01);
    float F0_val = DataIn.baseflectance;
    vec3 F0 = vec3(F0_val);
    
    float NdotV = max(dot(N, V), 0.001);
    float NdotL = max(dot(N, L), 0.001);

    vec3 Rs = vec3(0.0);
    vec3 Rd = DataIn.albedoMesh / PI;

    // Model selection
    switch (BRDF_model) {
        case 0: {
            // --------------------------------------------------
            // ORIGINAL COOK-TORRANCE
            // --------------------------------------------------
            float n_derived = (1.0 + sqrt(F0_val)) / max((1.0 - sqrt(F0_val)), 0.0001);

            float D_val = D_Original(alpha, N, H);
            float G_val = G_Original(N, V, L, H);
            float F_val = F_Original(n_derived, V, H);

            float Rs_num = D_val * G_val * F_val;
            float Rs_den = PI * NdotV * NdotL;
            
            Rs = vec3(Rs_num / max(Rs_den, 0.000001));
            break;
        }

        case 1: {
            // --------------------------------------------------
            // MODERN COOK-TORRANCE (GGX + SCHLICK)
            // --------------------------------------------------
            float D_val = D_Modern(alpha, N, H);
            float G_val = G_Modern(N, V, L, alpha);
            vec3 F_val = F_Modern(max(dot(H, V), 0.0), F0);

            vec3 Rs_num = D_val * G_val * F_val;
            float Rs_den = 4.0 * NdotV * NdotL;
            
            Rs = Rs_num / max(Rs_den, 0.000001);
            break;
        }
    }

    float s = DataIn.specularWeight;
    float d = 1.0 - s;
    vec3 BRDF_direct = (s * Rs) + (d * Rd);

    vec3 directLight = BRDF_direct * (DataIn.lightColor * PI) * max(dot(L, N), 0.0);
    vec3 ambientLight = vec3(0.0);

    switch (IBL) {
        case 0:
            ambientLight = DataIn.albedoMesh * 0.1; 
            break;

        case 1: {
            vec3 ks_env = F_Modern(max(dot(N, V), 0.0), F0);
            vec3 kd_env = vec3(1.0) - ks_env;

            vec3 sampleN = vec3(-N.x, -N.y, N.z);
            vec3 irradiance = textureLod(environmentMap, sampleN, 5.0).rgb;
            vec3 diffuseIBL = irradiance * DataIn.albedoMesh;

            vec3 R = reflect(-V, N); 
            vec3 sampleR = vec3(-R.x, -R.y, R.z);
            const float MAX_REFLECTION_LOD = 5.0; 
            
            vec3 prefilteredColor = textureLod(environmentMap, sampleR, alpha * MAX_REFLECTION_LOD).rgb;
            
            vec3 specularIBL = prefilteredColor * ks_env; 

            ambientLight = (kd_env * diffuseIBL) + specularIBL;
            break;
        }
    }

    vec3 outgoingLight = DataIn.emissivityMesh + directLight + ambientLight;

    return outgoingLight;
}

// ==============================================================================

void main() {

    vec3 debugNormal = normalize(DataIn.normal) * 0.5 + 0.5;
    
    outputColor = vec4(debugNormal, 1.0);
    
    outputColor = vec4(PBR(), 1.0);
}