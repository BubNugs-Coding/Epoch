# Hundred Lives - Project Status

This is the single living project status document for Hundred Lives.
Update this file over time instead of creating new status docs.

## Last Updated
- Date: 2026-04-15
- Phase: Foundation + Core Sim + Civilization + Conflict + Chronicle + Modular Architecture + Runtime Controls + Inspector Tabs + Event Filtering + Migration + Settings Panel + Hover Labels + Tuning + Demo Mode

## Current State Snapshot

### Completed Systems
- Hidden-grid world generation with clustered terrain/resources
- 100 deterministic seeded agents with names/traits/avatars
- Core needs loop (hunger/energy/health)
- Utility-based decision system
- Movement, gather, eat, rest
- Settlement founding/joining/deposit/lifecycle
- Faction formation and dominance
- Conflict/skirmish system with battle events
- Structured event logging (base + module events)
- End conditions: all dead, faction dominance, max day, module-supported override path
- Chronicle generator with sectioned recap
- End screen with stats, notable figures, and simple trend charts
- Click-to-inspect selection for agents, settlements, and factions
- Inspector tabs (Agent/Settlement/Faction/World) and event feed filtering (All/Major)
- Migration system with migration_started/migration_completed events
- Dedicated settings panel for module toggles
- Live mini graph area in side panel
- Hover labels for selected/hovered entities on canvas
- Initial tuning pass to reduce combat/migration over-triggering
- Demo Mode system with presets and presenter metrics overlay
- Group-color rendering for social readability (settlement/faction members share color)

### Architecture Status
- Simulation and rendering are separated
- Tick order is deterministic and modularized by system files
- Module/plugin architecture exists with safe hook execution
- Module hooks integrated into init/tick/day boundaries/event flow/decision scoring/end checks
- Module config shape exists in simulation state and is UI-ready

### Example Modules
- `myths-and-magic` (placeholder flavor omen events)
- `intergalactic-invaders` (placeholder anomaly/meteor events)
- Both are registered and toggleable from runtime controls

## Recently Added
- Top control bar with:
  - Pause/Resume
  - Speed control (1x/2x/4x/8x)
  - Restart same seed
  - Start from typed seed
- Dedicated settings panel with module on/off toggles
- Single-status-document policy established (this file)
- Click interaction:
  - Click agents to inspect live stats/goals/inventory
  - Click settlements to inspect population/resources
  - Faction-linked selection and map highlighting
- Side-panel depth polish:
  - Inspector tabs for entity/world context
  - Event feed filter for major-only readability
- Settings extraction:
  - Module toggles moved into dedicated settings panel
- Migration pass:
  - Agents can initiate migration to richer terrain under pressure
  - Migration events flow into feed and chronicle context
- Hover/interaction polish:
  - Hover labels on focused entities in the world view
  - Selection and hover highlighting aligned
- Data-driven tuning workflow:
  - Added seed sweep runner: `scripts/seedSweep.ts`
  - Baseline and tuned 10-seed comparisons used to adjust conflict/migration/faction settings
- Demo reliability tooling:
  - Seed sweep now tags seed profiles (balanced/war-heavy/settlement-heavy/unstable)
  - Recommendations emitted for presentation presets
  - App-level demo presets applied with one click
- Runtime stability hardening:
  - Reworked sim loop to fixed-step interval progression plus separate visual interpolation
  - Addresses occasional tick-stall behavior observed in manual testing
- Visual readability pass:
  - Agents now render with settlement/faction group colors to reduce random-dot appearance

## Known Gaps vs Full Blueprint
- No deep diplomacy/politics (intentionally deferred)
- No timeline replay system (stretch)
- Module examples are placeholders only (by design)

## Suggested Next Steps (Priority)
1. Simulation tuning pass v2
   - Balance scarcity/combat frequency across multiple seeds
   - Improve late-game variety and avoid early collapses
   - Tune migration retention and settlement stability
2. Module expansion examples v2
   - Give each module a small gameplay effect beyond flavor events
3. Chronicle quality pass v2
   - Add more event-conditioned prose variants
4. Demo script packaging
   - Add a one-page demo runbook with preset suggestions and talking points

## Testing Status
- TypeScript build passing
- Lint diagnostics clean
- Deterministic seed initialization working
- 10-seed sweep (tuned state) summary:
  - Avg survivors: 15.0
  - Avg deaths: 85.0
  - Avg settlements founded: 5.0
  - Avg factions formed: 3.9
  - Total battles (10 runs): 1875 (down from 3224 pre-tuning)
  - Migration started/completed: 400 / 121 (was 0 / 0 pre-migration trigger fixes)

## Notes for Future Contributors / Agents
- Keep this file updated after significant milestones.
- Do not create additional progress docs unless explicitly requested.
- Preserve architecture rule: engine logic must remain independent of canvas rendering.
