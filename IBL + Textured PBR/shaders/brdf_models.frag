#version 460

in Data {
    vec3 Pos;
    vec3 Normal;
    vec2 TexCoords;
} DataIn;

uniform int IBL;

uniform vec4 camPos;
uniform vec4 lightPos0, lightPos1, lightPos2, lightPos3;
uniform vec4 lightCol0, lightCol1, lightCol2, lightCol3;
uniform sampler2D albedoMap;
uniform sampler2D normalMap;
uniform sampler2D metallicMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;
uniform float baseReflectance;

//uniform sampler2D irr_posx, irr_negx, irr_posy, irr_negy, irr_posz, irr_negz;
uniform sampler2D skyboxHDR;
uniform sampler2D texIrradianceRT;
uniform sampler2D rad_posx, rad_negx, rad_posy, rad_negy, rad_posz, rad_negz;
uniform sampler2D brdfLUT;

out vec4 outputColor;

const float PI = 3.14159265359;

// ==============================================================================
// ==============================================================================
//                         FOR TEXTURED MODELS
// ==============================================================================
// ==============================================================================

vec3 getNormalFromMap()
{
    vec3 tangentNormal = texture(normalMap, DataIn.TexCoords).xyz * 2.0 - 1.0;

    vec3 Q1  = dFdx(DataIn.Pos);
    vec3 Q2  = dFdy(DataIn.Pos);
    vec2 st1 = dFdx(DataIn.TexCoords);
    vec2 st2 = dFdy(DataIn.TexCoords);

    vec3 N   = normalize(DataIn.Normal);
    vec3 T  = normalize(Q1*st2.t - Q2*st1.t);
    vec3 B  = -normalize(cross(N, T));
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}

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
    // Converte o vetor de reflexão 3D para UV equiretangular
    vec2 uv = DirectionToUV(dir);
    
    // Mapeia a rugosidade (0.0 a 1.0) para um nível de Mipmap (0.0 a max_lod)
    // Como a imagem é 4K, podemos usar um nível máximo de detalhe por volta de 6.0 ou 7.0 para simular superfícies rugosas
    float MAX_LOD = 6.0;
    float lod = roughness * MAX_LOD;
    
    return textureLod(skyboxHDR, uv, lod).rgb;
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

    vec3 albedo     = pow(texture(albedoMap, DataIn.TexCoords).rgb, vec3(2.2));
    float Metallic  = texture(metallicMap, DataIn.TexCoords).r;
    float roughness = texture(roughnessMap, DataIn.TexCoords).r;
    float ao        = texture(aoMap, DataIn.TexCoords).r;

    vec4 lightPositions[4] = vec4[](lightPos0, lightPos1, lightPos2, lightPos3);
    vec4 lightColors[4]    = vec4[](lightCol0, lightCol1, lightCol2, lightCol3);

    vec3 N = getNormalFromMap();
    vec3 V = normalize(camPos.xyz - DataIn.Pos);

    float NdotV = max(dot(N, V), 0.0001);

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
            vec3 diffuseIBL = texture(texIrradianceRT, irradianceUV).rgb * albedo;

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