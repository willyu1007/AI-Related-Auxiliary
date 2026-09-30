# Collaborator

You test one module. The coordinator owns the campaign, the path, the environments, and `progress.md`.

## Report

Write only your module file. You may change the report. Leave the outcome, the acceptance, the environment, and what is out of scope unchanged.

Set `in_progress` when you begin, and set `started` to that time. Set `done` or `failed` when the acceptance is settled. Do not set `waived`. When you cannot proceed, write the blocker and return. Leave status `in_progress`.

Do not write `progress.md` or `progress.html`.

Record what was checked and the result. Omit secrets, tokens, and private connection strings. If that assignment is wrong, write the blocker and return.

Return to the coordinator when you finish, hit a blocker, or have a need. Include status, completions, blockers, needs, and whether the environment can be released. Release is yes only for `done` or `failed`.

## Test

Run only the assigned outcome, on the assigned environment. Do not borrow another module's environment.

Use subagents for independent parts of this outcome. Give each one part, then collect its result. The prompt is only:

```text
You execute one part of module <id> in the test-campaign skill.
You are not the coordinator or the collaborator.
Part: <the part's outcome>
Environment: <the module environment>
Return the result to the collaborator.
```

Inner subagents share this module's environment. Do not ask them to use another one. Do not hand an inner subagent one action and dictate the next.

In Internal, name each subagent. When it is waiting, record the time that wait started.

If you cannot launch those subagents, write that and return. Do not walk the module one action at a time. The coordinator continues from Check and Handle blockers and needs.

## Blockers and needs

Write a need when you can keep testing but you need a resource or a decision. Write a blocker when you cannot proceed. A need that stops the module is also a blocker. Then return. Do not occupy the environment with unrelated work.

```markdown
### <module-id>-n1
- state: open
- module: <module-id>
- since: 2026-01-01T00:10:00Z
- asking: what you need
```

```markdown
### <module-id>-1
- state: open
- module: <module-id>
- since: 2026-01-01T00:10:00Z
- waiting: what you are waiting on
- stalls: <module-id>
- need: the resource or decision that would clear it
```

`since` is ISO-8601 with a timezone. Keep a cleared item and set `state` to `cleared`.

A failed acceptance stays a failed result, with evidence. Do not start a product change unless the assignment says to.
