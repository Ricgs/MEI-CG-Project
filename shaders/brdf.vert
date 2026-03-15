#version 460

in vec4 position;
in vec3 normal;

uniform mat4 m_pvm, m_view, m_model;
uniform mat3 m_normal;

uniform vec3 camPos;
uniform vec3 lightPos;
uniform vec3 lightColorUniform;
uniform vec3 pbr_albedo;
uniform vec3 pbr_emissivity;
uniform float pbr_roughness;
uniform vec3 pbr_baseflectance;

out Data {
    vec3 fragmentPosition;
    vec3 normal;
    vec3 cameraPosition;
    vec3 lightPosition;
    vec3 lightColor;
    vec3 albedoMesh;
    vec3 emissivityMesh;
    float roughness;
    vec3 baseflectance;
} DataOut;

void main() {
    
    vec4 offsetPos = position;
    float espacamento = 3; 
    offsetPos.x += (float(gl_InstanceID) - 2.0) * espacamento;

    vec4 posEye = m_view * m_model * offsetPos;

    DataOut.normal = normalize(m_normal * normal);
    DataOut.cameraPosition = camPos;
    DataOut.lightPosition = lightPos;
    DataOut.lightColor = lightColorUniform;
    DataOut.albedoMesh = pbr_albedo;
    DataOut.emissivityMesh = pbr_emissivity;
    DataOut.roughness = pbr_roughness;
    DataOut.baseflectance = pbr_baseflectance;

    gl_Position = m_pvm * offsetPos;
}