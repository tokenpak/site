
### Added

- Session economics exposes optional provider-observed usage subtotals and request
  coverage through the shared API and terminal views. Incomplete full-session
  totals remain unavailable; the subtotal retains the complete request denominator.

### Fixed

- Codex lifecycle hooks register native sessions and recover completed native
  conversation turns with Python's built-in SQLite support. Fork boundaries and
  large transcript records are preserved; repeated intake does not duplicate turns.
- Session history lists report actual journal entry counts.
- Explicit recorded `xhigh` effort remains a distinct forecast cell when its
  provenance is supported. Unknown or conflicting effort stays separate.
- Shared session status views label forecast-derived guard runway as an estimate,
  consistently with the companion footer.

### Security

This release accepts the open NLTK GHSA-8mgp-746c-j5xp and Accelerate GHSA-4j2p-28q2-5m79 optional-dependency findings for this release only. Both are High under CVSS v3.1; the Accelerate advisory separately lists Moderate severity under CVSS v4. No verified published fix is available. The base install excludes both packages. Optional integrations must avoid untrusted model paths and checkpoint repositories and cannot rely on these APIs for filesystem containment. See SECURITY.md for affected extras and limitations. The findings remain open and must be resolved or reassessed before another release; all other checks remain required.

### Compatibility

- The optional `recorded_usage` contract field is backward compatible with v1
  readers. Failed requests remain in full accounting and forecast eligibility.
- Pro 0.4.3 supports OSS 1.26.0 through 1.28.0 with TIP-1.0. Upgrade the pair
  together; Pro 0.4.2 supports OSS only through 1.27.0.
- See [upgrade, rollback and known limitations](docs/release-log/v1.28.0.md).
