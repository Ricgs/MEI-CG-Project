#version 460

in vec4 position;
in vec3 normal;

uniform mat4 m_pvm, m_view, m_model;
uniform mat3 m_normal;

uniform vec3 camPos;
uniform vec3 lightDir;
uniform vec3 lightColorUniform;
uniform vec4 pbr_albedo;
uniform vec4 pbr_emissivity;
uniform float pbr_roughness; // não usado diretamente — overriden por coluna
uniform vec4 pbr_baseflectance;
uniform float pbr_metallic;
uniform float pbr_sheen;
uniform float pbr_clearcoat;
uniform float pbr_clearcoatGloss;
uniform float pbr_subsurface;

const int NUM_COLS = 10;   // roughness 0.1 → 1.0
const int NUM_ROWS = 5;    // 0=Lambertian 1=Phong 2=CookTorrance-GGX 3=Oren-Nayar 4=Disney

const float SPACING_X = 2.6;
const float SPACING_Z = 2.6;

out Data {
    vec3 fragmentPosition;
    vec3 normal;
    vec3 cameraPosition;
    vec3 lightDirection;
    vec3 lightColor;
    vec3 albedoMesh;
    vec3 emissivityMesh;
    float roughness;
    vec3 baseflectance;
    float metallic;
    float sheen;
    float clearcoat;
    float clearcoatGloss;
    float subsurface;
    flat int brdfMode;
} DataOut;

void main() {
    
    int col      = gl_InstanceID % NUM_COLS; 
    int row      = gl_InstanceID / NUM_COLS; 

    float instanceRoughness = (float(col) + 1.0) / float(NUM_COLS);

    vec4 offsetPos  = position;
    offsetPos.x    += (float(col) - float(NUM_COLS - 1) * 0.5) * SPACING_X;
    offsetPos.z    += (float(row) - float(NUM_ROWS - 1) * 0.5) * SPACING_Z;

    DataOut.fragmentPosition = vec3(m_model * offsetPos);
    DataOut.normal = normalize(mat3(m_model) * normal);
    DataOut.cameraPosition = camPos;
    DataOut.lightDirection = lightDir;
    DataOut.lightColor = lightColorUniform;
    DataOut.albedoMesh = pbr_albedo.rgb;
    DataOut.emissivityMesh = pbr_emissivity.rgb;
    DataOut.roughness = instanceRoughness * 3;
    DataOut.baseflectance = pbr_baseflectance.rgb;
    DataOut.metallic         = pbr_metallic;
    DataOut.sheen            = pbr_sheen;
    DataOut.clearcoat        = pbr_clearcoat;
    DataOut.clearcoatGloss   = pbr_clearcoatGloss;
    DataOut.subsurface       = pbr_subsurface;
    DataOut.brdfMode         = row;

    gl_Position = m_pvm * offsetPos;
}