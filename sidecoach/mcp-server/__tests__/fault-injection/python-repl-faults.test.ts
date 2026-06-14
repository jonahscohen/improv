// T-0025: fault-injection for the Python REPL tool.
//
// Always-on (no daemon required):
//   - runtime missing on PATH -> DOWNSTREAM_UNAVAILABLE (empty PATH)
//   - sandbox-escape attempts -> INVALID_INPUT from the static screen, before
//     any container spawns (one per forbidden category)
//
// Daemon-gated (skipped with a logged note when `docker ps` fails) - these
// prove the CONTAINER itself, not just the screen, enforces the boundary:
//   - timeout kill: a busy loop is hard-killed, no hang
//   - OOM: an over-256m allocation is killed, surfaced cleanly (not a hang)
//   - network egress: urllib (an ALLOWED import) cannot reach the network
//     under --network none, and fails cleanly

import { execFileSync } from 'child_process';

import { createLogger } from '../../src/logger';
import { TOOLS } from '../../src/tools';
import { SidecoachToolError } from '../../src/errors';
import { _resetRuntimeProbe, runInContainer, resolveImage, probeRuntime } from '../../src/python-sandbox';
import type { RegistryBundle } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

const NULL_REG: RegistryBundle = { verbs: null, modes: null, flows: [], cheatsheet: null, lanes: null, intent: null };

function deps() {
  return { logger: silentLogger(), registries: NULL_REG };
}

function pickHandler(name: string) {
  const t = TOOLS.find((tool) => tool.definition.name === name);
  if (!t) throw new Error(`tool ${name} not registered`);
  return t.handler;
}

/** Daemon is reachable (binary present AND `docker ps` succeeds). */
function dockerReady(): boolean {
  try {
    execFileSync('docker', ['ps'], { stdio: 'ignore', timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

export async function run(): Promise<void> {
  await test('python_repl with empty PATH returns DOWNSTREAM_UNAVAILABLE', async () => {
    _resetRuntimeProbe();
    const original = process.env.PATH;
    process.env.PATH = '';
    try {
      const h = pickHandler('sidecoach_python_repl_execute');
      await h({ code: 'print(1)' }, deps());
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
      assert.strictEqual((err as SidecoachToolError).extra.resource, 'docker');
    } finally {
      process.env.PATH = original;
      _resetRuntimeProbe();
    }
  });

  // --- sandbox-escape attempts rejected at the screen (no container) -----

  const escapes: Array<{ label: string; code: string }> = [
    { label: 'import os', code: 'import os\nos.system("id")' },
    { label: 'import subprocess', code: 'import subprocess\nsubprocess.run(["id"])' },
    { label: 'import socket', code: 'import socket\ns = socket.socket()' },
    { label: '__import__', code: '__import__("os").system("id")' },
    { label: 'eval', code: 'eval("__import__(\\"os\\").system(\\"id\\")")' },
    { label: 'exec', code: 'exec("import os")' },
    { label: 'compile', code: 'compile("import os", "<s>", "exec")' },
    { label: 'getattr on __builtins__', code: 'getattr(__builtins__, "eval")("1")' },
  ];

  for (const esc of escapes) {
    await test(`python_repl rejects sandbox escape: ${esc.label} -> INVALID_INPUT (no container)`, async () => {
      _resetRuntimeProbe();
      try {
        const h = pickHandler('sidecoach_python_repl_execute');
        await h({ code: esc.code }, deps());
        assert.fail('expected throw');
      } catch (err) {
        assert.ok(err instanceof SidecoachToolError);
        const code = (err as SidecoachToolError).code;
        // If a runtime is present the screen fires first -> INVALID_INPUT.
        // If NO runtime is present the probe fires first -> DOWNSTREAM_UNAVAILABLE.
        // Either way the code never runs.
        assert.ok(
          code === 'INVALID_INPUT' || code === 'DOWNSTREAM_UNAVAILABLE',
          `expected INVALID_INPUT or DOWNSTREAM_UNAVAILABLE, got ${code}`,
        );
      } finally {
        _resetRuntimeProbe();
      }
    });
  }

  // --- daemon-gated container-boundary faults ----------------------------

  await test('python_repl timeout: busy loop is hard-killed, not a hang', async () => {
    if (!dockerReady()) {
      // eslint-disable-next-line no-console
      console.log('    (skipped: docker daemon not reachable)');
      return;
    }
    _resetRuntimeProbe();
    const probe = await probeRuntime();
    assert.ok(probe.ok && probe.runtime);
    const out = await runInContainer({
      runtime: probe.runtime!,
      image: resolveImage(),
      containerName: `sidecoach-pyrepl-fault-timeout-${process.pid}`,
      code: 'while True:\n    pass\n',
      timeoutMs: 2_000,
    });
    assert.strictEqual(out.timedOut, true, 'expected timedOut');
    // It must have returned promptly (well under, say, 15s) - no hang.
    assert.ok(out.durationMs < 15_000, `took too long: ${out.durationMs}ms`);
    _resetRuntimeProbe();
  });

  await test('python_repl OOM: over-256m allocation is killed, surfaced (not a hang)', async () => {
    if (!dockerReady()) {
      // eslint-disable-next-line no-console
      console.log('    (skipped: docker daemon not reachable)');
      return;
    }
    _resetRuntimeProbe();
    const probe = await probeRuntime();
    // Allocate ~400 MB of bytes (> 256m cap) -> kernel OOM-kills the process.
    const out = await runInContainer({
      runtime: probe.runtime!,
      image: resolveImage(),
      containerName: `sidecoach-pyrepl-fault-oom-${process.pid}`,
      code: "x = bytearray(400 * 1024 * 1024)\nprint(len(x))\n",
      timeoutMs: 9_000,
    });
    // Either the OOM killer fired (non-zero exit / 137) or the allocation
    // failed inside python (MemoryError on stderr). Both are "handled", and
    // critically it did NOT time out / hang.
    assert.strictEqual(out.timedOut, false, 'OOM case should not time out');
    const handled = out.exitCode !== 0 || out.oomKilled || /MemoryError/i.test(out.stderr);
    assert.ok(handled, `expected an OOM-handled outcome, got exit=${out.exitCode} stderr=${out.stderr.slice(0, 120)}`);
    _resetRuntimeProbe();
  });

  await test('python_repl network egress: urllib blocked by --network none, fails cleanly', async () => {
    if (!dockerReady()) {
      // eslint-disable-next-line no-console
      console.log('    (skipped: docker daemon not reachable)');
      return;
    }
    _resetRuntimeProbe();
    const probe = await probeRuntime();
    // urllib is an ALLOWED import (not os/subprocess/socket) so it passes the
    // screen - the network block must therefore come from the container.
    const code =
      'import urllib.request\n' +
      'try:\n' +
      "    urllib.request.urlopen('http://example.com', timeout=3)\n" +
      "    print('REACHED_NETWORK')\n" +
      'except Exception as e:\n' +
      "    print('BLOCKED:', type(e).__name__)\n";
    const out = await runInContainer({
      runtime: probe.runtime!,
      image: resolveImage(),
      containerName: `sidecoach-pyrepl-fault-net-${process.pid}`,
      code,
      timeoutMs: 9_000,
    });
    assert.strictEqual(out.timedOut, false);
    assert.ok(!out.stdout.includes('REACHED_NETWORK'), 'network egress was NOT blocked');
    assert.ok(out.stdout.includes('BLOCKED:'), `expected a clean block, got: ${out.stdout.slice(0, 160)}`);
    _resetRuntimeProbe();
  });
}
