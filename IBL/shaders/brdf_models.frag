#version 460

in Data {
    vec3 Pos;
    vec3 Normal;
    float Metallic;
    float Roughness;
} DataIn;

uniform int IBL;

uniform vec4 camPos;
uniform vec4 lightPos0, lightPos1, lightPos2, lightPos3;
uniform vec4 lightCol0, lightCol1, lightCol2, lightCol3;
uniform vec4 albedo;
uniform vec4 emissivity;
uniform float baseReflectance;
uniform float specularWeight;
uniform float ao;

uniform sampler2D skyboxHDR;
uniform sampler2D texIrradianceRT;
uniform sampler2D brdfLUT;

uniform sampler2D prefilterMap_0; // Roughness 0.00
uniform sampler2D prefilterMap_1; // Roughness 0.25
uniform sampler2D prefilterMap_2; // Roughness 0.50
uniform sampler2D prefilterMap_3; // Roughness 0.75
uniform sampler2D prefilterMap_4; // Roughness 1.00

out vec4 outputColor;

const float PI = 3.14159265359;

// ==============================================================================
// ==============================================================================
//                         FOR IBL
// ==============================================================================
// ==============================================================================

vec2 DirectionToUV(vec3 dir) {
    vec2 uv;
    uv.x = atan(dir.x, dir.z) / (2.0 * PI) + 0.5;
    uv.y = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    return uv;
}

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

vec3 GetRadiance(vec3 dir, float roughness) {
    vec2 uv = DirectionToUV(dir);
    
    // Amostra das 5 texturas
    vec3 color0 = texture(prefilterMap_0, uv).rgb;
    vec3 color1 = texture(prefilterMap_1, uv).rgb;
    vec3 color2 = texture(prefilterMap_2, uv).rgb;
    vec3 color3 = texture(prefilterMap_3, uv).rgb;
    vec3 color4 = texture(prefilterMap_4, uv).rgb;

    // Interpola com base no valor de rugosidade
    if (roughness < 0.25) {
        return mix(color0, color1, roughness / 0.25);
    } else if (roughness < 0.50) {
        return mix(color1, color2, (roughness - 0.25) / 0.25);
    } else if (roughness < 0.75) {
        return mix(color2, color3, (roughness - 0.50) / 0.25);
    } else {
        return mix(color3, color4, (roughness - 0.75) / 0.25);
    }
}

// ==============================================================================
// ==============================================================================
//                          MODERN COOK-TORRANCE (GGX)
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
//                          RENDERING EQUATION (PBR)
// ==============================================================================
// ==============================================================================

vec3 PBR() {

    vec4 lightPositions[4] = vec4[](lightPos0, lightPos1, lightPos2, lightPos3);
    vec4 lightColors[4]    = vec4[](lightCol0, lightCol1, lightCol2, lightCol3);
    
    vec3 N = normalize(DataIn.Normal);
    vec3 V = normalize(camPos.xyz - DataIn.Pos);

    float NdotV = max(dot(N, V), 0.0001);

    float roughness = DataIn.Roughness;
    float Metallic = DataIn.Metallic;
    float ao = 1.0;

    float F0_val = max(baseReflectance, 0.04);
    vec3 F0 = mix(vec3(F0_val), albedo.rgb, Metallic);

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

        float NDF = D_Modern(roughness, N, H);
        float G = G_Modern(N, V, L, roughness);
        vec3 F = F_Modern(max(VdotH, 0.0), F0);

        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(NdotV, 0.0) * max(NdotL, 0.0) + 0.0001;
        vec3 specular = numerator / denominator;

        vec3 kS = F;
        vec3 kD = max(vec3(1.0) - kS, vec3(0.0));
        kD *= 1.0 - Metallic;

        Lo += (kD * albedo.rgb / PI + specular) * radiance * NdotL;
    }
    
    vec3 ambient;

    switch (IBL) {
        case 0:{
            ambient = vec3(0.03) * albedo.rgb * ao;
            break;
        }
        
        case 1:{
            vec2 irradianceUV = DirectionToUV(N);
            vec3 diffuseIBL = texture(texIrradianceRT, irradianceUV).rgb * albedo.rgb;

            vec3 R = reflect(-V, N);
            vec3 prefilteredColor = GetRadiance(R, roughness);
            vec2 envBRDF  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;

            vec3 F = fresnelSchlickRoughness(F0, max(dot(N, V), 0.0), roughness);
            
            vec3 kS = F;
            vec3 kD = 1.0 - kS;
            kD *= 1.0 - Metallic;	  
            
            vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
            
            ambient = (kD * diffuseIBL + specular) * ao;
            break;
        }
    }

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