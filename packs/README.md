# Packs

A pack is a **complete, copyable capability**: skills, docs, templates, and any supporting scripts,
laid out exactly as they should land in a target project.

Nothing here runs in this repository. A pack is material to copy out.

## Available packs

| Pack | Capability | Dependencies |
|------|-----------|--------------|
| [dev-docs-continuity](dev-docs-continuity/PACK.md) | Task bundles + resume across sessions + commit linking | none |
| [project-hub](project-hub/PACK.md) | Registry aggregating tasks into Milestone/Feature/Requirement, with lint + sync | Node, `dev-docs-continuity` |

## Installing

Every pack has the same shape, so installation is one command:

```bash
cp -R packs/<pack-name>/files/. /path/to/your/project/
```

`files/` mirrors the destination layout, so there is no manifest, no path mapping, and no
installer to keep in sync with the contents. Read the pack's `PACK.md` for post-install steps
(some packs have one; most do not).

Packs that ship `.githooks/install.mjs` ship an identical copy — installing two such packs in
either order produces the same result.

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

- **Self-contained.** Every referenced file either ships with the pack or is a declared dependency.
- **Honest dependencies.** A pack that needs another pack says so at the top of `PACK.md`.
- **No duplicated definitions.** When two packs need the same rule, one owns the rule and the other
  references the owner. Duplication across packs is the failure mode to avoid — copies drift silently.
- **Stated boundaries.** What a pack deliberately does *not* do is as useful as what a pack does.
