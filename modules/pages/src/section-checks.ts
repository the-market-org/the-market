/** Checks a candidate page's sections against the theme's section definitions. */
import type { listInputProblems } from "@the-market/core";
import type { SectionDefinition } from "@the-market/theme-engine";
import type { PageSection } from "./pages-types.ts";

export interface CheckContext {
  pageKey: string;
  definitions: ReadonlyMap<string, SectionDefinition>;
  listProblems: typeof listInputProblems;
}

export type SectionCheck = (input: { section: unknown; context: CheckContext }) => string | undefined;

const SECTION_SCHEMA = {
  type: "object",
  required: ["sectionType", "settings"],
  properties: { sectionType: { type: "string" }, settings: { type: "object" } },
};

/** A section must be an object with a type and settings. */
export function checkSectionShape(input: { section: unknown; context: CheckContext }): string | undefined {
  const problems = input.context.listProblems({ inputSchema: SECTION_SCHEMA, candidate: input.section });
  return problems.length === 0 ? undefined : `Invalid section: ${problems.join("; ")}`;
}

/** The section type must exist and be allowed on this page. */
export function checkSectionPlace(input: { section: unknown; context: CheckContext }): string | undefined {
  const sectionType = (input.section as PageSection).sectionType;
  const definition = input.context.definitions.get(sectionType);
  if (definition === undefined) {
    return `Unknown section: ${sectionType}`;
  }
  return definition.pageKeys.includes(input.context.pageKey)
    ? undefined
    : `Section ${sectionType} cannot be used on ${input.context.pageKey}`;
}

/** The settings must match the section's schema. Runs after the place check, so the definition exists. */
export function checkSectionSettings(input: { section: unknown; context: CheckContext }): string | undefined {
  const section = input.section as PageSection;
  const definition = input.context.definitions.get(section.sectionType) as SectionDefinition;
  const problems = input.context.listProblems({ inputSchema: definition.settingsSchema, candidate: section.settings });
  return problems.length === 0 ? undefined : `Invalid settings for ${section.sectionType}: ${problems.join("; ")}`;
}

/** The first problem with any section; each section's checks stop at its first problem. */
export function findPageProblem(input: { sections: unknown[]; context: CheckContext; checks: SectionCheck[] }): string | undefined {
  return input.sections
    .map((section) =>
      input.checks.reduce<string | undefined>((problem, check) => problem ?? check({ section, context: input.context }), undefined),
    )
    .find((problem) => problem !== undefined);
}
