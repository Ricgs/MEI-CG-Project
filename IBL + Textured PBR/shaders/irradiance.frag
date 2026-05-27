#version 330

in vec2 texCoord;
out vec4 FragColor;

// Recebemos as 6 texturas separadas em vez de um samplerCube
uniform sampler2D tex_posx;
uniform sampler2D tex_negx;
uniform sampler2D tex_posy;
uniform sampler2D tex_negy;
uniform sampler2D tex_posz;
uniform sampler2D tex_negz;

const float PI = 3.14159265359;

// Função mágica que substitui o samplerCube nativo
vec3 sampleSkybox(vec3 dir) {
    vec3 absDir = abs(dir);
    vec2 uv;
    
    if(absDir.x >= absDir.y && absDir.x >= absDir.z) {
        if(dir.x > 0.0) { uv = vec2(-dir.z, -dir.y) / absDir.x; return texture(tex_posx, uv * 0.5 + 0.5).rgb; }
        else            { uv = vec2( dir.z, -dir.y) / absDir.x; return texture(tex_negx, uv * 0.5 + 0.5).rgb; }
    } else if(absDir.y >= absDir.x && absDir.y >= absDir.z) {
        if(dir.y > 0.0) { uv = vec2( dir.x,  dir.z) / absDir.y; return texture(tex_posy, uv * 0.5 + 0.5).rgb; }
        else            { uv = vec2( dir.x, -dir.z) / absDir.y; return texture(tex_negy, uv * 0.5 + 0.5).rgb; }
    } else {
        if(dir.z > 0.0) { uv = vec2( dir.x, -dir.y) / absDir.z; return texture(tex_posz, uv * 0.5 + 0.5).rgb; }
        else            { uv = vec2(-dir.x, -dir.y) / absDir.z; return texture(tex_negz, uv * 0.5 + 0.5).rgb; }
    }
}

// Converte coordenadas 2D (UV) num vetor de direção 3D
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

            // Lemos usando a nossa função personalizada em vez de 'texture(samplerCube)'
            irradiance += sampleSkybox(sampleVec) * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    
    irradiance = PI * irradiance * (1.0 / float(nrSamples));
    FragColor = vec4(irradiance, 1.0);
}