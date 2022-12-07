import pkg from './package.json' assert {type: 'json'};

function preserveDynamicImportPlugin() {
  return {
    name: 'preserve-dynamic-import',
    renderDynamicImport() {
      return {left: 'import(', right: ')'};
    }
  };
}

export default [
  {
    input: './lib/index.js',
    output: [
      {
        file: 'dist/cjs/index.cjs',
        format: 'cjs'
      }
    ],
    plugins: [preserveDynamicImportPlugin()],
    external: Object.keys(pkg.dependencies).concat(['crypto', 'util'])
  }
];
