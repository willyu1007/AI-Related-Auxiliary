# Test data

- Create data only through the product or the project's fixture scripts, never by writing stores
  directly. Build a fixture script as a fix unit with an integration test on a disposable
  database; it requires a confirm word, is idempotent, names every object as synthetic, and prints
  what it created.
- Have the lane operator seed it as a lane change while no test batch runs, in this order: sync
  and migrate, seed, final smoke check, open. If seeding needs running services, check their
  health first.
- Give each data set its own partition, recorded under Partitions, with its objects under Objects.
  If the set needs lane configuration (allow-lists, gates), seeding includes that lane change.
- Use the existing sign-in identities and ask the user for new ones. Plan one disposable identity
  per destructive case.
- Mark consumed objects and identities under Objects and seed replacements as needed; keep the
  rest of the set and never delete objects that hold evidence.
- Upload only synthetic media or public sample images, and only into the batch's partitions.
- Use the current business date and the nearest feasible effective and expiry times, with margin
  for the operations, asynchronous processing, and evidence capture. Use separate samples for
  future times and long waits, seed time-gated samples ahead, and never backdate data, change
  clocks, or bypass business time rules.
- Use an authorized business write API from the runbook only to prepare a later check or to take
  API-level evidence; never in place of a required UI check, and never to route around a refused
  action.
- Never count data a fixture created as evidence for the flow that normally creates it; tag such
  results `fixture` in the qualification.
- Treat a lane stand-in for an external service (automatic moderation, a fake push gateway) as a
  switch with wide side effects: get a ruling and move what it replaces to the handoff package.
- Record leftover data under Partitions and decide its removal when the lane retires.
