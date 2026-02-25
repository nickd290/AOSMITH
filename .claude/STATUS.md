# Inventory Release App - Status

## Current Goal
Shipping location instructions support deployed to production

## Active Sprint
_No active sprint_

## Blockers
None

## Recent Changes
- 2026-01-22: Deployed shipping instructions feature to production
- 2026-01-22: Added `instructions` column to production database via direct SQL migration
- 2026-01-21: Added `instructions` field to ShippingLocation schema
- 2026-01-21: Created "AOS - Juarez US Plant" location (El Paso, TX) with "HEAT TREATED PALLETS" instruction
- 2026-01-21: Updated packing slip generation to display shipping instructions in bold red
- 2026-01-21: Updated documents API to pass instructions to packing slip
- 2025-01-20: Updated part 100307705 `unitsPerBox` from 120 → 130
- 2025-01-20: Updated part 100307705 `boxesPerPallet` from 68 → 51 (per Alecia's request - new 3-layer height requirement)
- 2025-01-20: Added PUT endpoint to `/api/parts` for admin part updates
- 2025-01-20: Created `scripts/update-part-boxes.ts` utility script
- 2025-01-20: Bootstrapped .claude/ folder with ARCHITECTURE.md and STATUS.md

## Next Session
- Test packing slip generation with Juarez location to verify instructions appear in bold red
- Verify app is working correctly in production

## Deployment
- **Platform**: Railway
- **Database**: PostgreSQL on Railway
- **Note**: Database update applied directly - no deploy needed for this change

## Notes
- Part 100307705: Now 130 units/box (was 120), 51 boxes/pallet (was 68)
- Units per pallet now: 6,630 (was 8,160)
- Change requested by Alecia Bates (ePrint Group) via email
