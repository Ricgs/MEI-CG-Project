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

// Fresnel Function
float F(float n, vec3 V, vec3 H) {
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
float D(float m, vec3 N, vec3 H) {
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
float G(vec3 N, vec3 V, vec3 L, vec3 H) {
    float NdotH = max(dot(N, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float VdotH = max(dot(V, H), 0.000001); // Evitar divisão por zero

    float masking = (2.0 * NdotH * NdotV) / VdotH;
    float shadowing = (2.0 * NdotH * NdotL) / VdotH;

    return min(1.0, min(masking, shadowing));
}

// Rendering Equation for one light source
vec3 PBR() {

    // Main vectors
    vec3 N = normalize(DataIn.normal);
    vec3 V = normalize(DataIn.cameraPosition - DataIn.fragmentPosition);
    vec3 L = normalize(DataIn.lightDirection);
    vec3 H = normalize(V + L);

    float alpha = DataIn.roughness;
    float F0 = DataIn.baseflectance;

    float n_derived = (1.0 + sqrt(F0)) / max((1.0 - sqrt(F0)), 0.0001);

    float s = DataIn.specularWeight;
    float d = 1.0 - s;

    float NdotV = max(dot(N, V), 0.001); 
    float NdotL = max(dot(N, L), 0.001);

    float Rs_num = D(alpha, N, H) * G(N, V, L, H) * F(n_derived, V, H);
    float Rs_den = PI * NdotV * NdotL;
    Rs_den = max(Rs_den, 0.000001);
    
    vec3 Rs = vec3(Rs_num / Rs_den);

    vec3 Rd = DataIn.albedoMesh / PI;

    vec3 BRDF_direct = (s * Rs) + (d * Rd);

    vec3 directLight = BRDF_direct * (DataIn.lightColor * PI) * max(dot(L, N), 0.0);

    vec3 ambientLight = DataIn.albedoMesh * 0.1;
    vec3 outgoingLight = DataIn.emissivityMesh + directLight + ambientLight;

    return outgoingLight;
}

void main() {

    vec3 debugNormal = normalize(DataIn.normal) * 0.5 + 0.5;
    
    outputColor = vec4(debugNormal, 1.0);
    
    outputColor = vec4(PBR(), 1.0);
}