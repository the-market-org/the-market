/**
 * Points a database URL at one module's PostgreSQL schema.
 * Any existing `schema` parameter is replaced; other parameters are kept.
 */
export function buildModuleDatabaseUrl(input: { databaseUrl: string; schemaName: string }): string {
  const [baseUrl = "", queryText = ""] = input.databaseUrl.split("?");
  const keptPairs = queryText.split("&").filter((pair) => pair !== "" && !pair.startsWith("schema="));
  return `${baseUrl}?${[...keptPairs, `schema=${input.schemaName}`].join("&")}`;
}
