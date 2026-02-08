import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  statSync,
} from 'fs';
import { minify } from 'terser';

function copyDirSync(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  readdirSync(srcDir).forEach((name) => {
    const srcPath = join(srcDir, name);
    const destPath = join(destDir, name);
    if (statSync(srcPath).isDirectory()) copyDirSync(srcPath, destPath);
    else copyFileSync(srcPath, destPath);
  });
}

function minifyAndCopyPlugin() {
  return {
    name: 'minify-and-copy',
    async closeBundle() {
      const outDir = join(process.cwd(), 'dist');
      const jsDir = join(outDir, 'js');
      mkdirSync(jsDir, { recursive: true });
      const srcJs = join(process.cwd(), 'js');
      const files = readdirSync(srcJs).filter((f) => f.endsWith('.js'));
      await Promise.all(
        files.map(async (f) => {
          const code = readFileSync(join(srcJs, f), 'utf-8');
          const result = await minify(code, {
            compress: { drop_console: false },
            format: { comments: false },
            sourceMap: false,
          });
          writeFileSync(join(jsDir, f), result.code);
        })
      );
      try {
        const css = readFileSync(join(process.cwd(), 'styles.css'), 'utf-8');
        writeFileSync(join(outDir, 'styles.css'), css);
      } catch (_) {}
      copyDirSync(join(process.cwd(), 'assets'), join(outDir, 'assets'));
      copyDirSync(join(process.cwd(), 'music'), join(outDir, 'music'));
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks: undefined,
      },
    },
    terserOptions: {
      compress: { drop_console: false },
      format: { comments: false },
    },
  },
  plugins: [minifyAndCopyPlugin()],
});
