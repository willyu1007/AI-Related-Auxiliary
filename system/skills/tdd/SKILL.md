---
name: tdd
description: Use when TDD, test-first development, or red-green-refactor is requested, or when a behaviorally defined feature or regression fix has a stable test seam suited to incremental test-first implementation.
---

# Test-Driven Development

TDD develops one observable behavior at a time through a red → green → refactor loop. Enter the loop only when the target behavior and test seam are stable enough to make the failing test a trustworthy implementation contract. A failing test is feedback; it does not by itself establish the root cause.

Use the project's domain language, relevant design decisions, existing test organization, and test tooling.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

Read [references/tests.md](references/tests.md) when test shape or quality is uncertain. Read [references/mocking.md](references/mocking.md) before introducing a mock or changing code for mockability.

## Seams: where tests go

A **seam** is the public boundary where behavior can be observed without reaching into internals. Choose the narrowest stable seam that still exercises the target behavior.

Infer the seam from the accepted behavior and established project patterns. Ask only when the choice would materially change the product interface, coverage, cost, or ownership. If the public interface itself is unresolved, clarify it before locking tests to it.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red.** Write the smallest test for the next observable behavior, run it, and confirm that it fails for the intended reason.
- **Green.** Implement the smallest complete change that satisfies that behavior. Do not anticipate future slices or add speculative behavior.
- **Refactor.** While the tests stay green, improve the current slice when doing so materially helps its structure or clarity; do not expand behavior.
- **One vertical slice at a time.** Complete one test and its implementation before choosing the next behavior.
