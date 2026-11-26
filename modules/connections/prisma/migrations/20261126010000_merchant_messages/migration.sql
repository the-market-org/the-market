-- CreateTable
CREATE TABLE "merchant_messages" (
    "message_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "merchant_messages_tenant_id_sent_at_idx" ON "merchant_messages"("tenant_id", "sent_at");
