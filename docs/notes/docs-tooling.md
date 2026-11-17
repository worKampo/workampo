# Documentation tooling

> Status: deferred, from decision D46 of the former decisions log. Proposal for the future, not part of the PRD "Working foundation". It is picked up when the volume of documentation justifies it.

- **Obsidian** as an optional reader and editor for the person: open the repo (or `docs/`) as a vault; graph view, Properties over the frontmatter, Bases for filtered tables (e.g. ADRs by status), backlinks, native Mermaid.
  - Standard markdown links with relative paths, **never `[[wikilinks]]`** (GitHub, Starlight and agents do not understand them).
  - No plugin syntax inside `docs/`; `.base` views and personal notes outside `docs/` or ignored.
  - `.obsidian/` in `.gitignore`; commits always with normal git (lefthook and checks).
- **Graphify** as an optional accelerator for agents: knowledge graph of the code and documents (`graphify-out/`, ignored in git) for Discover, impact analysis in Design and detection of orphan documents. Never a dependency: without it, agents read the files as usual ([ADR-0015](../adr/0015-agent-context-multi-tool.md)). Try it on `docs/` before including it in the harness.
- **Markdown quality in `pnpm check`**: markdownlint, a link checker (lychee) and validation of the frontmatter of `docs/adr/`.
