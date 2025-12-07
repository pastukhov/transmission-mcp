# Repository Guidelines

## Project Structure & Module Organization
- `config.toml`: primary Codex CLI configuration; keep edits minimal and reversible.
- `auth.json`: credentials placeholder; never commit real tokens or secrets.
- `history.jsonl`: session events in JSON Lines; rotates regularly, do not rely on long-term retention.
- `log/` and `sessions/`: ephemeral runtime artifacts; safe to clear locally when troubleshooting.
- `version.json`: internal version info consumed by tools.
- Supporting files like `README.md`, `evaluation.xml`, and `src/` scripts document and exercise the workspace; avoid broad refactors without need.

## Build, Test, and Development Commands
- `ls -la`, `tree`: inspect layout quickly.
- `rg <pattern> -n`: fast search across files.
- `jq '.' config.toml`: validate or pretty-print TOML; prefer a TOML-aware tool if available.
- `tail -n 200 log/*`: review recent runtime logs when debugging.
- No formal build pipeline; run targeted scripts only when necessary.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; UTF-8; LF endings.
- JSON: double quotes, no trailing commas, compact keys.
- TOML: group related keys; prefer lower_snake_case for new entries.
- Filenames: lowercase with hyphens (e.g., `tools-sync.sh`).
- Keep diffs minimal and localized; avoid reformatting unrelated lines.

## Testing Guidelines
- No formal suite; if adding tools under `tools/`, include a short smoke test in `tools/tests/<name>_smoke.sh` with clear pass/fail exit codes.
- Document manual verification steps in PR descriptions for any behavioral change.

## Commit & Pull Request Guidelines
- Commits: imperative mood, optionally scoped (e.g., `config: add proxy options`, `docs: clarify session cleanup`). Keep changes small and reversible; reference issues with `#<id>` when applicable.
- PRs should state purpose, summarize changes, list manual verification steps, and note risks. Attach screenshots only for UI-related updates.

## Security & Configuration Tips
- Never commit real credentials or tokens; `.gitignore` already excludes `auth.json`, `history.jsonl`, `log/`, `sessions/`, and `.env*`.
- Prefer environment variables for secrets; rotate any local tokens regularly.
- Confirm with the maintainer before altering secrets, retention, or session-handling behavior.

## Agent-Specific Instructions
- Prefer targeted edits over broad refactors; keep changes focused.
- Honor these guidelines across the repository scope; when in doubt, ask before altering configuration or session artifacts.
