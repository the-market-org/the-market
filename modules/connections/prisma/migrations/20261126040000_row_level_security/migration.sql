-- Row-level security: the module's role sees and writes only the rows of the tenant its client sets in
-- app.tenant_id for each transaction. The table owner (the migration user) is not bound.
ALTER TABLE "agent_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "agent_connections"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "merchant_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "merchant_messages"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
