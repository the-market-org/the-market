-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "connections";

-- CreateTable
CREATE TABLE "agent_connections" (
    "connection_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "events_url" TEXT NOT NULL,
    "signing_secret" TEXT NOT NULL,
    "event_names" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "agent_connections_pkey" PRIMARY KEY ("connection_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_connections_tenant_id_key" ON "agent_connections"("tenant_id");

