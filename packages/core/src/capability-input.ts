/**
 * Checks a capability's candidate input against the small JSON Schema subset
 * capabilities use: top-level `required` and `properties` with a `type` of
 * "string", "number" or "boolean". Unknown extra fields are allowed.
 */

/** One field the schema mentions, reduced to plain values. */
export interface SchemaField {
  fieldName: string;
  expectedType: string | undefined;
  isRequired: boolean;
}

/** True for a plain object; false for null, arrays and other values. */
export function isPlainObject(candidate: unknown): boolean {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}

/** Lists every field named in `required` or `properties`, required ones first. */
export function readSchemaFields(inputSchema: Record<string, unknown>): SchemaField[] {
  const requiredNames = (inputSchema.required ?? []) as string[];
  const properties = (inputSchema.properties ?? {}) as Record<string, { type?: string }>;
  const fieldTypes: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(properties).map(([fieldName, rule]) => [fieldName, rule.type]),
  );
  return [...new Set([...requiredNames, ...Object.keys(properties)])].map((fieldName) => ({
    fieldName,
    expectedType: fieldTypes[fieldName],
    isRequired: requiredNames.includes(fieldName),
  }));
}

/** The problem with an absent field: only a required field may not be absent. */
export function describeMissingField(input: { fieldName: string; isRequired: boolean }): string | undefined {
  return input.isRequired ? `Missing field: ${input.fieldName}` : undefined;
}

/** The problem with a present field whose type differs from the schema's. */
export function describeWrongType(input: {
  fieldName: string;
  expectedType: string | undefined;
  fieldValue: unknown;
}): string | undefined {
  const typeMatches = input.expectedType === undefined || typeof input.fieldValue === input.expectedType;
  return typeMatches ? undefined : `Field ${input.fieldName} must be a ${input.expectedType}`;
}

/** The problem with one field, if any. */
export function findFieldProblem(input: {
  field: SchemaField;
  fieldValue: unknown;
  describeMissing: typeof describeMissingField;
  describeType: typeof describeWrongType;
}): string | undefined {
  return input.fieldValue === undefined
    ? input.describeMissing({ fieldName: input.field.fieldName, isRequired: input.field.isRequired })
    : input.describeType({
        fieldName: input.field.fieldName,
        expectedType: input.field.expectedType,
        fieldValue: input.fieldValue,
      });
}

/** Every problem with a candidate, given the checking functions to use. */
export function collectInputProblems(input: {
  inputSchema: Record<string, unknown>;
  candidate: unknown;
  isObject: (candidate: unknown) => boolean;
  readFields: (inputSchema: Record<string, unknown>) => SchemaField[];
  findProblem: (request: { field: SchemaField; fieldValue: unknown }) => string | undefined;
}): string[] {
  if (!input.isObject(input.candidate)) {
    return ["Input must be an object"];
  }
  const candidate = input.candidate as Record<string, unknown>;
  return input
    .readFields(input.inputSchema)
    .map((field) => input.findProblem({ field, fieldValue: candidate[field.fieldName] }))
    .filter((problem): problem is string => problem !== undefined);
}

/** Composition: every problem with a candidate input, by field name. Empty when the input is valid. */
export function listInputProblems(input: { inputSchema: Record<string, unknown>; candidate: unknown }): string[] {
  return collectInputProblems({
    ...input,
    isObject: isPlainObject,
    readFields: readSchemaFields,
    findProblem: (request) =>
      findFieldProblem({ ...request, describeMissing: describeMissingField, describeType: describeWrongType }),
  });
}
