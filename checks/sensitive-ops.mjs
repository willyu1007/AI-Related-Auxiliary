import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = path.join(REPO_ROOT, 'system', 'skills', 'sensitive-ops', 'template.sh');
const STAGES_MARKER = '# STAGES: replace this scaffold with the current task\'s missing outcomes.';

function authoredTemplate(body) {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const markerIndex = template.indexOf(STAGES_MARKER);
  if (markerIndex < 0) throw new Error('sensitive-ops template has no STAGES marker');
  const libraryEnd = markerIndex + STAGES_MARKER.length;
  return `${template.slice(0, libraryEnd)}\n\n${body.trim()}\n`;
}

function runHelper(helper, opsFile, input = '', env = {}) {
  return spawnSync('/bin/bash', [helper], {
    encoding: 'utf8',
    env: { ...process.env, SENSITIVE_OPS_FILE: opsFile, ...env },
    input,
  });
}

function check(failures, condition, message) {
  if (!condition) failures.push(message);
}

export function sensitiveOpsTemplateFailures() {
  const failures = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sensitive-ops-check-'));

  try {
    const rawHelper = path.join(tempDir, 'raw.sh');
    const missingForRaw = path.join(tempDir, 'raw-ops.md');
    fs.copyFileSync(TEMPLATE, rawHelper);
    fs.chmodSync(rawHelper, 0o700);
    const raw = runHelper(rawHelper, missingForRaw);
    check(failures, raw.status === 1, 'an unauthored helper must exit 1');
    check(failures, !fs.existsSync(missingForRaw), 'an unauthored helper must not create an operations document');

    const authoredHelper = path.join(tempDir, 'authored.sh');
    const missingForAuthored = path.join(tempDir, 'missing-ops.md');
    fs.writeFileSync(
      authoredHelper,
      authoredTemplate(`
configure_workflow "Test workflow" "<!-- sensitive-ops:test -->" "<待填写：测试值>"
prepare_workflow
`),
      { mode: 0o700 }
    );
    const authored = runHelper(authoredHelper, missingForAuthored);
    check(failures, authored.status === 1, 'an authored helper must exit 1 when its operations document is missing');
    check(failures, !fs.existsSync(missingForAuthored), 'an authored helper must not create a missing operations document');

    const missingMarker = path.join(tempDir, 'missing-marker.md');
    fs.writeFileSync(missingMarker, '- value: <待填写：测试值>\n', { mode: 0o600 });
    const withoutMarker = runHelper(authoredHelper, missingMarker);
    check(failures, withoutMarker.status === 1, 'an authored helper must reject a document without its workflow marker');

    const duplicatePlaceholder = path.join(tempDir, 'duplicate-placeholder.md');
    fs.writeFileSync(
      duplicatePlaceholder,
      '<!-- sensitive-ops:test -->\n- values: <待填写：测试值> and <待填写：测试值>\n',
      { mode: 0o600 }
    );
    const duplicate = runHelper(authoredHelper, duplicatePlaceholder);
    check(failures, duplicate.status === 1, 'an authored helper must reject duplicate placeholders on one line');

    const duplicateRegistrationHelper = path.join(tempDir, 'duplicate-registration.sh');
    const duplicateRegistrationDocument = path.join(tempDir, 'duplicate-registration.md');
    fs.writeFileSync(
      duplicateRegistrationHelper,
      authoredTemplate(`
PLACEHOLDER='<待填写：重复注册>'
configure_workflow "Duplicate workflow" "<!-- sensitive-ops:duplicate-test -->" "$PLACEHOLDER" "$PLACEHOLDER"
prepare_workflow
`),
      { mode: 0o700 }
    );
    fs.writeFileSync(
      duplicateRegistrationDocument,
      '<!-- sensitive-ops:duplicate-test -->\n- value: <待填写：重复注册>\n',
      { mode: 0o600 }
    );
    const duplicateRegistration = runHelper(duplicateRegistrationHelper, duplicateRegistrationDocument);
    check(failures, duplicateRegistration.status === 1, 'a helper must reject a placeholder registered more than once');

    const writeHelper = path.join(tempDir, 'write-secret.sh');
    const writeDocument = path.join(tempDir, 'write-secret.md');
    const writePlaceholder = '<待填写：测试秘密>';
    fs.writeFileSync(
      writeHelper,
      authoredTemplate(`
PLACEHOLDER='${writePlaceholder}'
configure_workflow "Secret workflow" "<!-- sensitive-ops:secret-test -->" "$PLACEHOLDER"
prepare_workflow
if placeholder_exists "$PLACEHOLDER"; then
  collect_secret "$PLACEHOLDER" "Secret:"
fi
finish
`),
      { mode: 0o700 }
    );
    fs.writeFileSync(
      writeDocument,
      `<!-- sensitive-ops:secret-test -->\n- secret: ${writePlaceholder}\n`,
      { mode: 0o600 }
    );
    const stubBin = path.join(tempDir, 'bin');
    fs.mkdirSync(stubBin);
    fs.writeFileSync(path.join(stubBin, 'mv'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    const failedWrite = runHelper(writeHelper, writeDocument, 'dummy-secret\n', {
      PATH: `${stubBin}${path.delimiter}${process.env.PATH}`,
    });
    const failedOutput = `${failedWrite.stdout}${failedWrite.stderr}`;
    const tempResidue = fs.readdirSync(tempDir).filter((name) => name.startsWith('write-secret.md.tmp.'));
    check(failures, failedWrite.status === 1, 'a failed atomic replacement must exit 1');
    check(failures, fs.readFileSync(writeDocument, 'utf8').includes(writePlaceholder), 'a failed replacement must preserve the original document');
    check(failures, tempResidue.length === 0, 'a failed replacement must remove temporary files containing sensitive data');
    check(failures, !failedOutput.includes('dummy-secret'), 'a failed replacement must not print the sensitive value');

    const successDocument = path.join(tempDir, 'successful-write.md');
    fs.writeFileSync(
      successDocument,
      `<!-- sensitive-ops:secret-test -->\n- secret: ${writePlaceholder}\n`,
      { mode: 0o640 }
    );
    const successfulWrite = runHelper(writeHelper, successDocument, '\ndummy&secret\n');
    const successfulOutput = `${successfulWrite.stdout}${successfulWrite.stderr}`;
    const writtenMode = fs.statSync(successDocument).mode & 0o777;
    check(failures, successfulWrite.status === 0, 'empty input must re-prompt and accept the next non-empty value');
    check(failures, fs.readFileSync(successDocument, 'utf8').includes('dummy&secret'), 'a successful replacement must preserve the exact supplied value');
    check(failures, writtenMode === 0o640, 'a successful replacement must preserve the document permission mode');
    check(failures, !successfulOutput.includes('dummy&secret'), 'a successful replacement must not print the sensitive value');
    const completedRerun = runHelper(writeHelper, successDocument);
    check(failures, completedRerun.status === 0, 'a completed helper must be safe to rerun');

    const deferredDocument = path.join(tempDir, 'deferred.md');
    const deferredContents = `<!-- sensitive-ops:secret-test -->\n- secret: ${writePlaceholder}\n`;
    fs.writeFileSync(deferredDocument, deferredContents, { mode: 0o600 });
    const deferred = runHelper(writeHelper, deferredDocument, ':later\n');
    const deferredResidue = fs.readdirSync(tempDir).filter((name) => name.startsWith('deferred.md.tmp.'));
    check(failures, deferred.status === 2, ':later must exit 2');
    check(failures, fs.readFileSync(deferredDocument, 'utf8') === deferredContents, ':later must leave the operations document unchanged');
    check(failures, deferredResidue.length === 0, ':later must not leave temporary files');

    const browserHelper = path.join(tempDir, 'browser.sh');
    const browserDocument = path.join(tempDir, 'browser.md');
    const browserMarker = '<!-- sensitive-ops:browser-test -->';
    fs.writeFileSync(
      browserHelper,
      authoredTemplate(`
configure_workflow "Browser workflow" "${browserMarker}" "<待填写：浏览器测试>"
prepare_workflow
open_url "https://example.invalid/setup"
`),
      { mode: 0o700 }
    );
    fs.writeFileSync(browserDocument, `${browserMarker}\n- value: <待填写：浏览器测试>\n`, { mode: 0o600 });
    const emptyBin = path.join(tempDir, 'empty-bin');
    fs.mkdirSync(emptyBin);
    const withoutBrowser = runHelper(browserHelper, browserDocument, '', { PATH: emptyBin });
    const browserOutput = `${withoutBrowser.stdout}${withoutBrowser.stderr}`;
    check(failures, withoutBrowser.status === 0, 'a missing browser opener must not fail the helper');
    check(failures, browserOutput.includes("couldn't open a browser"), 'a missing browser opener must print a manual fallback');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return failures;
}
