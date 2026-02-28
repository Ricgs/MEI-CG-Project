#version 460

// Recebe dados do Vertex Shader
in Data {
    vec3 normal;
    vec3 lightDir;
    vec3 viewDir;
} DataIn;

// Recebe variaveis do XML (Interface)
uniform vec4 diffuse;
uniform vec4 specular;
uniform float shininess;

out vec4 outputColor;

void main() {
    // Renormalizar os vetores interpolados
    vec3 n = normalize(DataIn.normal);
    vec3 l = normalize(DataIn.lightDir);
    vec3 v = normalize(DataIn.viewDir);

    // --- BRDF DIFUSA (LAMBERT) ---
    // Intensidade depende do ângulo entre Normal e Luz
    float intensityDiff = max(dot(n, l), 0.0);
    vec4 diffTerm = diffuse * intensityDiff;

    // --- BRDF ESPECULAR (BLINN-PHONG) ---
    // Usa o vetor Halfway (H)
    vec3 h = normalize(l + v);
    float intensitySpec = pow(max(dot(n, h), 0.0), shininess);
    vec4 specTerm = specular * intensitySpec;

    // --- COMBINAÇÃO FINAL ---
    // Ambiente simples (constante) + Difusa + Especular
    vec4 ambient = vec4(0.1, 0.1, 0.1, 1.0) * diffuse;
    
    outputColor = ambient + diffTerm + specTerm;
}