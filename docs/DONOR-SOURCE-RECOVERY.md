# Donor source recovery record

| Candidate | Decision | Reason |
| --- | --- | --- |
| `origin/main` (`d707835`) | Accepted base | Current remote source; manual-only workflow lockdown is present. |
| Existing v3 alpha worktree | Accepted selectively | Preserved first, then clean-installed and verified by the 177-test release-equivalent baseline. |
| `tahai-press_v2.5.0`–`v2.5.2` source archives | Rejected as base | Safe archive structure, but older source identities and no v3 subsystems. |
| `TAHAI_PRESS_V2.11.0-rc.2...OVERLAY.zip` | Deferred donor | Safe archive structure and real theme/collaboration/Worker-related paths, but it declares a `>=2.9.0 <3.0.0` base that is unavailable here. It must not be applied wholesale. |
| `TAHAI_PRESS_THEME_FINAL_OVERLAY_v1.4.0.zip` | Deferred donor | Same unavailable base constraint; individual source may be ported and tested later. |
| Official theme collection v1.1.0 | Deferred donor | Eight nested packages and collection hashes are present; requires v3 compatibility review and installation tests. |
| Local v2.11 clean-source archive | Rejected for Worker claim | Contains Worker documentation paths only, not executable Worker source/config/migrations/tests. |

Archive inspections rejected traversal and duplicate-entry risks for the listed candidates. Deferred donors are not evidence that their claimed systems have been integrated.
