-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pages";

-- CreateTable
CREATE TABLE "pages" (
    "page_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "page_key" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("page_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_tenant_id_page_key_key" ON "pages"("tenant_id", "page_key");

