# Testing

## Automated

```bash
npm run typecheck
npm test
npm run build
npm audit
```

The test suite covers normalization and ranking primitives. UI behavior should be verified manually inside a development vault.

## Manual QA

1. Open a development vault with at least 20 Markdown notes.
2. Enable the plugin.
3. Run `Rebuild link index`.
4. Open a note with known missing related notes.
5. Run `Review link suggestions for current note`.
6. Accept one suggestion.
7. Confirm the link is inserted under the configured footer heading.
8. Confirm existing links are not suggested again.
9. Run `Copy AI context pack for current note`.
10. Confirm the copied pack includes paths, snippets, reasons, and token estimates.
11. Set `Index languages` to `en, es` and rebuild the index.
12. Confirm English and Spanish notes can appear together when they share useful vocabulary or metadata.
