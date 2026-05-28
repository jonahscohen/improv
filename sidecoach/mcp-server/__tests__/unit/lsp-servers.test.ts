// T-0026: unit tests for language-server discovery (extension -> server spec
// + LSP languageId).

import {
  specForFile,
  specForExtension,
  specForLanguage,
  languageIdForFile,
  LANGUAGE_SERVERS,
} from '../../src/lsp/servers';
import { test, assert } from '../harness';

export async function run(): Promise<void> {
  await test('servers: .ts maps to typescript-language-server', async () => {
    const spec = specForFile('/proj/src/index.ts');
    assert.ok(spec);
    assert.strictEqual(spec!.id, 'typescript');
    assert.strictEqual(spec!.command, 'typescript-language-server');
    assert.deepStrictEqual(spec!.args, ['--stdio']);
  });

  await test('servers: .go maps to gopls, .rs to rust-analyzer, .py to pyright', async () => {
    assert.strictEqual(specForFile('a.go')!.command, 'gopls');
    assert.strictEqual(specForFile('a.rs')!.command, 'rust-analyzer');
    assert.strictEqual(specForFile('a.py')!.command, 'pyright-langserver');
  });

  await test('servers: unsupported extension returns null', async () => {
    assert.strictEqual(specForFile('notes.txt'), null);
    assert.strictEqual(specForExtension('.cobol'), null);
  });

  await test('servers: extension match is case-insensitive', async () => {
    assert.ok(specForFile('Component.TSX'));
    assert.strictEqual(specForFile('Component.TSX')!.id, 'typescript');
  });

  await test('servers: languageId differentiates tsx / jsx / js / ts', async () => {
    assert.strictEqual(languageIdForFile('a.tsx'), 'typescriptreact');
    assert.strictEqual(languageIdForFile('a.jsx'), 'javascriptreact');
    assert.strictEqual(languageIdForFile('a.js'), 'javascript');
    assert.strictEqual(languageIdForFile('a.ts'), 'typescript');
  });

  await test('servers: specForLanguage resolves a family id, null when unknown', async () => {
    assert.strictEqual(specForLanguage('rust')!.command, 'rust-analyzer');
    assert.strictEqual(specForLanguage('fortran'), null);
  });

  await test('servers: every spec has at least one extension and a command', async () => {
    for (const spec of LANGUAGE_SERVERS) {
      assert.ok(spec.extensions.length > 0, `${spec.id} has no extensions`);
      assert.ok(spec.command.length > 0, `${spec.id} has no command`);
    }
  });
}
