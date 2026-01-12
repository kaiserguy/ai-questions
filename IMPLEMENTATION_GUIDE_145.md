# Implementation Guide: Issue #145 - Browser-based Offline AI Chat

## Overview
Implement fully functional AI chat that runs entirely in the browser using ONNX Runtime Web.

## Files to Modify

### 1. `core/public/offline/ai-model-manager.js`
Current state: Has placeholder structure but needs real ONNX integration.

**Required Changes:**
- Import and initialize ONNX Runtime Web
- Implement `loadModel()` to load ONNX model from IndexedDB/Cache
- Implement `runInference()` to process user messages
- Add Web Worker support for non-blocking inference
- Implement proper memory management

```javascript
// Key methods to implement:
class AIModelManager {
  async loadModel() {
    // 1. Check if model exists in IndexedDB
    // 2. If not, download from CDN (model files in core/public/offline/models/)
    // 3. Initialize ONNX Runtime session
    // 4. Set this.modelLoaded = true
  }
  
  async generateResponse(userMessage) {
    // 1. Tokenize input using tokenizer
    // 2. Run ONNX inference
    // 3. Decode output tokens
    // 4. Return generated text
  }
}
```

### 2. `core/public/offline/integration-manager.js`
**Required Changes:**
- Connect AIModelManager to chat UI
- Handle model loading states
- Route chat messages to AI model

### 3. `core/views/offline.ejs`
**Required Changes:**
- Add loading indicator during model initialization
- Show model status (loading/ready/error)
- Ensure chat input is enabled only when model is ready

### 4. `core/public/offline/libs/` (new files)
**Add:**
- `onnxruntime-web.min.js` - ONNX Runtime Web library
- `tokenizer.js` - Tokenizer for Phi-3 model

## Technical Approach

### Model Selection
Use a small, efficient model that works in browser:
- **TinyLlama-1.1B** or **Phi-3-mini** in ONNX format
- Quantized to INT8 for smaller size (~500MB)

### ONNX Runtime Web Setup
```javascript
import * as ort from 'onnxruntime-web';

// Configure for WebAssembly backend
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
ort.env.wasm.simd = true;

const session = await ort.InferenceSession.create(modelBuffer, {
  executionProviders: ['wasm'],
  graphOptimizationLevel: 'all'
});
```

### Inference Flow
1. User types message → tokenize with model's tokenizer
2. Create input tensor from tokens
3. Run session.run() with input tensor
4. Decode output tokens to text
5. Display response in chat

### Error Handling
- Out of memory: Show friendly message, suggest closing tabs
- Unsupported browser: Check for WebAssembly support
- Model load failure: Retry with exponential backoff

## Testing Requirements

Add tests in `tests/offline-ai-chat.test.js`:
- Model loading success/failure
- Inference produces valid output
- Memory cleanup after inference
- Error handling for edge cases

## Acceptance Criteria
- [ ] User can load AI model in browser
- [ ] User can send messages and receive AI-generated responses
- [ ] Chat works completely offline
- [ ] Model loading is cached
- [ ] Error handling provides clear feedback
- [ ] Response time < 10s on average hardware

## Resources
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- Pre-converted models: https://huggingface.co/models?library=onnx
