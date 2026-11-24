# Session log entry — 2026-11-17, work package 9 task 3: the `carts` module

**What happened:** Shoppers' carts now have their own module, built in three stacked pull requests (table, adapter, services) on top of #97.

**Key changes:**
- `modules/carts`: schema `carts`, tables `carts` (`tenant_id`, `status` `open|converted`) and `cart_lines` (`product_id`, `quantity`, unique per cart and product). No prices are stored; checkout reads them from the catalog. Migration `20261118020000_init`; the server loads the module; CI migrates it.
- Later pull requests: the adapter (tenant-filtered, non-UUID ids not queried, conditional `open → converted`) and the services (`createCart`, `findCart`, `setLine` with 0 removing a line, `markConverted`).
- Checks: typecheck clean; all tests pass, database tests skipped locally. Migration applied to the development database.

**Artifacts:**
- [I] The development database now has the `carts` schema — invalidates if the database is reset [low] [2026-11-17]

**Next steps:**
- Work package 9, task 4: the orders module.
