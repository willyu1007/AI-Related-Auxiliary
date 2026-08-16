# Packs

A pack is the **project-side scaffolding** a repository needs: contracts, templates, and control
scripts, laid out exactly as they should land in a target project.

Skills are not here. They are global and live in `system/skills/`, installed once per machine
rather than per repository. A pack is what gives those skills something to operate on.

Nothing here runs in this repository. A pack is material to copy out.

## Available packs

| Pack | Capability | Dependencies |
|------|-----------|--------------|
| [dev-docs-continuity](dev-docs-continuity/PACK.md) | The Task Contract and the `dev-docs/` bundle directories | none |
| [project-hub](project-hub/PACK.md) | Registry aggregating tasks into Milestone/Feature/Requirement, with lint + sync | Node, `dev-docs-continuity` |

## Installing

Every pack has the same shape, so installation is one command:

```bash
cp -R packs/<pack-name>/files/. /path/to/your/project/
```

`files/` mirrors the destination layout, so there is no manifest, no path mapping, and no
installer to keep in sync with the contents. Read the pack's `PACK.md` for post-install steps
(some packs have one; most do not).

Git hooks are not pack material. They ship with the `sync-task` skill, which is what documents and
installs them.

## Layout

```text
packs/<pack-name>/
  PACK.md      # what it is, what it depends on, how to install, what it does not do
  files/       # copied verbatim into the target project root
  verify.sh    # optional smoke test; runs inside a throwaway install, never distributed
```

`verify.sh` declares its prerequisites with a `# depends: <pack>, <pack>` comment. `node
checks/run.mjs` installs those first, then the pack, then runs the script — so a pack with no
`depends` line is asserting that it works entirely on its own.

## Adding a pack

A pack should be worth installing on its own. Before adding one, check:

- **Self-contained.** Every referenced file either ships with the pack, ships with a global skill,
  or is a declared dependency.
- **Honest dependencies.** A pack that needs another pack says so at the top of `PACK.md`.
- **No duplicated definitions.** When two packs need the same rule, one owns the rule and the other
  references the owner. Duplication across packs is the failure mode to avoid — copies drift silently.
- **Stated boundaries.** What a pack deliberately does *not* do is as useful as what a pack does.
