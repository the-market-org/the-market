-- Row-level security: a row is visible and writable only when app.tenant_id, set per transaction by the
-- module's client, names its tenant. The table owner (the migration user) is not bound by these policies;
-- the module's own role (market_catalog) is.
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "products"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "variants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "variants"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
