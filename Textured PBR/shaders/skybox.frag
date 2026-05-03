#version 460

uniform sampler2D tex_back, tex_left, tex_front,
                    tex_right, tex_top, tex_bottom;
uniform samplerCube tex_cm;
in vec2 tc;
in vec4 pos;
in vec3 n;

out vec4 color;

const bool USE_CUBE_MAP = false;

void main() {

    if (USE_CUBE_MAP == false) {
        vec3 a = abs(n);
        float m = max(a.x,max(a.y,a.z));

        if (m == a.z) {
            if (pos.z < 0)
                color = texture(tex_back, vec2(tc.s, 1-tc.t));
            else 
                color = texture(tex_front, vec2(tc.s, 1-tc.t));
        }
        else if (m == a.x) {
            if (pos.x < 0)
                color = texture(tex_left, vec2(tc.s, 1-tc.t));
            else

                color = texture(tex_right, vec2(tc.s, 1-tc.t));
        }
        else {
            if (pos.y > 0)
                color = texture(tex_top, vec2(tc.s, 1-tc.t));
            else
                color = texture(tex_bottom, vec2(tc.s, 1-tc.t));
        }
    }
    else {
        color = texture(tex_cm, normalize(vec3(pos)));
    }
}