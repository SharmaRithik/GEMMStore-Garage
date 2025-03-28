// Matrix dimensions
let MATRIX_SIZE = 256;
let NUM_VERIFICATION_CHECKS = 50;

// Default shader code
const getDefaultShaderCode = () => `
const BLOCK_DIM_X = 16u;
const BLOCK_DIM_Y = 16u;

struct Matrix {
    size : vec2u,
    numbers : array<f32>,
};

struct Uniforms {
    M : u32,
    N : u32,
    K : u32,
    alpha : f32,
    beta : f32,
};

@group(0) @binding(0) var<storage, read> A : Matrix;
@group(0) @binding(1) var<storage, read> B : Matrix;
@group(0) @binding(2) var<storage, read_write> C : Matrix;
@group(0) @binding(3) var<uniform> uniforms : Uniforms;

@compute @workgroup_size(16, 16)
fn main(
    @builtin(workgroup_id) blockIdx : vec3<u32>,
    @builtin(local_invocation_id) threadIdx : vec3<u32>
) {
    let x = blockIdx.x * BLOCK_DIM_X + threadIdx.x;
    let y = blockIdx.y * BLOCK_DIM_Y + threadIdx.y;

    if (x < uniforms.M && y < uniforms.N) {
        var tmp: f32 = 0.0;
        for (var i: u32 = 0u; i < uniforms.K; i = i + 1u) {
            tmp = tmp + A.numbers[x * uniforms.K + i] * B.numbers[i * uniforms.N + y];
        }
        let idx = x * uniforms.N + y;
        C.numbers[idx] = uniforms.alpha * tmp + uniforms.beta * C.numbers[idx];
    }
}`;

// Initialize CodeMirror with the default shader code
const editor = CodeMirror.fromTextArea(document.getElementById("shader-editor"), {
    mode: "javascript",
    theme: "monokai",
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: true,
    extraKeys: {
        "TouchEvent": { passive: true },
        "WheelEvent": { passive: true }
    },
    value: getDefaultShaderCode()
});

// Set the initial content
editor.setValue(getDefaultShaderCode());

// Check WebGPU support
const webgpuStatus = document.getElementById('webgpu-status');

async function checkWebGPUSupport() {
    if (!navigator.gpu) {
        webgpuStatus.textContent = '(WebGPU not supported in this browser)';
        webgpuStatus.classList.add('not-supported');
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            webgpuStatus.textContent = '(No WebGPU adapter found)';
            webgpuStatus.classList.add('not-supported');
            return false;
        }

        // Just show that WebGPU is enabled without trying to access specific adapter properties
        webgpuStatus.textContent = '(WebGPU Enabled)';
        webgpuStatus.classList.add('supported');
        return true;
    } catch (error) {
        webgpuStatus.textContent = `(${error.message})`;
        webgpuStatus.classList.add('not-supported');
        return false;
    }
}

// Call the check immediately
checkWebGPUSupport();

function generateRandomMatrix(size) {
    const matrix = new Float32Array(size * size);
    for (let i = 0; i < matrix.length; i++) {
        matrix[i] = Math.random() * 2 - 1;
    }
    return matrix;
}

function getCPUResult(firstMatrix, secondMatrix, M, N, K, row, col) {
    let sum = 0;
    for (let k = 0; k < K; k++) {
        sum += firstMatrix[row * K + k] * secondMatrix[k * N + col];
    }
    return sum;
}

function verifyResults(firstMatrix, secondMatrix, gpuResult, M, N, K) {
    const results = [];
    const positions = new Set();
    
    // Generate random positions
    while(positions.size < NUM_VERIFICATION_CHECKS) {
        const row = Math.floor(Math.random() * M);
        const col = Math.floor(Math.random() * N);
        positions.add(`${row},${col}`);
    }
    
    // Verify each position
    for(const pos of positions) {
        const [row, col] = pos.split(',').map(Number);
        const cpuResult = getCPUResult(firstMatrix, secondMatrix, M, N, K, row, col);
        const gpuResultVal = gpuResult[row * N + col];
        const diff = Math.abs(cpuResult - gpuResultVal);
        const isCorrect = diff < 0.01; // Allow small floating-point differences
        
        results.push({
            row,
            col,
            cpuResult,
            gpuResult: gpuResultVal,
            isCorrect,
            diff
        });
    }

    return results;
}

function displayMatrix(matrix, containerId, size) {
    const container = document.getElementById(containerId);
    container.style.gridTemplateColumns = `repeat(${size}, 40px)`;
    container.innerHTML = '';

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            cell.textContent = matrix[i * size + j].toFixed(2);
            container.appendChild(cell);
        }
    }
}

function displayVerificationResults(results) {
    const output = document.getElementById('output');
    output.textContent += '\nVerification Results:\n';
    
    let allCorrect = true;
    let maxDiff = 0;
    let avgDiff = 0;

    for (const check of results) {
        maxDiff = Math.max(maxDiff, check.diff);
        avgDiff += check.diff;

        const message = `Position [${check.row},${check.col}]: ` +
                       `GPU = ${check.gpuResult.toFixed(6)}, ` +
                       `CPU = ${check.cpuResult.toFixed(6)} ` +
                       `Diff: ${check.diff.toFixed(6)} ` +
                       `${check.isCorrect ? '✓' : '✗'}\n`;
        
        const span = document.createElement('span');
        span.textContent = message;
        span.className = check.isCorrect ? 'correct' : 'incorrect';
        output.appendChild(span);

        if (!check.isCorrect) allCorrect = false;
    }

    avgDiff /= results.length;

    const statsDiv = document.createElement('div');
    statsDiv.className = 'stats';
    statsDiv.textContent = `
Verification Statistics:
• Positions checked: ${NUM_VERIFICATION_CHECKS}
• Maximum difference: ${maxDiff.toFixed(6)}
• Average difference: ${avgDiff.toFixed(6)}
• Overall verification: ${allCorrect ? 'PASSED ✓' : 'FAILED ✗'}
`;
    output.appendChild(statsDiv);
}

function updateMatrixSize() {
    MATRIX_SIZE = parseInt(document.getElementById('matrix-size').value);
}

function updateVerificationPoints() {
    NUM_VERIFICATION_CHECKS = parseInt(document.getElementById('verification-points').value);
}

async function runShader() {
    const verificationResult = document.getElementById('verification-result');
    const WARMUP_RUNS = parseInt(document.getElementById('warmup-runs').value);
    const ITERATIONS = parseInt(document.getElementById('iterations').value);
    
    try {
        verificationResult.textContent = 'Running shader...';
        verificationResult.className = '';
        
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser. Please use Chrome Canary with WebGPU flags enabled.');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No WebGPU adapter found. This might be because:\n' +
                          '1. WebGPU is not yet enabled in your browser\n' +
                          '2. Your GPU does not support WebGPU\n' +
                          '3. You need to enable WebGPU flags in Chrome Canary');
        }

        const device = await adapter.requestDevice();
        const shaderCode = editor.getValue();

        // Extract workgroup size from shader code
        const workgroupMatch = shaderCode.match(/@compute\s+@workgroup_size\s*\((\d+)\s*,\s*(\d+)\)/);
        if (!workgroupMatch) {
            throw new Error('Could not find workgroup size in shader code. Please ensure @workgroup_size is properly defined.');
        }
        const BLOCK_DIM_X = parseInt(workgroupMatch[1]);
        const BLOCK_DIM_Y = parseInt(workgroupMatch[2]);

        const shaderModule = device.createShaderModule({
            code: shaderCode
        });

        const firstMatrix = generateRandomMatrix(MATRIX_SIZE);
        const secondMatrix = generateRandomMatrix(MATRIX_SIZE);
        
        const matrixBufferSize = MATRIX_SIZE * MATRIX_SIZE * 4 + 8;
        const gpuBufferFirstMatrix = device.createBuffer({
            mappedAtCreation: true,
            size: matrixBufferSize,
            usage: GPUBufferUsage.STORAGE
        });
        new Float32Array(gpuBufferFirstMatrix.getMappedRange()).set([MATRIX_SIZE, MATRIX_SIZE, ...firstMatrix]);
        gpuBufferFirstMatrix.unmap();

        const gpuBufferSecondMatrix = device.createBuffer({
            mappedAtCreation: true,
            size: matrixBufferSize,
            usage: GPUBufferUsage.STORAGE
        });
        new Float32Array(gpuBufferSecondMatrix.getMappedRange()).set([MATRIX_SIZE, MATRIX_SIZE, ...secondMatrix]);
        gpuBufferSecondMatrix.unmap();

        const gpuBufferResultMatrix = device.createBuffer({
            mappedAtCreation: true,
            size: matrixBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        new Float32Array(gpuBufferResultMatrix.getMappedRange()).set([MATRIX_SIZE, MATRIX_SIZE]);
        gpuBufferResultMatrix.unmap();

        const uniformBuffer = device.createBuffer({
            size: 20,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(
            uniformBuffer, 
            0, 
            new Uint32Array([MATRIX_SIZE, MATRIX_SIZE, MATRIX_SIZE])
        );
        device.queue.writeBuffer(
            uniformBuffer, 
            12,
            new Float32Array([1.0, 0.0])
        );

        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" }},
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" }},
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" }},
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" }}
            ]
        });

        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: gpuBufferFirstMatrix }},
                { binding: 1, resource: { buffer: gpuBufferSecondMatrix }},
                { binding: 2, resource: { buffer: gpuBufferResultMatrix }},
                { binding: 3, resource: { buffer: uniformBuffer }}
            ]
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        const computePipeline = device.createComputePipeline({
            layout: pipelineLayout,
            compute: {
                module: shaderModule,
                entryPoint: "main"
            }
        });

        const gridDimX = Math.ceil(MATRIX_SIZE / BLOCK_DIM_X);
        const gridDimY = Math.ceil(MATRIX_SIZE / BLOCK_DIM_Y);

        verificationResult.textContent = 'Running warmup with verification...';
        let allWarmupPassed = true;
        
        for (let i = 0; i < WARMUP_RUNS; i++) {
            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(computePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(gridDimX, gridDimY);
            passEncoder.end();

            device.queue.submit([commandEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();

            const gpuReadBuffer = device.createBuffer({
                size: matrixBufferSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });

            const readCommandEncoder = device.createCommandEncoder();
            readCommandEncoder.copyBufferToBuffer(
                gpuBufferResultMatrix, 0,
                gpuReadBuffer, 0,
                matrixBufferSize
            );

            device.queue.submit([readCommandEncoder.finish()]);

            await gpuReadBuffer.mapAsync(GPUMapMode.READ);
            const gpuResult = new Float32Array(gpuReadBuffer.getMappedRange().slice(8));
            gpuReadBuffer.unmap();
            
            const results = verifyResults(firstMatrix, secondMatrix, gpuResult, MATRIX_SIZE, MATRIX_SIZE, MATRIX_SIZE);
            if (!results.every(r => r.isCorrect)) {
                allWarmupPassed = false;
                break;
            }
        }

        if (!allWarmupPassed) {
            verificationResult.textContent = 'Warmup verification failed';
            verificationResult.className = 'failure';
            return;
        }

        verificationResult.textContent = 'Running performance measurements...';
        const executionTimes = [];
        
        for (let i = 0; i < ITERATIONS; i++) {
            const startTime = performance.now();
            
            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(computePipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(gridDimX, gridDimY);
            passEncoder.end();

            device.queue.submit([commandEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            
            const endTime = performance.now();
            executionTimes.push(endTime - startTime);
        }

        const avgTime = executionTimes.reduce((a, b) => a + b, 0) / ITERATIONS;
        const opsPerMatrix = MATRIX_SIZE * MATRIX_SIZE * MATRIX_SIZE * 2;
        const gflops = (opsPerMatrix / (avgTime / 1000)) / 1e9;

        verificationResult.textContent = `Performance Results:
• Average Time: ${avgTime.toFixed(2)} ms
• GFLOPs: ${gflops.toFixed(2)}`;
        verificationResult.className = 'success';

    } catch (error) {
        console.error('Error running shader:', error);
        verificationResult.textContent = 'Error: ' + error.message;
        verificationResult.className = 'failure';
    }
}

function clearOutput() {
    const verificationResult = document.getElementById('verification-result');
    verificationResult.textContent = '';
    verificationResult.className = '';
} 