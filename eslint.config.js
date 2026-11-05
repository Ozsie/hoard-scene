import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

// Standalone lint config for the package: strict TypeScript with prettier
// enforced, plus the scene boundary rules ported from the game repo — the
// sources import nothing but relative files. The planned dependency edge
// into @hoard-engine/primitives (the two-consumer rule: uikit and scene
// both draw) activates only once the compositing actually consumes the
// text/geometry helpers; until then the package is a dependency-free leaf.
// Test files may additionally import 'vitest'.
export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      prettierRecommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'prettier/prettier': 'error',
    },
  },
  // Canvas-mock test objects are `as unknown as CanvasRenderingContext2D`,
  // so mock method references trip unbound-method even though the values
  // are plain recorders. The rule has no value in tests.
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  // Scene boundary: relative imports only, within the package. The
  // boundary test walks the import graph as a second line of defense.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportDeclaration[source.value=/^(?!(\\.))/], ImportExpression[source.value=/^(?!(\\.))/], ExportAllDeclaration[source.value=/^(?!(\\.))/], ExportNamedDeclaration[source.value=/^(?!(\\.))/]',
          message:
            'The scene package imports nothing but relative files (no game code, no Svelte, no engine siblings, no node builtins).',
        },
      ],
    },
  },
);
