-- Row-level security, as in the catalog: the module's role sees and writes only the rows of the tenant its
-- client sets in app.tenant_id for each transaction. The table owner (the migration user) is not bound.
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "carts"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "cart_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "cart_lines"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
