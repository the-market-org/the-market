# Session log entry — 2026-11-17, work package 8: the example agent

**What happened:** A scripted agent with no model now lives in `apps/example-agent`, built in four stacked pull requests on top of #89: the MCP client, the starter plan, the runner, and the command line with a real run.

**Key changes:**
- `mcp-client.ts`: one POST per request with `_meta` (`protocolVersion` `2026-07-28`, `clientCapabilities`, `clientInfo`) and the mirrored headers; `callTool` returns `structuredContent` and throws the text of a tool error; a JSON-RPC error throws `MCP <method> failed (<code>): <message>`.
- Later pull requests: `starter-plan.ts`, `run-agent.ts`, `main.ts` and `pnpm example-agent`.
- Checks: typecheck clean; all tests pass, 6 database tests skipped locally. Tests seen failing first.

**Next steps:**
- Work package 8, tasks 2 to 4.
