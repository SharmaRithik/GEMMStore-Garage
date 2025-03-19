# GEMMStore Garage

A WebGPU-based matrix multiplication performance testing environment with shader debugging capabilities.

## Prerequisites

- Google Chrome Canary with WebGPU flags enabled
- Python 3.6 or higher
- `requests` Python package

## Setup

1. Install the required Python package:
```bash
pip install requests
```

2. Enable WebGPU in Chrome:
   - Open Chrome Canary
   - Navigate to `chrome://flags`
   - Enable "Unsafe WebGPU"

## Running the Application

1. Start the server:
```bash
python server.py
```

2. The application will automatically:
   - Launch a new Chrome instance with WebGPU debugging enabled
   - Open the interface at `http://localhost:8063`

## Using the Interface

The interface provides several controls:
- **Matrix Size**: Dimensions of the square matrices (N×N)
- **Warmup Runs**: Number of initial runs with verification (default: 3)
- **Iterations**: Number of performance measurement runs (default: 10)
- **Verification Checks**: Number of random points to verify in the result matrix (default: 50)

## File Structure

### `server.py`
Python server that:
- Serves the web interface
- Launches Chrome with WebGPU debugging flags
- Enables shader dumping via Dawn features

### `index.html`
Main interface containing:
- WGSL shader editor
- Performance controls
- Results display

### `script.js`
Core WebGPU implementation:
- Matrix multiplication setup
- Performance measurements
- Result verification
- WebGPU initialization and buffer management

### `styles.css`
Styling for:
- Code editor theme
- Interface layout
- Control elements

## Shader Output

The shader compilation and performance results will be displayed in:
1. The browser's console (shader IR dumps)
2. The interface (performance metrics)

## Performance Metrics

The tool reports:
- Average execution time (ms)
- Computational throughput (GFLOPs)
- Verification status for warmup runs