# Example: Code review report (API + UI change)

## Summary
- Review target: `main...HEAD`
- What changed: Added `POST /api/orders` and a new `CreateOrderForm` in the UI.
- Overall risk: medium (auth + persistence path)
- Recommended next action: request changes

## Must fix (blocking)
1) **Auth/permission check is incomplete**
   - Evidence: the handler checks "logged in" but does not verify the required
     permission for creating orders.
   - Why it matters: privilege escalation in multi-tenant or role-scoped setups.
   - Proposed fix: enforce the permission in one place (middleware or use-case)
     and add a negative test.
   - Verification: unauthorized role receives `403` and creates no row.

## Should fix (important)
1) **Input validation is only partial**
   - Evidence: `quantity` is not bounded and can be negative.
   - Proposed fix: validate with the project's schema helper; return a stable
     validation error shape.
   - Verification: invalid payload returns `400` with a documented error code.

2) **Persistence types leak into the HTTP response**
   - Evidence: the handler returns the ORM entity including internal fields.
   - Proposed fix: map to a response DTO; keep ORM types inside persistence.
   - Verification: response includes only documented fields.

## May fix (optional)
- Share a small error helper to reduce duplicated `try/catch` mapping.

## Verification checklist
- [ ] Typecheck
- [ ] Unit tests for validation
- [ ] Integration test for `POST /api/orders` (auth + happy path)
- [ ] Manual UI smoke for form submission

## Notes
- Assumption: order creation requires an `orders:write`-equivalent permission.
