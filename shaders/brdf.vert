#version 460

in vec4 position;
in vec3 normal;

uniform mat4 m_pvm, m_view, m_model;
uniform mat3 m_normal;
uniform vec4 lightDir;

out Data {
    vec3 normal;
    vec3 lightDir;
    vec3 viewDir;
} DataOut;

void main() {
    
    // 1. Calcular a nova posição baseada no ID da instância
    vec4 offsetPos = position;
    float espacamento = 3; 
    offsetPos.x += (float(gl_InstanceID) - 2.0) * espacamento;

    // 2. Calcular a posição do vértice no espaço de câmara usando a posição com offset
    vec4 posEye = m_view * m_model * offsetPos;

    DataOut.normal = normalize(m_normal * normal);
    DataOut.lightDir = normalize(vec3(m_view * -lightDir));
    DataOut.viewDir = normalize(-posEye.xyz);

    // 3. Posição final do vértice no ecrã usando a posição com offset
    gl_Position = m_pvm * offsetPos;
}