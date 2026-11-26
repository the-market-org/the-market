-- Row-level security: the module's role sees and writes only the rows of the tenant its client sets in
-- app.tenant_id for each transaction. The table owner (the migration user) is not bound.
ALTER TABLE "telemetry_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "telemetry_events"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "experiments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "experiments"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "exposures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_rows" ON "exposures"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
