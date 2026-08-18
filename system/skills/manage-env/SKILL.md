---
name: manage-env
description: Keep environment configuration coherent using .env.example as the contract. Use when code adds, renames, or drops an env key; when the local environment is broken or the app complains about missing environment variables; when setting up a fresh machine; or when the user asks to check env drift or bring .env.example in line with the code. Not for secrets management platforms and not for CI/CD pipeline configuration.
---

# Manage Env

`.env.example` is the contract: every key the code reads appears there, documented, with a placeholder — and nothing else does. No second contract file, no generated snapshot; the example is already the industry convention and every tool and newcomer knows to look at it.

The whole skill runs on one comparison, three sets:

- **read** — keys the code actually reads (`process.env.X`, `import.meta.env.X`, `os.environ[...]`, framework config equivalents)
- **documented** — keys in `.env.example`
- **present** — keys in the developer's local env files (`.env`, `.env.local`)

Every env problem is a difference between two of them.

## Secrets discipline (applies everywhere)

- Key **names** may appear in chat and in `.env.example`; secret **values** never appear anywhere but the developer's local files. Report a value only as `set`, `empty`, or `missing`.
- The discipline covers the inspection itself: never read a local env file raw — `cat` or a file-read puts every value into the transcript. Extract names only (`cut -d= -f1 .env.local`) and test emptiness without echoing (`grep -c '^KEY=$'`).
- `.env.example` carries placeholders and comments, never real values — not even harmless-looking ones, because the next person cannot tell which ones were harmless.
- Local env files stay gitignored and are never committed, never staged, never quoted.

## Workflow A — Contract change

When code adds, renames, or drops an env key:

1. The example changes in the **same commit** as the code that reads the key. A key born undocumented is the drift everything else here exists to repair.
2. An entry is a placeholder plus a comment: what it is for, required or optional, and a shape hint (`postgres://…`, a port number) — never a value.
3. A rename keeps the old entry for one commit, marked deprecated with a pointer to the new name, then dies. The handback names every developer-facing migration step.
4. Close with the two-way check: every read key documented, every documented key read. A documented key nothing reads is dead config — remove it with the same change, or report it if there is doubt about dynamic reads.

## Workflow B — Doctor

When the local environment is broken, the app complains about missing variables, or a fresh machine needs setting up:

1. **Build the three sets.** Grep the code for env reads; parse `.env.example`; list the keys (names only) of the local files. State which files exist.
2. **Diagnose by difference:**

   | Difference | Meaning | Action |
   |------------|---------|--------|
   | read, not documented | contract drift | add to `.env.example` with placeholder and comment |
   | read, not present locally, **required** | the likely breakage | add to the local file with an **empty** value (`KEY=`) — empty keeps the check honestly red until the real value arrives, where a fake string would turn it silently green; tell the user which keys need real values — never invent one |
   | read, not present locally, **optional with a working default** | not a breakage | document in the example; touch the local file only if the user wants the default overridden |
   | documented, never read | dead config | report; remove from the example only with approval |
   | present locally, never read | leftover | report; the user decides |
   | present but empty, and required | the quiet breakage | flag it — `set`/`empty`/`missing` is exactly what the report may say |

3. **Verify** with the project's own cheapest signal — the dev server booting, a config-loading unit test, a health check. A doctor that never re-runs the failing thing has not finished diagnosing. **Correctly still red is a valid terminal state**: when the only remaining gap is a secret nobody but the user can supply, the re-run fails for exactly the right reason, and the handback says so.
4. **Hand back:** which keys were the problem, what awaits a real value, and any contract drift fixed along the way. The example fix is ordinary committable work and follows the session's normal commit rules; local env files are never part of any commit.

## Rules

- Never print, log, or commit a secret value; names and `set`/`empty`/`missing` only.
- Never put a real value in `.env.example`.
- Never invent a value for a missing secret — placeholder plus a named ask.
- Never maintain a second env contract beside `.env.example`.
- The example changes in the same commit as the code that changes what is read.
- If no `.env.example` exists, create it from the read-set — that is the contract being born, and it needs the user to confirm required-vs-optional per key.

## Verification

After any change: the two-way check holds (read ⊆ documented, documented ⊆ read, exceptions named), and `git status` shows no local env file staged.
