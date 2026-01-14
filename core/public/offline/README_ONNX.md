# ONNX Runtime Web Setup

## Overview
This document describes the ONNX Runtime Web infrastructure for browser-based AI inference.

## Current Status
- ONNX Runtime Web is referenced but not yet fully integrated
- Model loading infrastructure is in place
- Inference pipeline needs to be implemented

## Requirements
1. ONNX Runtime Web library (onnxruntime-web)
2. Web Worker for non-blocking inference
3. WASM backend support
4. WebGPU backend support (optional, for better performance)

## Installation
```bash
npm install onnxruntime-web
```

## Integration Points
- `local-ai-model.js`: Main model management class
- `ai-models.js`: High-level AI interface
- Web Worker (to be created): Inference execution

## Model Format
Models must be in ONNX format (.onnx files) and should include:
- Model weights
- Tokenizer configuration
- Generation configuration

## Next Steps (Phase 2)
1. Set up proper ONNX Runtime Web initialization
2. Create Web Worker for inference
3. Implement model download and caching
4. Add IndexedDB storage for models

## Error Handling
All model operations now throw proper errors instead of generating fake responses:
- Model not found: Throws error with download instructions
- ONNX Runtime not available: Throws error with setup instructions
- Inference failure: Throws error with diagnostic information
