-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "carts";

-- CreateTable
CREATE TABLE "carts" (
    "cart_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("cart_id")
);

-- CreateTable
CREATE TABLE "cart_lines" (
    "line_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cart_lines_pkey" PRIMARY KEY ("line_id")
);

-- CreateIndex
CREATE INDEX "carts_tenant_id_idx" ON "carts"("tenant_id");

-- CreateIndex
CREATE INDEX "cart_lines_tenant_id_idx" ON "cart_lines"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_lines_cart_id_product_id_key" ON "cart_lines"("cart_id", "product_id");

-- AddForeignKey
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("cart_id") ON DELETE RESTRICT ON UPDATE CASCADE;

