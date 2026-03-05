#version 460
in Data {
    vec3 normal;
    vec3 lightDir;
    vec3 viewDir;
    vec2 texCoord;
} DataIn;

uniform sampler2D texfloor;

out vec4 outputColor;

void main() {
    vec3 n = normalize(DataIn.normal);
    vec3 l = normalize(DataIn.lightDir);
    
    float intensityDiff = max(dot(n, l), 0.0);
    vec4 corTextura = texture(texfloor, DataIn.texCoord * 30.0);
    
    vec4 ambient = vec4(0.1, 0.1, 0.1, 1.0) * corTextura;
    vec4 diffTerm = corTextura * intensityDiff;
    
    outputColor = ambient + diffTerm;
}