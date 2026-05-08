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

uniform sampler2D irr_posx, irr_negx, irr_posy, irr_negy, irr_posz, irr_negz;
uniform sampler2D rad_posx, rad_negx, rad_posy, rad_negy, rad_posz, rad_negz;
uniform sampler2D brdfLUT;

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

vec3 GetIrradiance(vec3 dir) {
    vec3 absDir = abs(dir);
    vec2 uv;
    
    // Procura o eixo maior (Face) e calcula o UV projetado
    if(absDir.x >= absDir.y && absDir.x >= absDir.z) {
        if(dir.x > 0.0) { uv = vec2(-dir.z, -dir.y) / absDir.x; return texture(irr_posx, uv * 0.5 + 0.5).rgb; }
        else            { uv = vec2( dir.z, -dir.y) / absDir.x; return texture(irr_negx, uv * 0.5 + 0.5).rgb; }
    } else if(absDir.y >= absDir.x && absDir.y >= absDir.z) {
        if(dir.y > 0.0) { uv = vec2( dir.x,  dir.z) / absDir.y; return texture(irr_posy, uv * 0.5 + 0.5).rgb; }
        else            { uv = vec2( dir.x, -dir.z) / absDir.y; return texture(irr_negy, uv * 0.5 + 0.5).rgb; }
    } else {
        if(dir.z > 0.0) { uv = vec2( dir.x, -dir.y) / absDir.z; return texture(irr_posz, uv * 0.5 + 0.5).rgb; }
        else            { uv = vec2(-dir.x, -dir.y) / absDir.z; return texture(irr_negz, uv * 0.5 + 0.5).rgb; }
    }
}

vec3 GetRadiance(vec3 dir, float roughness) {
    vec3 absDir = abs(dir);
    vec2 uv;
    float MAX_LOD = 5.0; // Ajusta este valor dependendo de quão desfocado queres o máximo
    float lod = roughness * MAX_LOD;

    // Procura o eixo maior, calcula o UV projetado e aplica o textureLod
    if(absDir.x >= absDir.y && absDir.x >= absDir.z) {
        if(dir.x > 0.0) { uv = vec2(-dir.z, -dir.y) / absDir.x; return textureLod(rad_posx, uv * 0.5 + 0.5, lod).rgb; }
        else            { uv = vec2( dir.z, -dir.y) / absDir.x; return textureLod(rad_negx, uv * 0.5 + 0.5, lod).rgb; }
    } else if(absDir.y >= absDir.x && absDir.y >= absDir.z) {
        if(dir.y > 0.0) { uv = vec2( dir.x,  dir.z) / absDir.y; return textureLod(rad_posy, uv * 0.5 + 0.5, lod).rgb; }
        else            { uv = vec2( dir.x, -dir.z) / absDir.y; return textureLod(rad_negy, uv * 0.5 + 0.5, lod).rgb; }
    } else {
        if(dir.z > 0.0) { uv = vec2( dir.x, -dir.y) / absDir.z; return textureLod(rad_posz, uv * 0.5 + 0.5, lod).rgb; }
        else            { uv = vec2(-dir.x, -dir.y) / absDir.z; return textureLod(rad_negz, uv * 0.5 + 0.5, lod).rgb; }
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
            vec3 irradiance = GetIrradiance(N);
            vec3 R = reflect(-V, N);
            vec3 prefilteredColor = GetRadiance(R, roughness);
            vec2 envBRDF  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;

            vec3 F = fresnelSchlickRoughness(F0, max(dot(N, V), 0.0), roughness);
            
            vec3 kS = F;
            vec3 kD = 1.0 - kS;
            kD *= 1.0 - Metallic;	  
            
            vec3 diffuse    = irradiance * albedo.rgb;
            vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
            
            ambient = (kD * diffuse + specular) * ao;
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