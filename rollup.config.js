import pkg from './package.json';

export default [
  {
    input: './lib/index.js',
    output: [
      {
        dir: 'dist/cjs',
        format: 'cjs',
        preserveModules: true
      }
    ],
    external: Object.keys(pkg.dependencies).concat(['crypto', 'util'])
  }
];
