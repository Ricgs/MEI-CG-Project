#version 460

// input streams
in vec4 position;
in vec3 normal;
in vec2 texCoord0;

uniform mat4 m_pvm, m_view;
uniform mat4 m_model;
uniform mat3 m_normal;
uniform vec4 lightDir;

// Dados para enviar ao Fragment Shader
out Data {
    vec3 normal;
    vec3 lightDir;
    vec3 viewDir;
} DataOut;

void main() {
    
    // 1. Calcular a nova posição baseada no ID da instância
    vec4 offsetPos = position;
    
    // Distância entre cada esfera (ajusta conforme o tamanho da tua esfera)
    float espacamento = 3; 
    
    // Dispor numa grelha de 10x10 usando o gl_InstanceID
    // (Se tiveres 100 instâncias, isto vai de 0 a 99)
    offsetPos.x += (float(gl_InstanceID) - 2.0) * espacamento;

    // 2. Calcular a posição do vértice no espaço de câmara usando a posição com offset
    vec4 posEye = m_view * m_model * offsetPos;

    DataOut.normal = normalize(m_normal * normal.xyz);
    DataOut.lightDir = normalize(vec3(m_view * -lightDir));
    DataOut.viewDir = normalize(-posEye.xyz);

    // 3. Posição final do vértice no ecrã usando a posição com offset
    gl_Position = m_pvm * offsetPos;
}