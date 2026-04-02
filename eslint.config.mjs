export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/public/**',
      'app/**',
      'components/**',
      'lib/**',
      'docs/**',
      'agent-go/**',
      'prisma/**',
      'hooks/**',
      'styles/**'
    ],
  },
  {
    files: ['scripts/verification/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error'
    }
  }
]
