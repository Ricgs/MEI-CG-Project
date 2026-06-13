#version 460

in vec4 position;
in vec3 normal;
in vec2 texCoord0;

uniform mat4 m_pvm, m_view, m_model;
uniform mat3 m_normal;

out Data {
    vec3 Pos;
    vec3 Normal;
    vec2 TexCoords;
} DataOut;

void main() {
    
    int row = gl_InstanceID / 7;
    int col = gl_InstanceID % 7;

    float spacing = 2.5;

    vec3 offset = vec3(
        (float(col) - 3.0) * spacing, 
        (float(row) - 3.0) * spacing, 
        0.0
    );

    vec4 localPos = position + vec4(offset, 0.0);
    DataOut.Pos = vec3(m_model * localPos);
    mat3 normalMatrix = transpose(inverse(mat3(m_model)));
    DataOut.Normal = normalMatrix * normal;
    DataOut.TexCoords = texCoord0;

    gl_Position = m_pvm * localPos;
}