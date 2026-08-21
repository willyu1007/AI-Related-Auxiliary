# Runtime prompts

Use this branch when an application stores, templates, or repeatedly constructs
a prompt for model execution.

## Recover the real call contract

Inspect the code path that builds and consumes the request:

- message construction and the prompt or template files actually loaded;
- every template variable, its producer, and its missing or empty-value behavior;
- model-visible tools and their schemas;
- structured-output schema, parser, retries, and failure handling;
- the caller that uses the result and the behavior it needs from it.

The rendered request and its consumers are authoritative. Do not repair a prompt
file that the call site does not load or specify an output shape the caller
ignores.

## Align runtime interfaces

- Trace every placeholder to its call-site producer and missing or empty-value
  behavior. Remove unused variables and resolve missing bindings before
  execution.

Require structured output only when a consumer needs it. Keep the schema in one
authority and ensure the model-visible contract, API schema, parser, and types
agree. Define how the caller handles invalid, partial, blocked, and failed
results rather than assuming every response is a success.

Tool schemas own tool names, parameters, and runtime validation. Prompt text
should explain selection or sequencing only when the tool contract does not make
that behavior clear; do not maintain a prose copy of the schema.

## Validate behavior

Exercise the real call path when practical with representative:

- ordinary successful input;
- ambiguous or incomplete input;
- expected failure or blocked input;
- untrusted input containing instruction-like text.

Verify variable and message mapping, tool and parser compatibility, permission
boundaries, observable completion, and the caller's handling of every supported
result. Judge behavior at the consumer boundary rather than wording or prompt
snapshots. If the real call path cannot be exercised, state that limitation
instead of treating inspection as behavioral proof.
