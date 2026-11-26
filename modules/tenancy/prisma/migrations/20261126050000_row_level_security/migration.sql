-- Row-level security for stores. The module's role sees a store only when the transaction names it:
-- by tenant id (app.tenant_id), by host while resolving a request (app.host), or by slug while checking that a
-- new slug is free (app.slug). Creating a store needs app.create_store set to yes. Updates and deletes are
-- allowed for the named tenant only. The table owner (the migration user) is not bound.
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_rows" ON "tenant"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY "host_lookup" ON "tenant" FOR SELECT
  USING ("primary_host" = NULLIF(current_setting('app.host', true), ''));

CREATE POLICY "slug_lookup" ON "tenant" FOR SELECT
  USING ("slug" = NULLIF(current_setting('app.slug', true), ''));

CREATE POLICY "create_store" ON "tenant" FOR INSERT
  WITH CHECK (current_setting('app.create_store', true) = 'yes');
