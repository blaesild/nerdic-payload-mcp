import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'server': 'src/server.ts',
    'api/index': 'src/api/index.ts',
    'core/mcp-server': 'src/core/mcp-server.ts',
    'api/mcp/validate': 'src/api/mcp/validate.ts',
    'api/mcp/query': 'src/api/mcp/query.ts',
    'api/mcp/generate': 'src/api/mcp/generate.ts',
    'api/mcp/scaffold': 'src/api/mcp/scaffold.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  bundle: true,
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: `.${format}.js`,
    };
  },
  noExternal: ['express', 'cors', 'dotenv', 'openai', 'zod'],
  esbuildOptions(options) {
    options.mainFields = ['module', 'main'];
    options.platform = 'node';
    options.target = 'node20';
    options.format = 'esm';
    options.bundle = true;
    options.alias = {
      '@/core': './src/core',
      '@/api': './src/api'
    };
  }
}); 