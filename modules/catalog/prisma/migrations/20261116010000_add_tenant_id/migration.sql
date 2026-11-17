-- DropIndex
DROP INDEX "products_handle_key";

-- DropIndex
DROP INDEX "variants_sku_key";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "tenant_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "variants" ADD COLUMN     "tenant_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_handle_key" ON "products"("tenant_id", "handle");

-- CreateIndex
CREATE INDEX "variants_tenant_id_idx" ON "variants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "variants_tenant_id_sku_key" ON "variants"("tenant_id", "sku");

