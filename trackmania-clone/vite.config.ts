import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 5173,
    },
    build: {
        outDir: 'dist',
    },
    optimizeDeps: {
        exclude: ['@babylonjs/havok'] // Havok is usually a WASM module that can cause issues if pre-bundled
    }
});
