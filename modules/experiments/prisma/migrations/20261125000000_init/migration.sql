-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "experiments";

-- CreateTable
CREATE TABLE "telemetry_events" (
    "event_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "visitor_key" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "page_key" TEXT NOT NULL DEFAULT '',
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "experiment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "variant_change_set_id" UUID NOT NULL,
    "goal_metric" TEXT NOT NULL,
    "guardrail_metric" TEXT NOT NULL,
    "traffic_percent" INTEGER NOT NULL DEFAULT 50,
    "state" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "outcome" JSONB,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("experiment_id")
);

-- CreateTable
CREATE TABLE "exposures" (
    "experiment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "visitor_key" TEXT NOT NULL,
    "arm" TEXT NOT NULL,
    "exposed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exposures_pkey" PRIMARY KEY ("experiment_id","visitor_key")
);

-- CreateIndex
CREATE INDEX "telemetry_events_tenant_id_visitor_key_event_name_idx" ON "telemetry_events"("tenant_id", "visitor_key", "event_name");

-- CreateIndex
CREATE INDEX "experiments_tenant_id_page_key_state_idx" ON "experiments"("tenant_id", "page_key", "state");

-- CreateIndex
CREATE INDEX "exposures_tenant_id_idx" ON "exposures"("tenant_id");

-- AddForeignKey
ALTER TABLE "exposures" ADD CONSTRAINT "exposures_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("experiment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

