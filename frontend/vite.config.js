import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
    plugins: [
        react(),
        svgr()
    ],
    esbuild: {
        loader: "jsx",
        include: /src\/.*\.jsx?$/,
        exclude: [],
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: {
                '.js': 'jsx',
            },
        },
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/setupTests.js',
        css: true,
    },
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'build',
    },
});
