-- Parâmetros da esfera
local slices = 64 -- Detalhe horizontal
local stacks = 64 -- Detalhe vertical
local radius = 1.0

-- Abre o ficheiro para escrita
local file = io.open("../models/sphere.obj", "w")
file:write("# Esfera gerada em Lua para a Nau3D (Instanciamento)\n")
file:write("o Esfera\n")

-- 1. Gerar Vértices (v) e Normais (vn)
for i = 0, stacks do
    local phi = math.pi * (i / stacks)
    local cosPhi = math.cos(phi)
    local sinPhi = math.sin(phi)

    for j = 0, slices do
        local theta = 2.0 * math.pi * (j / slices)
        local cosTheta = math.cos(theta)
        local sinTheta = math.sin(theta)

        -- Cálculo da normal (numa esfera na origem, a normal é igual à posição normalizada)
        local nx = sinPhi * cosTheta
        local ny = cosPhi
        local nz = sinPhi * sinTheta

        -- Cálculo da posição
        local vx = radius * nx
        local vy = radius * ny
        local vz = radius * nz

        file:write(string.format("v %f %f %f\n", vx, vy, vz))
        file:write(string.format("vn %f %f %f\n", nx, ny, nz))
    end
end

-- 2. Gerar Faces (f) com índices (v//vn)
for i = 0, stacks - 1 do
    for j = 0, slices - 1 do
        -- A indexação no formato OBJ começa em 1
        local first = (i * (slices + 1)) + j + 1
        local second = first + (slices + 1)

        -- Criar dois triângulos por cada "quadrado" da grelha
        -- Triângulo 1
        file:write(string.format("f %d//%d %d//%d %d//%d\n", 
            first, first, 
            second, second, 
            first + 1, first + 1))
            
        -- Triângulo 2
        file:write(string.format("f %d//%d %d//%d %d//%d\n", 
            second, second, 
            second + 1, second + 1, 
            first + 1, first + 1))
    end
end

file:close()
print("Ficheiro 'esfera.obj' gerado com sucesso com " .. slices .. " slices e " .. stacks .. " stacks!")