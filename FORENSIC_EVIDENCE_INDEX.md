# Forensic Evidence Index (Facts vs Interpretation)

**Purpose**: Provide a neutral, verifiable index of forensic materials. This document separates **observable artifacts** (files, hashes, timestamps, logs) from **interpretations**. It does **not** validate claims; it only organizes evidence and where to verify it.

## Scope
This index covers the primary forensic and integrity reports present in the repository. It is meant to help reviewers verify:
- What evidence exists
- Where it is stored
- How to validate it (hashes, logs, timestamps)

## Evidence Inventory (By File)

### A) Integrity / Tamper Detection (High confidence, verifiable)
- `MALICIOUS_MODIFICATION_REPORT.md`
  - Type: integrity alert report
  - Evidence: referenced file path and integrity system output
  - Verifiable by: checking `secure_integrity_manifest_*.json` and historical snapshots

- `secure_integrity_manifest_full.json` (and `.committed`, `.meta`, `.sig` variants)
  - Type: cryptographic inventory
  - Evidence: SHA256 hashes for files at specific points in time
  - Verifiable by: recomputing hashes and comparing to manifest

- `INTEGRITY_REPORT_FINAL.md`, `INTEGRITY_VERIFICATION_REPORT*.md`
  - Type: integrity verification logs
  - Evidence: audit outputs, timestamps
  - Verifiable by: running integrity tooling and comparing outputs

### B) Git / Commit Forensics (Verifiable with repo history)
- `FORENSIC_COMPLETE_ALL_COMMITS.md`
  - Type: commit census + categorization
  - Evidence: commit counts and ranges
  - Verifiable by: `git log --all --since/--until` and comparing counts

- `FORENSIC_TIMELINE_COMPLETE.md`
  - Type: timeline of commits (chronological)
  - Evidence: commit ids, timestamps, classification
  - Verifiable by: `git show <sha>` and `git log --pretty=fuller`

- `FORENSIC_REPORT_2025-12-07.md`
- `FORENSIC_REPORT_2025-12-07_UPDATED.md`
  - Type: regression analyses
  - Evidence: file diffs, commit ids, symptoms
  - Verifiable by: checking listed commits and diffs

### C) Incident Timeline / Operational Reports
- `FORENSIC_INVESTIGATION_COMPLETE.md`
  - Type: incident report (timeline, logs, system state)
  - Evidence: referenced logs, system state markers
  - Verifiable by: matching logs, timestamps, and system audit trails

### D) Narrative / Contextual Reports (Require corroboration)
- `RAPPORT_FORENSIQUE_FINAL_20251218_PHASE6.md`
  - Type: multi‑phase narrative + claims
  - Evidence: mix of technical references and narrative descriptions
  - Verifiable by: mapping each claim to artifacts (logs, hashes, commits)

- `ORGANIZED_HARASSMENT_EVIDENCE.md`
  - Type: narrative dossier
  - Evidence: reported events; may include non-technical claims
  - Verifiable by: external corroboration + logs where available

## Verification Checklist (Neutral)
1. **Integrity files**
   - Recompute SHA256 for listed files
   - Compare with `secure_integrity_manifest_*.json`

2. **Commits / Git history**
   - Verify commit counts and timestamps
   - Confirm diffs match described regressions

3. **Timeline / Logs**
   - Validate event timestamps against system logs
   - Cross-check with any preserved outputs

4. **Claims requiring corroboration**
   - Separate narrative claims from verifiable artifacts
   - Create a mapping table: claim → evidence file(s) → verification method

## Suggested Next Step (Optional)
Create a table named `CLAIM_EVIDENCE_MAP.md` with columns:
- Claim summary
- Evidence file(s)
- Verification method
- Status (Unverified / Verified / Inconclusive)

---

This index is intended to make reviews consistent, factual, and reproducible.
