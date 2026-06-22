# Testing

## Automated

```bash
npm run typecheck
npm test
npm run build
npm audit
```

The test suite covers normalization and ranking primitives. UI behavior should be verified manually inside a development vault.
Context-pack review helpers are covered with unit tests for default selection, selected filtering, summary values, feedback-report privacy, and fast-path regression behavior.

Optional local vault evaluation:

```bash
CONTEXT_PRISM_TEST_VAULT=/path/to/test-vault npm test -- tests/vault-evaluation.test.ts
```

On Windows PowerShell:

```powershell
$env:CONTEXT_PRISM_TEST_VAULT="$env:USERPROFILE\path\to\test-vault"; npx -p node@22.12.0 node .\node_modules\vitest\vitest.mjs run tests\vault-evaluation.test.ts
```

## Manual QA

1. Open a development vault with at least 20 Markdown notes.
2. Enable the plugin.
3. Confirm the one-time "What's new" modal appears when `lastSeenReleaseNotesVersion` is unset or older than the current plugin version.
4. Click `Review current note` in the release notes modal and confirm it opens `Review AI context pack for current note`.
5. Reopen Obsidian and confirm the release notes modal does not appear again for the same version.
6. Run `Show what's new in Context Prism` and confirm the release notes modal can be opened manually.
7. Run `Rebuild link index`.
8. Open a note with known missing related notes.
9. Run `Review link suggestions for current note`.
10. Accept one suggestion.
11. Confirm the link is inserted under the configured footer heading.
12. Confirm existing links are not suggested again.
13. Run `Copy AI context pack for current note`.
14. Confirm the copied pack includes paths, snippets, reasons, and token estimates.
15. Run `Review AI context pack for current note`.
16. Confirm the modal shows the active note path, ranked candidates, snippets, ranking reasons, full-note token estimates, and context-pack block estimates.
17. Confirm candidates included by the fast copy command start selected.
18. Toggle individual candidates and confirm the footer updates selected count, selected pack tokens, estimated avoided context, and removed default-pack tokens where applicable.
19. Use `Clear all` and confirm `Copy selected context pack` is disabled.
20. Use `Select all` and confirm candidates remain in original rank order.
21. Copy a selected context pack and confirm only selected candidates are included.
22. Copy a feedback report with the path opt-in disabled and confirm it does not include snippets, note bodies, or full paths.
23. Enable the feedback path opt-in and confirm paths are included but snippets and note bodies are still omitted.
24. Confirm Escape closes the modal and checkbox/button keyboard navigation works.
25. Resize to a narrow/mobile-sized window and confirm text wraps without overlap.
26. Check the modal in light and dark themes.
27. Test English, Spanish, Italian, and mixed-language notes.
28. Open a note with no candidates and confirm the modal shows an empty state.
29. If reproducible, delete or rename a candidate while the modal is open and confirm the snapshot can still be dismissed without errors.
30. If reproducible, deny clipboard access and confirm the plugin shows a copy failure notice.
31. Set `Index languages` to `en, es` and rebuild the index.
32. Confirm English and Spanish notes can appear together when they share useful vocabulary or metadata.
