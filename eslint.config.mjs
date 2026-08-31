import nextConfig from 'eslint-config-next'

// `eslint-config-next` exporta um ARRAY de blocos flat-config (parser React/Next,
// regras, etc.), cada um já com seu proprio `files`. Espalha-los direto num
// objeto (`...nextConfig`) quebra o flat-config (produz chaves numericas "0",
// "1" em vez de um array de blocos — "Unexpected key 0"). NÃO usar FlatCompat
// aqui: quebra com "Converting circular structure to JSON" nesta combinação
// de versões (eslint 9.39 + eslint-config-next 16.3.3). Em vez disso,
// reescreve o `files` de cada bloco do pacote para ficar restrito ao escopo
// literal da Sprint 5, item 3: só app/**, components/**, lib/**. hooks/**,
// docs/**, agent-go/**, prisma/**, styles/** permanecem ignorados de
// proposito — ver "Fora de escopo" em docs/SPRINTS.md.
const SPRINT5_LINT_DIRS = ['app', 'components', 'lib']
const scopedNextConfig = nextConfig
  .filter((entry) => Array.isArray(entry.files))
  .flatMap((entry) =>
    SPRINT5_LINT_DIRS.map((dir) => ({
      ...entry,
      files: entry.files.map((pattern) => `${dir}/${pattern}`),
    }))
  )

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/public/**',
      'docs/**',
      'agent-go/**',
      'prisma/**',
      'hooks/**',
      'styles/**'
    ],
  },
  ...scopedNextConfig,
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
