# Session log entry — 2026-11-17, work package 7 task 2: the MCP envelope and discovery

**What happened:** The server can read MCP requests at revision `2026-07-28` and answers `server/discover`. Split in two stacked pull requests: the envelope checks, then the endpoint. Stacked on #77.

**Key changes:**
- `mcp/mcp-envelope.ts`: checks in the plan's order, first failure wins — `Origin` other than the store's host `403`; not a JSON-RPC request `400 -32600`; missing `_meta` version or client capabilities `400 -32602`; `MCP-Protocol-Version`, `Mcp-Method` or (for `tools/call`) `Mcp-Name` disagreeing with the body `400 -32020`, with the `=?base64?…?=` form decoded; unsupported version `400 -32022` with `{ supported, requested }`.
- Second pull request: `POST /mcp` for agents, `server/discover`, unknown methods `404 -32601`, results with `resultType: "complete"` and `serverInfo` in `_meta`.
- Checks: typecheck clean; all tests pass, 5 database tests skipped locally. Tests seen failing first.

**Next steps:**
- Work package 7, task 3: MCP tools.
