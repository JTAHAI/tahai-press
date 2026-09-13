# Enterprise release controls

`npm run verify:enterprise` creates `.artifacts/enterprise-release-report.json`, a durable local record of the next twenty enterprise-GA controls. It is intentionally separate from `npm run verify:ga` for focused local review; the authoritative GA gate invokes this control plane after the root unit suite and adds clean installs and real-browser proof without weakening either requirement.

The twenty controls are:

1. governance records;
2. package and runtime contract;
3. lockfile contract;
4. content schema contract;
5. CMS boundary;
6. redirect contract;
7. unit suite;
8. media health;
9. static build;
10. deployment integrity;
11. accessibility experience;
12. reader experience;
13. performance budget;
14. source security;
15. theme supply chain;
16. evidence boundary;
17. migration reversibility;
18. recovery roundtrip;
19. publisher transfer; and
20. release package.

The gate stops at the first failure, stores bounded command output with the exact control ID, and never publishes or deploys anything. The transfer control first creates a fresh publisher handoff archive and then validates its manifest and every included file. The recovery control uses an isolated fixture that exercises restore confirmation, atomic restoration, and undo.

Run this from a prepared checkout:

```sh
npm run verify:enterprise
```

Treat a passing report as release evidence, not as authorization to deploy. A production release still requires the full clean-install and multi-browser GA gate, publisher review, and the deployment runbook.
