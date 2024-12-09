import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        viteStaticCopy({
            targets: [
                {
                    src: 'manifest.json',
                    dest: './'
                },
                {
                    src: 'public/icon.png',
                    dest: 'public/'
                }
            ]
        })
    ],
    build: {
        rollupOptions: {
            input: {
                popup: path.resolve(__dirname, 'public/popup.html'),
                background: path.resolve(__dirname, 'src/background/background.ts'),
                content: path.resolve(__dirname, 'src/content/content.ts'),
            },
            output: {
                entryFileNames: (chunkInfo) => {
                    if (chunkInfo.name === 'background') {
                        return 'src/background/background.js';
                    } else if (chunkInfo.name === 'content') {
                        return 'src/content/content.js';
                    } else if (chunkInfo.name === 'popup') {
                        return 'src/popup/index.js'; // 注意这里，popup 入口也需要指定 js 文件名
                    }
                    return 'assets/[name]-[hash].js'; // 其他文件默认输出到 assets 目录
                },
                chunkFileNames: 'assets/[name]-[hash].js', // 代码分割后的文件名
                assetFileNames: 'assets/[name]-[hash].[ext]', // 静态资源文件名
            },
        },
        minify: false,
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});