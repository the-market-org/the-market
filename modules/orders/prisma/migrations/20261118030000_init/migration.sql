-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "orders";

-- CreateTable
CREATE TABLE "orders" (
    "order_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currency_code" TEXT NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "payment_provider_id" TEXT NOT NULL DEFAULT '',
    "payment_reference" TEXT NOT NULL DEFAULT '',
    "placed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "line_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("line_id")
);

-- CreateIndex
CREATE INDEX "orders_tenant_id_idx" ON "orders"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_order_number_key" ON "orders"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "order_lines_tenant_id_idx" ON "order_lines"("tenant_id");

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

