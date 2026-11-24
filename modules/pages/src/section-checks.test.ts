import assert from "node:assert/strict";
import { test } from "node:test";
import { listInputProblems } from "@the-market/core";
import { DEFAULT_SECTIONS } from "@the-market/theme-engine";
import { checkSectionPlace, checkSectionSettings, checkSectionShape, findPageProblem } from "./section-checks.ts";

function findProblem(sections: unknown[]): string | undefined {
  return findPageProblem({
    sections,
    context: { pageKey: "home", definitions: new Map(DEFAULT_SECTIONS.map((definition) => [definition.sectionType, definition])), listProblems: listInputProblems },
    checks: [checkSectionShape, checkSectionPlace, checkSectionSettings],
  });
}

test("valid home sections have no problem", () => {
  assert.equal(findProblem([{ sectionType: "hero", settings: { heading: "Hi" } }, { sectionType: "product-grid", settings: {} }]), undefined);
});

test("each kind of bad section is named, and the first problem wins", () => {
  assert.equal(findProblem([{ sectionType: "marquee", settings: {} }]), "Unknown section: marquee");
  assert.equal(findProblem([{ sectionType: "product-detail", settings: {} }]), "Section product-detail cannot be used on home");
  assert.equal(findProblem([{ sectionType: "hero", settings: { heading: 3 } }]), "Invalid settings for hero: Field heading must be a string");
  assert.equal(findProblem(["hero"]), "Invalid section: Input must be an object");
  assert.equal(findProblem([{ sectionType: "hero", settings: {} }, { sectionType: "marquee", settings: {} }]), "Unknown section: marquee");
});
