-- Row-level security: the module's role sees and writes only the rows of the tenant its client sets in
-- app.tenant_id for each transaction. The table owner (the migration user) is not bound.
ALTER TABLE "apps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "apps"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "app_slot_bindings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "app_slot_bindings"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
