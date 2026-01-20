# Inventory Release App - Status

## Current Goal
Updated part 100307705 boxes per pallet for new height requirement

## Active Sprint
_No active sprint_

## Blockers
None

## Recent Changes
- 2025-01-20: Updated part 100307705 `unitsPerBox` from 120 → 130
- 2025-01-20: Updated part 100307705 `boxesPerPallet` from 68 → 51 (per Alecia's request - new 3-layer height requirement)
- 2025-01-20: Added PUT endpoint to `/api/parts` for admin part updates
- 2025-01-20: Created `scripts/update-part-boxes.ts` utility script
- 2025-01-20: Bootstrapped .claude/ folder with ARCHITECTURE.md and STATUS.md

## Next Session
- Consider adding part editing UI to admin panel

## Deployment
- **Platform**: Railway
- **Database**: PostgreSQL on Railway
- **Note**: Database update applied directly - no deploy needed for this change

## Notes
- Part 100307705: Now 130 units/box (was 120), 51 boxes/pallet (was 68)
- Units per pallet now: 6,630 (was 8,160)
- Change requested by Alecia Bates (ePrint Group) via email
