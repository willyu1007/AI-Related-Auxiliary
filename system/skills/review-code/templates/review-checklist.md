# Template: Code review checklist

## Must fix
- [ ] Incorrect auth/permission logic
- [ ] Inconsistent error mapping that breaks clients
- [ ] Unbounded queries or obvious performance hazards
- [ ] Security/privacy violations (secrets/PII exposure)
- [ ] Clear functional incorrectness relative to stated intent

## Should fix
- [ ] Blurred responsibilities across layers/modules
- [ ] Missing tests for critical business rules
- [ ] Excessively complex modules without decomposition
- [ ] Public API / contract instability without migration path

## May fix
- [ ] Minor naming/structure improvements
- [ ] Optional readability refactors
- [ ] Non-blocking style nits that match team standards
