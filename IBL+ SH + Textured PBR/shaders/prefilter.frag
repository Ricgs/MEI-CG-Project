#version 460

in vec2 texCoord;
out vec4 FragColor;

uniform sampler2D skyboxHDR;
uniform float roughness;

const float PI = 3.14159265359;

vec2 DirectionToUV(vec3 dir) {
    vec2 uv;
    uv.x = atan(dir.x, dir.z) / (2.0 * PI) + 0.5;
    uv.y = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    return uv;
}

vec3 UVtoDirection(vec2 uv) {
    float phi = uv.x * 2.0 * PI - PI;
    float theta = uv.y * PI - (PI / 2.0);
    vec3 dir;
    dir.x = cos(theta) * sin(phi);
    dir.y = sin(theta);
    dir.z = cos(theta) * cos(phi);
    return normalize(dir);
}

float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10;
}

vec2 Hammersley(uint i, uint N) {
    return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
    float a = roughness * roughness;
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
    
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;
    
    vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);
    
    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}

void main() {
    vec3 N = UVtoDirection(texCoord);
    
    vec3 R = N;
    vec3 V = R;

    const uint SAMPLE_COUNT = 128u;
    vec3 prefilteredColor = vec3(0.0);
    float totalWeight = 0.0;

    float resolution = 1024.0; 
    float saTexel = 4.0 * PI / (6.0 * resolution * resolution);

    for(uint i = 0u; i < SAMPLE_COUNT; ++i) {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0) {
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);

            float a = roughness * roughness;
            float a2 = max(a * a, 0.0001);
            float denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
            float D = a2 / (PI * denom * denom);
            float pdf = (D * NdotH / (4.0 * HdotV)) + 0.0001;

            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);
            float mipLevel = (roughness == 0.0) ? 0.0 : 0.5 * log2(saSample / saTexel);

            vec2 sampleUV = DirectionToUV(L);
            prefilteredColor += textureLod(skyboxHDR, sampleUV, mipLevel).rgb * NdotL;

            totalWeight += NdotL;
        }
    }

    prefilteredColor = prefilteredColor / totalWeight;
    FragColor = vec4(prefilteredColor, 1.0);
}