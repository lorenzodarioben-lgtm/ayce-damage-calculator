// @vitest-environment node

import { ESLint } from 'eslint';
import nextPlugin from '@next/eslint-plugin-next';
import { describe, expect, it } from 'vitest';

describe('Next.js lint directory lookup', () => {
  it('keeps internal-link checks active when the project root is a glob', async () => {
    const linter = new ESLint({
      overrideConfigFile: true,
      overrideConfig: {
        files: ['**/*.tsx'],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        settings: { next: { rootDir: './' } },
        plugins: { '@next/next': nextPlugin },
        rules: { '@next/next/no-html-link-for-pages': 'error' },
      },
    });
    const [invalid] = await linter.lintText(
      'export default function Page() { return <a href="/">Home</a>; }',
      { filePath: 'src/app/lint-fixture.tsx' },
    );
    expect(invalid?.messages.map((message) => message.ruleId)).toContain(
      '@next/next/no-html-link-for-pages',
    );

    const [valid] = await linter.lintText(
      'import Link from "next/link"; export default function Page() { return <Link href="/">Home</Link>; }',
      { filePath: 'src/app/lint-fixture.tsx' },
    );
    expect(valid?.errorCount).toBe(0);
  });
});
