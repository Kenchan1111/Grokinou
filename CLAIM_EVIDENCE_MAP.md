# Claim → Evidence Map

This template maps claims to verifiable artifacts and a verification method. Use it to separate observation from interpretation.

| Claim summary | Evidence file(s) | Verification method | Status | Notes |
|---|---|---|---|---|
| Example: “Integrity tool modified without authorization” | `MALICIOUS_MODIFICATION_REPORT.md`, `secure_integrity_manifest_full.json` | Recompute SHA256, compare to manifest; verify commit timestamps | Unverified | Add links to logs/screenshots if available |

---

## Status legend
- **Unverified**: No independent verification performed yet
- **Verified**: Verified by reproducible method and evidence
- **Inconclusive**: Evidence present but not sufficient to confirm
- **Contradicted**: Evidence contradicts the claim
