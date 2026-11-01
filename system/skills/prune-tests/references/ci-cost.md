# Reduce CI cost

Cost analysis below applies across CI systems. The GitHub routing section uses
GitHub Actions semantics; on other platforms, verify the corresponding dependency,
status, and gate behavior.

## Establish the execution paths

- Map documentation and code PRs, main pushes, manual runs, release tags,
  schedules, and special qualification entries that actually exist. Expand
  matrices; count runnable jobs and checkout steps separately from skipped
  records. Include pinned provider checkouts and their consumers.
- Read workflow source alongside real run/job/step records. Split queue and
  dispatch time, checkout, tool setup, dependency installation, generation,
  verification, scans, images, and cleanup. Separate critical-path wall time
  from summed parallel runner time; fewer jobs alone does not prove faster CI.
- Keep a verified test-pruning checkpoint separate from CI changes when both
  are authorized. Attribute gains to the change that produced them.

## Remove preparation that adds no guarantee

- Put lightweight documentation guards in an existing selector job when they
  need the same checkout. Use an explicit allowlist of human project records;
  contracts, pins, generated context, code, configuration, and unknown or mixed
  inputs keep full checks. Missing or unusable diffs select conservatively.
  Exercise the light path without installed dependencies or sibling repos;
  every guard failure must still fail the job.
- For a single-job push path, consider classifying inside that job rather than
  adding a selector runner. Keep separate selection where it enables useful
  parallel validation, such as PR runtime matrices. Do not collapse distinct
  runtime guarantees merely to reduce job count.
- Manual, release, and scheduled paths with fixed requirements can bypass the
  selector. Preserve their existing inputs, target sets, and prerequisites.
  Remove a checkout only after checking scripts, relative provider paths, pins,
  artifacts, and generated inputs that consume it.
- Narrow installs to the real checks/runtime dependency closures, including
  generators, root tools, native/optional modules, and release entry points.
  Use frozen locks and a fresh install root to verify each closure; pre-existing
  dependency trees (for example, node_modules) can conceal missing dependencies.
- Build images only where the approved event/input policy requires them.
  Identify the distinct risk first: production dependency layout, native/OS
  compatibility, runtime tools, or packaged assets. Passing source tests does
  not by itself replace artifact verification. Preserve publication conditions.

## Trace cache lifetime

- Resolve the package-manager store path after tool setup and at installation.
  Check checkout cleanup, tool reinstallation, nested workspaces, cache keys,
  restore scope, and whether a reported hit reaches the store actually used.
- On trusted persistent runners, a store outside directories removed by checkout
  or tool setup can avoid repeated downloads. Separate it by project where
  needed; preserve PR trust boundaries and do not expose a privileged runner or
  shared writable store to untrusted code. Do not delete unrelated stores.
- For archive caches, account for every consumed lock and relevant OS, arch,
  runtime/ABI, and package-manager compatibility. Distinguish store reuse from
  existing dependency installation trees (for example, node_modules); report
  actual reuse, downloads, additions, and install time, not just the cache
  action's hit flag.

## Verify GitHub routing and gates

- A skipped dependency interacts with GitHub's implicit success condition.
  When bypassing a selector, admit only the intended fixed events and expected
  skipped state; explicitly reject failure and cancellation. A broad status
  override alone is not a prerequisite gate.
- Keep required core and scan success explicit before images/publication.
  Allow a skipped selective scan only when successful selection explicitly says
  it was unnecessary. Verify matrix targets as well as whether a job is admitted.
- Check the actual YAML expressions for docs/code, mixed or missing diffs,
  selector failure, intentional/unexpected skips, cancellation, failed core or
  scan, special inputs, and publication enabled/disabled. Use the repo's workflow
  lint and an expression evaluator where useful; source evaluation is not hosted
  scheduler execution. Keep disposable checks outside the maintained test suite.
- Run the retained full verification and affected guards against the final
  source. Exercise real CI under existing authorization, using a nonpublishing
  path where possible. Verifying release conditions does not authorize creating
  tags, publishing images, deploying, or changing account billing.

## Measure and report

- Compare equivalent scopes on the same runner class and runtime; for cache
  changes, measure cold and warm runs of the same source, preferably on the same
  runner. Establish cold state only in a cache/store owned for the measurement.
  Record source, runner identity, cache state, downloads, installation time,
  step times, and total execution time; flag retries or network disturbances.
- Report workflow definitions, selected expanded jobs, and actual executed jobs
  separately. Show checkout and install reductions by event path; distinguish
  structural savings from measured elapsed savings and test-pruning gains.
- If billing, permissions, or capacity prevent runner startup, record zero-step
  refusal and the missing qualification. It is neither a performance result nor
  a green run. Do not repeatedly rerun an unchanged refusal or infer speedup from
  skipped jobs; hand off the missing measurement with its prerequisite.
