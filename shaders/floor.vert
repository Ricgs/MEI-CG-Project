#version 460
in vec4 position;
in vec3 normal;
in vec2 texCoord0;

uniform mat4 m_pvm, m_view, m_model;
uniform mat3 m_normal;
uniform vec4 lightDir;

out Data {
    vec3 normal;
    vec3 lightDir;
    vec3 viewDir;
    vec2 texCoord;
} DataOut;

void main() {
    vec4 posEye = m_view * m_model * position;
    DataOut.normal = normalize(m_normal * normal.xyz);
    DataOut.lightDir = normalize(vec3(m_view * vec4(-lightDir.xyz, 0.0)));
    DataOut.viewDir = normalize(-posEye.xyz);
    DataOut.texCoord = texCoord0;
    gl_Position = m_pvm * position;
}