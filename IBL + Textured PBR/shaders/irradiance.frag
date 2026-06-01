#version 330

in vec2 texCoord;
out vec4 FragColor;

uniform sampler2D skyboxHDR;

const float PI = 3.14159265359;

// Função necessária para converter direção 3D para UV da imagem equiretangular 4K
vec2 DirectionToUV(vec3 dir) {
    vec2 uv;
    uv.x = atan(dir.x, dir.z) / (2.0 * PI) + 0.5;
    uv.y = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    return uv;
}

// Converte coordenadas 2D (UV) num vetor de direção 3D para o hemisfério
vec3 UVtoDirection(vec2 uv) {
    float phi = uv.x * 2.0 * PI - PI;
    float theta = uv.y * PI - (PI / 2.0);
    vec3 dir;
    dir.x = cos(theta) * sin(phi);
    dir.y = sin(theta);
    dir.z = cos(theta) * cos(phi);
    return normalize(dir);
}

void main() {
    vec3 N = UVtoDirection(texCoord);
    vec3 irradiance = vec3(0.0);

    vec3 up = vec3(0.0, 1.0, 0.0);
    if(abs(N.y) > 0.999) {
        up = vec3(0.0, 0.0, 1.0);
    }
    vec3 right = normalize(cross(up, N));
    up = normalize(cross(N, right));

    float sampleDelta = 0.025;
    float nrSamples = 0.0; 

    for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
        for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
            
            vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;
            
            // CORREÇÃO: Amostragem direta usando a nova textura equiretangular única
            vec2 skyboxUV = DirectionToUV(sampleVec);
            irradiance += texture(skyboxHDR, skyboxUV).rgb * cos(theta) * sin(theta);
            
            nrSamples++;
        }
    }
    
    irradiance = PI * irradiance * (1.0 / float(nrSamples));
    FragColor = vec4(irradiance, 1.0);
}