-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "apps";

-- CreateTable
CREATE TABLE "apps" (
    "app_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "base_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rpc_url" TEXT NOT NULL,
    "slot_skills" TEXT[],
    "permissions" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "installed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("app_id")
);

-- CreateTable
CREATE TABLE "app_slot_bindings" (
    "binding_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "slot_name" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "app_slot_bindings_pkey" PRIMARY KEY ("binding_id")
);

-- CreateIndex
CREATE INDEX "apps_tenant_id_idx" ON "apps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "apps_tenant_id_base_url_key" ON "apps"("tenant_id", "base_url");

-- CreateIndex
CREATE INDEX "app_slot_bindings_tenant_id_idx" ON "app_slot_bindings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_slot_bindings_tenant_id_slot_name_app_id_key" ON "app_slot_bindings"("tenant_id", "slot_name", "app_id");

-- AddForeignKey
ALTER TABLE "app_slot_bindings" ADD CONSTRAINT "app_slot_bindings_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("app_id") ON DELETE RESTRICT ON UPDATE CASCADE;

