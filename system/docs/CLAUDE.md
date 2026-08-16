I love to build. I focus on building complex things as simple as possible, and on finding ways to reduce complexity when solving problems.

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Honor the dev's intent in both a minimal and realistic fashion. Don't be scared to propose bold ideas if they can meaningfully benefit our work.

## Interaction Protocol

### Questions are read-only

- A question is a request for an answer, not for changes. If the message opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherwise asks rather than instructs: answer it, and do not edit files.
- If the answer is obvious and the change is trivial, still answer first and offer the change. Ask before making it.

### Scope and safety

- If asked to do too much work at once, stop and state that clearly.
- Be careful with destructive actions that are not explicitly requested.

### Match ceremony to the task

- Do not spawn subagents or a multi-agent panel for work a single agent finishes in one pass. Delegation is for breadth or adversarial review, not for ordinary tasks.
- When several agents work in parallel, state file ownership up front so they do not collide.

## Code Style

- Always strive for concise, simple solutions. If a problem can be solved in a simpler way, propose it.
- Typesafety is useful — take advantage of it.
- Tests are good! Endless smoke tests, "regression tests" for feature deletions, etc, much less good. Tests should be focused, not slop.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc.
- Keep comments up to date! When making changes, keep things in sync.

## TypeScript

- `any` is the enemy. Never use it unless 100% necessary or specifically instructed. Inferred types are our friend — our systems should adapt to changes instead of requiring changes everywhere.
- If your TS code looks like a Python dev wrote it, it is bad TS code.
- Avoid one-line functions that are just casting wrappers.

## Tech Stack and Tooling

### Package manager

- Default to pnpm. Bun is the fallback (as a runtime or script tool, or where pnpm doesn't fit).
- Never use npm or yarn.

### Preferred stack

- If not already specified in the project: TypeScript, React, Vite, Tailwind, Convex.
- For more complex web and React Native apps, pull in: Zustand, React Query, Tanstack Start, Clerk (or better-auth if self-hosting), and ArkType (or zod if perf isn't an issue).
- Deploy: Vercel when a host is needed.

### Commands

- When running development server commands (e.g., `pnpm dev`), check if it is already running and request authorization.
- Don't run build commands unless specifically told to.
- Focus on checking commands like `pnpm typecheck`, `pnpm lint`, etc.

## File Hygiene

### Temporary files and artifacts

- Avoid creating unnecessary temporary scripts, tests, fixtures, logs, or generated files.
- Prefer existing tools, tests, or inline commands over creating one-off files.
- When creating temporary artifacts, ensure they have a clear purpose, target, expected lifetime, and exit condition.
- Do not keep files only because they "may be useful later".

### User-facing artifacts

- Presentation artifacts (reports, diagrams, screenshots, prototypes) should not be placed in the repository unless they are intended to become maintained project assets. Default destination: a dedicated directory on the Desktop.

## Visual and Design Work

- Do not edit real components first. For any non-trivial UI, layout, or copy change, build several distinct static HTML mocks, deliver them, report the location, and stop. Wait for a pick before implementing.
- Avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays.

## Picking the Right Models for Workflows and Subagents

Rankings, higher = better. Cost reflects what I actually pay (OpenAI is near-free for me due to a deal), not list price. Intelligence is how hard a problem you can hand the model unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model         | cost | intelligence | taste |
| ------------- | ---- | ------------ | ----- |
| gpt-5.6-sol   | 9    | 9            | 5     |
| gpt-5.6-terra | 9    | 7            | 5     |
| gpt-5.6-luna  | 9    | 5            | 4     |
| sonnet-5      | 5    | 5            | 7     |
| opus-5        | 4    | 9            | 8     |
| fable-5       | 2    | 9            | 9     |

The gpt-5.6 intelligence/taste numbers are provisional estimates from launch positioning (Sol flagship, Terra balanced, Luna fast/cheap) — tune them after real use.

How to apply:

- These are defaults, not limits. You have standing permission to override them: if a cheaper model's output doesn't meet the bar, rerun or redo the work with a smarter model without asking. Judge the output, not the price tag. Escalating costs less than shipping mediocre work.
- Codex tier selection (Claude picks per task, no fixed default): Sol for hard/broad work handed over unsupervised and for independent reviews; Terra for everyday clear-spec implementation; Luna for simple, high-volume mechanical work. When in doubt start at Terra and escalate to Sol if the output misses the bar. Reasoning effort defaults to xhigh (pinned in `~/.codex/config.toml`, decided 2026-07-18) — it costs latency, not money, and unsupervised hard work shouldn't fail for lack of thinking. Lower it per-invocation (`-c model_reasoning_effort=medium` or low) for high-volume mechanical Luna-type runs where latency dominates; `max` exists above xhigh on gpt-5.6 for extreme cases — use sparingly, output-token bloat.
- Anything user-facing (UI, copy, API design) needs taste ≥ 7.
- Reviews of plans/implementations: fable-5 or opus-5, optionally gpt-5.6-sol as an extra independent perspective.
- Never use Haiku.
- If computer use is helpful for completing or verifying work, shell out to Codex for it.
- Mechanics: gpt-5.6 models are only reachable through the Codex CLI — `codex exec` / `codex review`, tier via `--model gpt-5.6-{sol,terra,luna}` (`~/.codex/config.toml` pins `gpt-5.6-sol` + `model_reasoning_effort = "xhigh"` as the default). Use the codex-implementation, codex-review, and codex-computer-use skills; for work they don't cover (investigation, data analysis), run `codex exec -s read-only` directly with a self-contained prompt.
- Claude models (sonnet-5, opus-5, fable-5) run via the Agent/Workflow model parameter.

Using Codex inside workflows and subagents (the model parameter only takes Claude models, so use a wrapper):

- Spawn a thin Claude wrapper agent with `model: 'sonnet', effort: 'low'` whose prompt instructs it to write a self-contained codex prompt, run `codex exec` via Bash, and return the report (use `schema` on the wrapper to get structured output back).
- Always label these agents with a `codex:` prefix naming the tier, e.g. `{label: 'codex:sol:review-auth'}` — the workflow UI shows the wrapper's Claude model, so the label is the only indication the real worker is a Codex model.
- Codex runs can exceed Bash's 10-minute timeout: pass an explicit timeout, or run in the background and poll for the report file.
- Parallel Codex implementation agents must use `isolation: 'worktree'` so codex edits don't collide in the shared checkout.
- Workflow token budgets only count Claude tokens; codex work is free and invisible to `budget.spent()`.
