import { readFile, appendFile } from 'node:fs/promises';
const destination = process.env.GITHUB_STEP_SUMMARY;
if (!destination) throw new Error('GitHub step summary is required.');
let report;
try {
  report = JSON.parse(await readFile('.cache/e2e-report.json', 'utf8'));
} catch {
  await appendFile(
    destination,
    'Browser report was not produced; inspect the preceding setup/check steps.\n',
  );
  process.exit(0);
}
const failures = [];
function visit(suite, parents = []) {
  const path = [...parents, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? [])
    for (const test of spec.tests ?? []) {
      if (test.status !== 'unexpected') continue;
      const errors = (test.results ?? [])
        .flatMap((r) => r.errors ?? [])
        .map((e) => e.message ?? e.value ?? '')
        .join('\n');
      failures.push(
        `### ${[...path, spec.title].join(' / ')} (${test.projectName})\n\n\u0060\u0060\u0060text\n${errors
          .replace(/\u001b\[[0-9;]*m/g, '')
          .replace(/\u0060\u0060\u0060/g, '~~~')
          .slice(0, 5000)}\n\u0060\u0060\u0060\n`,
      );
    }
  for (const child of suite.suites ?? []) visit(child, path);
}
for (const suite of report.suites ?? []) visit(suite);
await appendFile(
  destination,
  `## Browser checks\n\nExpected: ${report.stats?.expected ?? 0}. Unexpected: ${report.stats?.unexpected ?? 0}. Skipped: ${report.stats?.skipped ?? 0}.\n\n${failures.join('\n')}`,
);
