# Instruction layers

Use the target provider or harness to resolve the effective instruction
hierarchy; role names and precedence are runtime facts, not universal prose
conventions. Identify every instruction and data layer the receiver will see,
including inherited layers the prompt author cannot change.

## Assign ownership

Put a rule in the narrowest authoritative layer whose lifetime and audience
match it:

| Layer | Owns | Keep out |
|---|---|---|
| System or global | Invariants that govern every covered task; authority, durable behavior, and tool-use boundaries | Current tasks, changing facts, one-branch examples |
| Application or workflow | Stable behavior and interfaces for one agent, feature, or model call | Per-request goals and user data |
| Task or request | Current outcome, scope, accepted inputs, completion, and authorization | Claims that override a higher layer or grant unavailable capabilities |
| Tool, retrieved, or supplied data | Evidence and content to process | Instruction authority unless the caller explicitly assigns it |

Use the narrowest authoritative layer. Placing a rule above its real scope taxes
every covered task and can block valid lower-level requests; placing it below its
required scope weakens or duplicates it.

Do not copy an inherited rule into a lower layer merely to make it visible. If
two controlled layers own the same meaning, choose one authority; let lower
layers provide only the inputs that meaning consumes.

When the author cannot control a higher layer, write within the available task
layer and honor the inherited contract. A lower-layer prompt cannot grant tools,
permissions, or authority that the runtime does not provide.

## System-level prompts

Keep a system-level prompt to invariants that remain true across every task it
covers. Exclude current objectives, temporary paths, dynamic repository state,
and examples that matter only to one workflow branch. Treat every retained line
as always-loaded context.

A system prompt may direct how available capabilities are used; it is not an
access-control mechanism. Enforce credentials, filesystem, network, approval,
and tool permissions in the runtime rather than relying on prompt text.

## Validate the hierarchy

Verify that:

- the prompt reflects the provider or harness's actual precedence;
- each rule has one authority at the layer matching its scope and lifetime;
- instruction-like user, tool, or retrieved content remains data;
- every system-level line holds across representative tasks, failures, and
  adversarial lower-layer inputs.
