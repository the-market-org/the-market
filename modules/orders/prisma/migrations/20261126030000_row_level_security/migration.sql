-- Row-level security: the module's role sees and writes only the rows of the tenant its adapter sets in
-- app.tenant_id at the start of each transaction. The table owner (the migration user) is not bound.
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "orders"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "order_lines"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
