# Session log entry — 2026-11-17, work package 9 tasks 1 and 2: workflow runner and fake payment

**What happened:** The core can now run a workflow whose steps are undone in reverse when one fails, and the payment package has a fake provider for checkout until Stripe keys exist. Two stacked pull requests on top of #94.

**Key changes:**
- `packages/core/src/workflow-runner.ts`: `runWorkflow` (each step gets the state the one before returned; a failure rejects with `<step> failed: <message>`) and `undoCompletedSteps` (reverse order, each undo with the state its step produced; a failing undo is named and the others still run).
- `packages/payment/src/fake-provider.ts` (second pull request): `providerId: "fake"`; payments are authorised at once, except a chosen amount that is declined, so a failed payment can be shown on purpose.
- Checks: typecheck clean; all tests pass, 6 database tests skipped locally. Tests seen failing first.

**Next steps:**
- Work package 9, tasks 3 and 4: the carts and orders modules.
