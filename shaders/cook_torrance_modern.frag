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

out vec4 outputColor;

const float PI = 3.14159265359;

vec3 F(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

float D(float roughness, vec3 N, vec3 H) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / max(denom, 0.000001);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    // Para luzes diretas, mapeia-se o K assim:
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    return num / denom;
}

float G(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = GeometrySchlickGGX(NdotV, roughness);
    float ggx2 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

vec3 PBR() {
    vec3 N = normalize(DataIn.normal);
    vec3 V = normalize(DataIn.cameraPosition - DataIn.fragmentPosition);
    vec3 L = normalize(DataIn.lightDirection);
    vec3 H = normalize(V + L);

    float NdotV = max(dot(N, V), 0.0001);
    float NdotL = max(dot(N, L), 0.0001);

    vec3 F0 = vec3(DataIn.baseflectance);

    float NDF = D(DataIn.roughness, N, H);
    float G   = G(N, V, L, DataIn.roughness);
    vec3 F    = F(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * NdotV * NdotL;
    vec3 specular = numerator / max(denominator, 0.0001);

    vec3 kS = F; 
    vec3 kD = vec3(1.0) - kS; 

    specular *= DataIn.specularWeight;
    kD *= (1.0 - DataIn.specularWeight); 

    vec3 diffuse = DataIn.albedoMesh / PI;

    vec3 BRDF_direct = (kD * diffuse) + specular;

    vec3 directLight = BRDF_direct * DataIn.lightColor * NdotL;

    vec3 ambientLight = DataIn.albedoMesh * 0.1;

    vec3 outgoingLight = DataIn.emissivityMesh + (directLight * PI) + ambientLight;

    return clamp(outgoingLight, 0.0, 1.0); 
}

void main() {

    vec3 debugNormal = normalize(DataIn.normal) * 0.5 + 0.5;
    
    outputColor = vec4(debugNormal, 1.0);
    
    outputColor = vec4(PBR(), 1.0);
}