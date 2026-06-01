#version 460

uniform sampler2D tex_skybox_hdr;
in vec4 pos;

out vec4 color;

const float PI = 3.14159265359;

vec2 DirectionToUV(vec3 dir) {
    vec2 uv;
    uv.x = atan(dir.x, dir.z) / (2.0 * PI) + 0.5;
    uv.y = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    return uv;
}

void main() {

    vec3 dir = normalize(vec3(pos));
    vec2 uv = DirectionToUV(dir); // Usa a função acima!
    color = texture(tex_skybox_hdr, uv);
}