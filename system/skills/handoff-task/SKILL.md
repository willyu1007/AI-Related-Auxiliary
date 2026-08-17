---
name: handoff-task
description: Handing the current work to a fresh session as a pasteable block. Use when this session's context has degraded enough to risk the quality of what comes next, or when the user asks for something to carry into a new session starting now.
---

# Handoff Task

Pass the baton to a session that is about to start, right now. The output is a markdown block in the conversation for the user to copy — no file is written, nothing is left behind to clean up or accidentally commit.

## Finish the work first

Complete the instruction in hand before starting a handoff. A handoff produced by abandoning the requested work is a worse outcome than no handoff.

## Judging context

The signal is degraded work, not context consumption. Watch for:

- Re-reading files already read earlier on
- Uncertainty about decisions made earlier in the same session
- Losing the thread of the plan and needing to reconstruct the whole thing

## Workflow

1. **Land the durable layer.** Bring the task bundle level with the repository at checkpoint depth — touch what the session changed, commit the verified part with its `Task:` trailer.

2. **Render the block** and present it in the conversation for the user to copy.

## Example Block format

````markdown
## T-012 · oauth-provider-integration
State: in-progress · HEAD: a3f9c21
> Stale check: if `git rev-parse --short HEAD` is not a3f9c21, discard the block — cold start
> from the repository instead.

### Goal
One sentence. What finishing looks like.

### Landed
- What is committed, with short shas.

### Uncommitted
- Which files are dirty and what is half-done. "Clean" if nothing.

### Next
1. First concrete action, with the command or the file path.
2.
3.

### Do not
- Dead ends already explored, so the next session does not walk back into them.

### Open
- Questions the next session has to resolve, and who can answer them.
````

The stale check makes the block self-verifying: the receiving session reads only the block. Time between handoff and resume is near zero, so drift is not the risk — pasting yesterday's block by mistake is.

## Delivering the block

Default: render the block in the conversation for the user to paste into a new session.

If the current environment provides a tool that creates a session and sets its first message, use it instead: create the session with the block as that message, then report that the session is ready. Never do both — one block, one destination.

## Rules

- Never break off a request part-way to write a handoff; finish what was asked, then hand off.
- Never render the block without landing the durable layer first.
- Never write the block to a file in the repository; the conversation is the channel.
- Never describe uncommitted work as landed.
- Never leave a dead end out of "Do not" — a successor re-walking one is the most expensive failure a handoff can cause.

## Contract

Progress is `00-overview.md` `State:` and nothing else.
