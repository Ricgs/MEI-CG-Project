#version 460

uniform mat4 m_pvm;
uniform vec4 cam_pos;

in vec4 position;
in vec2 texCoord0;
in vec3 normal;

out vec2 tc;
out vec4 pos;
out vec3 n;

void main() {

    n = normal;
    tc = texCoord0;
    pos = position;
    gl_Position = m_pvm * vec4(vec3(position + cam_pos), 1.0);
}