# Story: Export projection results

**As a** user
**I want to** download my projection data as CSV or PDF
**So that** I can analyze it elsewhere, share it, or keep it for my records.

## Acceptance Criteria (high-level)

- User can export CSV and PDF from the projection results view.
- Export file includes:
  - Timestamp (export time, with timezone)
  - Input summary (key assumptions + scenario metadata)
- Export matches the currently selected scenario (baseline vs alternative, selected retirement age, etc.).
- Export action does not change the model; it's read-only and reproducible.