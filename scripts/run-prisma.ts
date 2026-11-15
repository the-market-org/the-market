/**
 * Runs the Prisma CLI for one module against that module's own schema.
 * Usage: pnpm db <module> <prisma arguments>
 * Example: pnpm db catalog migrate dev --name add-products
 */
import { spawnSync } from "node:child_process";
import { buildModuleDatabaseUrl } from "@the-market/core";

/** Builds the pnpm arguments that run Prisma inside one module's package. */
export function buildPrismaArguments(input: { moduleName: string; prismaArguments: string[] }): string[] {
  return [
    "--filter",
    `@the-market/module-${input.moduleName}`,
    "exec",
    "prisma",
    ...input.prismaArguments,
    "--schema",
    "prisma/schema.prisma",
  ];
}

/** Runs Prisma for one module and returns the exit code. */
export function runPrisma(input: {
  moduleName: string;
  prismaArguments: string[];
  databaseUrl: string | undefined;
  buildUrl: (input: { databaseUrl: string; schemaName: string }) => string;
  buildArguments: (input: { moduleName: string; prismaArguments: string[] }) => string[];
  runCommand: (input: { commandArguments: string[]; moduleDatabaseUrl: string }) => number;
}): number {
  if (input.databaseUrl === undefined) {
    throw new Error("DATABASE_URL is not set. Add it to .env in the repository root.");
  }
  return input.runCommand({
    commandArguments: input.buildArguments({
      moduleName: input.moduleName,
      prismaArguments: input.prismaArguments,
    }),
    moduleDatabaseUrl: input.buildUrl({ databaseUrl: input.databaseUrl, schemaName: input.moduleName }),
  });
}

const [moduleName = "", ...prismaArguments] = process.argv.slice(2);

process.exitCode = runPrisma({
  moduleName,
  prismaArguments,
  databaseUrl: process.env.DATABASE_URL,
  buildUrl: buildModuleDatabaseUrl,
  buildArguments: buildPrismaArguments,
  runCommand: (command) =>
    spawnSync("pnpm", command.commandArguments, {
      stdio: "inherit",
      env: { ...process.env, MODULE_DATABASE_URL: command.moduleDatabaseUrl },
    }).status ?? 1,
});
