-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "changes";

-- CreateTable
CREATE TABLE "change_sets" (
    "change_set_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "proposed_by" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL DEFAULT '',
    "failure_reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "change_sets_pkey" PRIMARY KEY ("change_set_id")
);

-- CreateTable
CREATE TABLE "change_items" (
    "item_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "change_set_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "capability_name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "change" JSONB NOT NULL,
    "revert" JSONB NOT NULL,

    CONSTRAINT "change_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateIndex
CREATE INDEX "change_sets_tenant_id_idx" ON "change_sets"("tenant_id");

-- CreateIndex
CREATE INDEX "change_items_tenant_id_idx" ON "change_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "change_items_change_set_id_position_key" ON "change_items"("change_set_id", "position");

-- AddForeignKey
ALTER TABLE "change_items" ADD CONSTRAINT "change_items_change_set_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "change_sets"("change_set_id") ON DELETE RESTRICT ON UPDATE CASCADE;

