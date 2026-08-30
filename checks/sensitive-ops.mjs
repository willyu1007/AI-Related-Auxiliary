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

function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function runHelperInPty(helper, opsFile, tempDir, env = {}) {
  const driver = path.join(tempDir, 'pty-driver.sh');
  const statusFile = path.join(tempDir, 'pty-helper.status');
  fs.writeFileSync(
    driver,
    '#!/usr/bin/env bash\n"$HELPER_UNDER_TEST"\nprintf \'%s\\n\' "$?" > "$HELPER_STATUS_FILE"\n',
    { mode: 0o700 }
  );
  const scriptArgs = process.platform === 'darwin'
    ? ['-q', '/dev/null', '/bin/bash', driver]
    : ['-q', '-e', '-c', `/bin/bash ${shellQuote(driver)}`, '/dev/null'];
  const stdin = fs.openSync('/dev/null', 'r');
  let result;
  try {
    result = spawnSync('/usr/bin/script', scriptArgs, {
      encoding: 'utf8',
      env: {
        ...process.env,
        TERM: 'dumb',
        SENSITIVE_OPS_FILE: opsFile,
        HELPER_UNDER_TEST: helper,
        HELPER_STATUS_FILE: statusFile,
        ...env,
      },
      stdio: [stdin, 'pipe', 'pipe'],
    });
  } finally {
    fs.closeSync(stdin);
  }
  return {
    ...result,
    helperStatus: fs.existsSync(statusFile) ? Number(fs.readFileSync(statusFile, 'utf8').trim()) : null,
  };
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
banner "$WORKFLOW_TITLE"
finish
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

    const missingOutcome = path.join(tempDir, 'missing-outcome.md');
    fs.writeFileSync(missingOutcome, '<!-- sensitive-ops:test -->\n- value was removed\n', { mode: 0o600 });
    const withoutOutcomeEvidence = runHelper(authoredHelper, missingOutcome);
    check(failures, withoutOutcomeEvidence.status === 1, 'a helper must reject an outcome with neither its placeholder nor completion marker');

    const completedDocument = path.join(tempDir, 'completed.md');
    fs.writeFileSync(
      completedDocument,
      '<!-- sensitive-ops:test -->\n- value: already configured<!-- sensitive-ops:test:outcome-1:complete -->\n',
      { mode: 0o600 }
    );
    const completedInDumbTerminal = runHelperInPty(authoredHelper, completedDocument, tempDir);
    check(
      failures,
      completedInDumbTerminal.error === undefined && completedInDumbTerminal.status === 0,
      `the PTY regression check must be runnable (status: ${completedInDumbTerminal.status ?? 'missing'}, stderr: ${JSON.stringify(completedInDumbTerminal.stderr)})`
    );
    check(
      failures,
      completedInDumbTerminal.helperStatus === 0,
      `a helper must not fail when TERM=dumb cannot clear the TTY (helper status: ${completedInDumbTerminal.helperStatus ?? 'missing'}, PTY status: ${completedInDumbTerminal.status ?? 'missing'}, signal: ${completedInDumbTerminal.signal ?? 'none'})`
    );

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

    const partialHelper = path.join(tempDir, 'partial.sh');
    const partialDocument = path.join(tempDir, 'partial.md');
    const partialPlaceholder = '<待填写：剩余值>';
    const partialMarker = '<!-- sensitive-ops:partial-test -->';
    fs.writeFileSync(
      partialHelper,
      authoredTemplate(`
PLACEHOLDER='${partialPlaceholder}'
configure_workflow "Partial workflow" "${partialMarker}" "$PLACEHOLDER"
prepare_workflow
if placeholder_exists "$PLACEHOLDER"; then
  collect_value "$PLACEHOLDER" "Value:"
fi
finish
`),
      { mode: 0o700 }
    );
    const manuallyCompletedLine = '- existing: manually completed';
    fs.writeFileSync(
      partialDocument,
      `${partialMarker}\n${manuallyCompletedLine}\n- remaining: ${partialPlaceholder}\n`,
      { mode: 0o600 }
    );
    const partial = runHelper(partialHelper, partialDocument, 'remaining value\n');
    const partialContents = fs.readFileSync(partialDocument, 'utf8');
    check(
      failures,
      partial.status === 0,
      'a helper must accept a partially completed document when it registers only remaining outcomes'
    );
    check(
      failures,
      partialContents.includes(`${manuallyCompletedLine}\n`),
      'a helper must leave manually completed values unchanged'
    );
    check(
      failures,
      partialContents.includes('remaining value<!-- sensitive-ops:partial-test:outcome-1:complete -->'),
      'a helper must mark only the remaining outcome it completes'
    );

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

    const broadModeDocument = path.join(tempDir, 'broad-mode.md');
    const broadModeContents = `<!-- sensitive-ops:secret-test -->\n- secret: ${writePlaceholder}\n`;
    fs.writeFileSync(broadModeDocument, broadModeContents, { mode: 0o644 });
    const broadModeWrite = runHelper(writeHelper, broadModeDocument, 'mode-sentinel\n');
    const broadModeOutput = `${broadModeWrite.stdout}${broadModeWrite.stderr}`;
    check(failures, broadModeWrite.status === 1, 'a helper must reject an operations document accessible to group or other users');
    check(failures, fs.readFileSync(broadModeDocument, 'utf8') === broadModeContents, 'a rejected broad-mode document must remain unchanged');
    check(failures, !broadModeOutput.includes('mode-sentinel'), 'a rejected broad-mode document must not print the sensitive value');

    const trackedRepo = path.join(tempDir, 'tracked-repo');
    const trackedDocument = path.join(trackedRepo, 'tracked.md');
    const trackedContents = `<!-- sensitive-ops:secret-test -->\n- secret: ${writePlaceholder}\n`;
    fs.mkdirSync(trackedRepo);
    const gitInit = spawnSync('git', ['init', '-q'], { cwd: trackedRepo, encoding: 'utf8' });
    fs.writeFileSync(trackedDocument, trackedContents, { mode: 0o600 });
    const gitAdd = spawnSync('git', ['add', '--', 'tracked.md'], { cwd: trackedRepo, encoding: 'utf8' });
    check(failures, gitInit.status === 0 && gitAdd.status === 0, 'the tracked-document regression fixture must be constructible');
    const trackedWrite = runHelper(writeHelper, trackedDocument, 'tracked-sentinel\n');
    const trackedOutput = `${trackedWrite.stdout}${trackedWrite.stderr}`;
    check(failures, trackedWrite.status === 1, 'a helper must reject a Git-tracked operations document');
    check(failures, fs.readFileSync(trackedDocument, 'utf8') === trackedContents, 'a rejected tracked document must remain unchanged');
    check(failures, !trackedOutput.includes('tracked-sentinel'), 'a rejected tracked document must not print the sensitive value');

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
      { mode: 0o600 }
    );
    const successfulWrite = runHelper(writeHelper, successDocument, '\ndummy&secret\n');
    const successfulOutput = `${successfulWrite.stdout}${successfulWrite.stderr}`;
    const writtenMode = fs.statSync(successDocument).mode & 0o777;
    check(failures, successfulWrite.status === 0, 'empty input must re-prompt and accept the next non-empty value');
    check(failures, fs.readFileSync(successDocument, 'utf8').includes('dummy&secret'), 'a successful replacement must preserve the exact supplied value');
    check(failures, writtenMode === 0o600, 'a successful replacement must preserve the document permission mode');
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
    const unavailableBrowserBin = path.join(tempDir, 'unavailable-browser-bin');
    fs.mkdirSync(unavailableBrowserBin);
    for (const opener of ['wslview', 'explorer.exe', 'xdg-open', 'open']) {
      fs.writeFileSync(path.join(unavailableBrowserBin, opener), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    }
    const unavailableBrowser = runHelper(browserHelper, browserDocument, '', {
      PATH: `${unavailableBrowserBin}${path.delimiter}${process.env.PATH}`,
    });
    const browserOutput = `${unavailableBrowser.stdout}${unavailableBrowser.stderr}`;
    check(failures, unavailableBrowser.status === 0, 'an unavailable browser opener must not fail the helper');
    check(failures, browserOutput.includes("couldn't open a browser"), 'an unavailable browser opener must print a manual fallback');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return failures;
}
