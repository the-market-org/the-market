/** `pages.page.set-sections`: replaces a page's sections, and can put the previous ones back. */
import { listInputProblems } from "@the-market/core";
import type { CapabilityDefinition } from "@the-market/core";
import { DEFAULT_SECTIONS } from "@the-market/theme-engine";
import type { SectionDefinition } from "@the-market/theme-engine";
import type { PageSection } from "./pages-types.ts";
import { checkSectionPlace, checkSectionSettings, checkSectionShape, findPageProblem } from "./section-checks.ts";

type PageKeys = { tenantId: string; pageKey: string };

interface PageServices {
  findPage: (input: PageKeys) => Promise<PageSection[] | undefined>;
  savePage: (input: PageKeys & { sections: PageSection[] }) => Promise<void>;
  removePage: (input: PageKeys) => Promise<void>;
}

/**
 * The input schema, built from the theme's sections so an agent can see each section's type, settings and pages.
 * The store's own input check reads only the top-level fields; the section checks below enforce the rest.
 */
export function buildSetSectionsSchema(definitions: readonly SectionDefinition[]): Record<string, unknown> {
  const sectionShapes = definitions.map((definition) => ({
    type: "object",
    description: `Allowed on: ${definition.pageKeys.join(", ")}`,
    required: ["sectionType", "settings"],
    properties: { sectionType: { const: definition.sectionType }, settings: definition.settingsSchema },
  }));
  const pageKeys = [...new Set(definitions.flatMap((definition) => definition.pageKeys))];
  return {
    type: "object",
    required: ["pageKey", "sections"],
    properties: { pageKey: { type: "string", enum: pageKeys }, sections: { type: "array", items: { anyOf: sectionShapes } } },
  };
}

export const SET_SECTIONS_SCHEMA: Record<string, unknown> = Object.freeze(buildSetSectionsSchema(DEFAULT_SECTIONS));

export function buildSetSectionsCapability(input: PageServices): CapabilityDefinition {
  const capabilityName = "pages.page.set-sections";
  const definitions = new Map(DEFAULT_SECTIONS.map((definition) => [definition.sectionType, definition]));
  const checks = [checkSectionShape, checkSectionPlace, checkSectionSettings];
  return {
    name: capabilityName,
    summary: "Set the sections of a page",
    inputSchema: SET_SECTIONS_SCHEMA,
    risk: "low",
    buildChange: async (request) => {
      const candidate = request.candidate as { pageKey: string; sections: PageSection[] };
      const context = { pageKey: candidate.pageKey, definitions, listProblems: listInputProblems };
      const problem = findPageProblem({ sections: candidate.sections, context, checks });
      if (problem !== undefined) {
        throw new Error(problem);
      }
      const previous = await input.findPage({ tenantId: request.tenantId, pageKey: candidate.pageKey });
      return {
        capabilityName,
        tenantId: request.tenantId,
        summary: `Set ${candidate.sections.length} sections on the ${candidate.pageKey} page`,
        change: { pageKey: candidate.pageKey, sections: candidate.sections },
        revert: previous === undefined ? { pageKey: candidate.pageKey, remove: true } : { pageKey: candidate.pageKey, sections: previous },
      };
    },
    applyChange: (request) => input.savePage({ tenantId: request.tenantId, ...(request.change as { pageKey: string; sections: PageSection[] }) }),
    revertChange: (request) => {
      const revert = request.revert as { pageKey: string; sections?: PageSection[]; remove?: boolean };
      return revert.remove === true
        ? input.removePage({ tenantId: request.tenantId, pageKey: revert.pageKey })
        : input.savePage({ tenantId: request.tenantId, pageKey: revert.pageKey, sections: revert.sections ?? [] });
    },
  };
}

/** The pages module's capabilities, built over its own registered services. */
export function listPagesCapabilities(input: {
  services: Record<string, unknown>;
  buildSetSections: typeof buildSetSectionsCapability;
}): CapabilityDefinition[] {
  return [input.buildSetSections(input.services as unknown as PageServices)];
}
