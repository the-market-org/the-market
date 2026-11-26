# Session log entry — 2026-11-26, work package 14 task 6: the merchant screen's real check

**What happened:** Work package 14's "Done when" run passed on the development database, with every module on its own role. The first try showed that the example agent's `--host` never worked: `fetch` replaces the Host header with the URL's own, so the agent reached the `localhost` demo store, where its token was refused. A second try showed a mistake in the check script: it waited for the agent before applying, but an approved change set is still "working" for the agent until it is applied.

**Key changes:**
- `example-agent`: `applyHostName` puts `--host` into the store address as its host name, keeping the scheme and port, and the Host header override is gone. Names under `.localhost` resolve to this machine. It is tested.
- The real check, run with `--store http://localhost:3944 --host <store>.localhost`:
  1. `create-store` made a store whose connection listens for `changes.change-set.moved` and `merchant.message.sent`, and the seed added 6 products.
  2. The example agent, with an agent token for that store, added 2 items over MCP and asked for approval.
  3. `/admin` showed "Waiting for approval (1)".
  4. The change set page showed previews of home and product, plus Approve and Reject. The home preview showed "Welcome to Shop S".
  5. Approve and Apply from the screen (303 each). The agent finished with `TASK_STATE_COMPLETED`, and the storefront showed the new home.
  6. Revert from the screen (303). The storefront no longer showed it.
  7. The events address received 5 `changes.change-set.moved` events, all with valid signatures, and the server log has no errors.
- `pnpm test`: 303 pass.

**Artifacts:**
- [E] The example agent's `--host` was sent as a Host header, which `fetch` replaces, so it never reached the named store. Fix: put the host in the URL — invalidates never [medium] [2026-11-26]
- [I] An approved change set is `TASK_STATE_WORKING` for an agent until it is applied or rejected, so an agent's wait ends only after Apply or Reject — invalidates when the task states change [low] [2026-11-26]
- [D] Work package 14 is built across #146, #147 and #150 to #154, plus this pull request, and its real check has passed — invalidates never [high] [2026-11-26]

**Next steps:**
- Merge #148 to #155.
- Row-level security for the remaining modules.
- Work package 13 (the commerce agent), once the owner adds the OpenRouter key and model.
