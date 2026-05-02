#version 460

in Data {
    vec3 Pos;
    vec3 Normal;
    float Metallic;
    float Roughness;
    vec2 TexCoords;
} DataIn;

uniform int BRDF_model;
uniform int IBL;

uniform vec4 camPos;
uniform vec4 lightPositions[4];
uniform vec4 lightColors[4];
uniform vec4 albedo;
uniform vec4 emissivity;
uniform float baseReflectance;
uniform float specularWeight;
uniform float ao;

uniform samplerCube environmentMap;

out vec4 outputColor;

const float PI = 3.14159265359;

// ==============================================================================
// ==============================================================================
//                         FOR IBL
// ==============================================================================
// ==============================================================================

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
    float m2 = max(m * m, 0.000001);

    float tan2Alpha = max(1.0 - NdotH2, 0.0) / max(NdotH2, 0.000001);

    float numerator = exp(-tan2Alpha / m2);
    float denominator = m2 * NdotH2 * NdotH2;

    return numerator / max(denominator, 0.000001);
}

// Geometry Function
float G_Original(vec3 N, vec3 V, vec3 L, vec3 H) {
    float NdotH = max(dot(N, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float VdotH = max(dot(V, H), 0.000001);

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
    float a2 = max(a * a, 0.000001);
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / max(denom, 0.000001);
}

// Schlick-GGX Geometry Function
float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    return num / max(denom, 0.000001);
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

    vec3 N = normalize(DataIn.Normal);
    vec3 V = normalize(camPos.xyz - DataIn.Pos);

    float NdotV = max(dot(N, V), 0.0001);


    float roughness = DataIn.Roughness;
    float Metallic = DataIn.Metallic;

    float F0_val = max(baseReflectance, 0.04);
    vec3 F0 = mix(vec3(F0_val), albedo.rgb, Metallic);

    float f0_mean = clamp((F0.x + F0.y + F0.z) / 3.0, 0.001, 0.99);
    float n = (1.0 + sqrt(f0_mean)) / (1.0 - sqrt(f0_mean));

    vec3 Lo = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        vec3 L = normalize(lightPositions[i].xyz - DataIn.Pos);
        float NdotL_real = dot(N, L);
        if (NdotL_real <= 0.0) {
            continue; // Ignora esta luz para este pixel
        }
        vec3 H = normalize(V + L);

        float NdotL = clamp(NdotL_real, 0.001, 1.0);
        float NdotH = clamp(dot(N, H), 0.001, 1.0);
        float VdotH = clamp(dot(V, H), 0.001, 1.0);

        float distance = length(lightPositions[i].xyz - DataIn.Pos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = lightColors[i].rgb * attenuation;

        float NDF;
        float G;
        vec3 F;
        vec3 specular;

        switch (BRDF_model) {
            case 0: {
                NDF = D_Original(roughness, N, H);
                G = G_Original(N, V, L, H);
                float f_orig = F_Original(n, V, H); 
                F = vec3(f_orig);

                vec3 numerator = NDF * G * F;
                float denominator = PI * max(NdotV, 0.0) * max(NdotL, 0.0) + 0.0001;
                specular = numerator / denominator;
                break;
            }
            case 1: {
                NDF = D_Modern(roughness, N, H);
                G = G_Modern(N, V, L, roughness);
                F = F_Modern(max(VdotH, 0.0), F0);

                vec3 numerator = NDF * G * F;
                float denominator = 4.0 * max(NdotV, 0.0) * max(NdotL, 0.0) + 0.0001;
                specular = numerator / denominator;
                break;
            }
        }

        vec3 kS = F;
        vec3 kD = max(vec3(1.0) - kS, vec3(0.0));
        kD *= 1.0 - Metallic;

        Lo += (kD * albedo.rgb / PI + specular) * radiance * NdotL;
    }
    float ao = 1.0;
    vec3 ambient = vec3(0.03) * albedo.rgb * ao;
    vec3 color = Lo + ambient;
    
    return color;
}

// ==============================================================================

void main() {

    vec3 debugNormal = normalize(DataIn.Normal) * 0.5 + 0.5;
    
    outputColor = vec4(debugNormal, 1.0);
    
    vec3 color = PBR();
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));
    outputColor = vec4(color, 1.0);
}