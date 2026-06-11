import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'playwright-report',
      'test-results',
      'node_modules',
      'back-360-',
      // App do comboista: repo git próprio dentro da pasta, com lint próprio.
      'my-app',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Hooks: mantemos as duas regras clássicas (as novas, do React Compiler,
      // gerariam muito ruído no código legado).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Ruído herdado do código legado: mantemos como aviso (visível, não
      // bloqueante) em vez de editar lógica antiga às cegas. Apertar aos poucos.
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-useless-assignment': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  // Arquivos de config e E2E rodam em Node.
  {
    files: ['**/*.config.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
