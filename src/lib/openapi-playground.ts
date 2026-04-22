import { base, en, Faker, generateMersenne53Randomizer } from "@faker-js/faker";

/** Max depth when generating mock JSON from schemas and resolving $ref. */
const MAX_SCHEMA_DEPTH = 12;

/** Deterministic, isolated Faker per playground invocation (safe under concurrent requests). */
export function createPlaygroundFaker(
  workspaceId: string,
  revisionNumber: number,
  method: string,
  requestPath: string,
): Faker {
  const seed = hashStringToSeed(`${workspaceId}:${revisionNumber}:${method}:${requestPath}`);
  const randomizer = generateMersenne53Randomizer(seed);
  return new Faker({ locale: [en, base], randomizer });
}

function hashStringToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h === 0 ? 1 : h;
}

function schemaType(schema: Record<string, unknown>): string | undefined {
  const t = schema.type;
  if (typeof t === "string") {
    return t;
  }
  if (Array.isArray(t)) {
    const nonNull = t.find((x) => x !== "null" && x !== "undefined");
    return typeof nonNull === "string" ? nonNull : undefined;
  }
  return undefined;
}

function mockStringFromSchema(s: Record<string, unknown>, faker: Faker): string {
  const fmt = typeof s.format === "string" ? s.format.toLowerCase() : "";
  switch (fmt) {
    case "uuid":
      return faker.string.uuid();
    case "email":
      return faker.internet.email();
    case "date-time":
      return faker.date.recent({ days: 365 }).toISOString();
    case "date":
      return faker.date.recent({ days: 365 }).toISOString().slice(0, 10);
    case "time":
      return faker.date.recent().toISOString().slice(11, 19);
    case "uri":
    case "url":
      return faker.internet.url();
    case "hostname":
      return faker.internet.domainName();
    case "ipv4":
      return faker.internet.ipv4();
    case "ipv6":
      return faker.internet.ipv6();
    case "password":
      return faker.internet.password();
    default:
      return faker.lorem.words({ min: 2, max: 5 });
  }
}

/** `{param}` placeholders become `1` — matches default playground path seeding for Faker. */
export function fillPathTemplateForPlayground(template: string): string {
  return template.replace(/\{[^}]+\}/g, "1");
}

/** Look up `paths[pathTemplate][method]` after YAML + dereference (exact path key as in OpenAPI `paths`). */
export function findOperationByPathTemplate(
  doc: Record<string, unknown>,
  pathTemplate: string,
  method: string,
): Record<string, unknown> | null {
  const paths = doc.paths;
  if (!paths || typeof paths !== "object") {
    return null;
  }
  const normalized = pathTemplate.startsWith("/") ? pathTemplate : `/${pathTemplate}`;
  const pathItem = (paths as Record<string, unknown>)[normalized];
  if (!pathItem || typeof pathItem !== "object") {
    return null;
  }
  const verb = method.toLowerCase();
  const op = (pathItem as Record<string, unknown>)[verb];
  if (!op || typeof op !== "object") {
    return null;
  }
  return op as Record<string, unknown>;
}

export type PlaygroundOperation = {
  method: string;
  pathTemplate: string;
  summary?: string;
  operationId?: string;
  /** True when the operation defines a request body in the OpenAPI document. */
  hasRequestBody: boolean;
};

export function listPlaygroundOperations(doc: Record<string, unknown>): PlaygroundOperation[] {
  const paths = doc.paths;
  if (!paths || typeof paths !== "object") {
    return [];
  }
  const out: PlaygroundOperation[] = [];
  const methods = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

  for (const pathTemplate of Object.keys(paths as Record<string, unknown>)) {
    const pathItem = (paths as Record<string, unknown>)[pathTemplate];
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }
    const item = pathItem as Record<string, unknown>;
    for (const m of methods) {
      const op = item[m];
      if (!op || typeof op !== "object") {
        continue;
      }
      const operation = op as Record<string, unknown>;
      out.push({
        method: m.toUpperCase(),
        pathTemplate,
        summary: typeof operation.summary === "string" ? operation.summary : undefined,
        operationId: typeof operation.operationId === "string" ? operation.operationId : undefined,
        hasRequestBody: typeof operation.requestBody === "object" && operation.requestBody !== null,
      });
    }
  }
  return out;
}

type ResolvedOperation = {
  pathTemplate: string;
  method: string;
  pathParams: Record<string, string>;
  operation: Record<string, unknown>;
};

/**
 * Match request path against OpenAPI path templates (e.g. /tacos/{id}).
 */
export function resolveOperation(
  doc: Record<string, unknown>,
  method: string,
  requestPath: string,
): ResolvedOperation | null {
  const paths = doc.paths;
  if (!paths || typeof paths !== "object") {
    return null;
  }
  const m = method.toLowerCase();
  const normalized = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;

  for (const pathTemplate of Object.keys(paths as Record<string, unknown>)) {
    const pathItem = (paths as Record<string, unknown>)[pathTemplate];
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }
    const item = pathItem as Record<string, unknown>;
    const op = item[m];
    if (!op || typeof op !== "object") {
      continue;
    }
    const params = matchPathTemplate(pathTemplate, normalized);
    if (params) {
      return {
        pathTemplate,
        method: method.toUpperCase(),
        pathParams: params,
        operation: op as Record<string, unknown>,
      };
    }
  }
  return null;
}

function matchPathTemplate(template: string, requestPath: string): Record<string, string> | null {
  const parts = template.split("/").filter(Boolean);
  const reqParts = requestPath.split("/").filter(Boolean);
  if (parts.length !== reqParts.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] ?? "";
    const r = reqParts[i] ?? "";
    if (p.startsWith("{") && p.endsWith("}")) {
      params[p.slice(1, -1)] = decodeURIComponent(r);
    } else if (p !== r) {
      return null;
    }
  }
  return params;
}

function resolveRef(root: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return undefined;
  }
  const segments = ref.slice(2).split("/");
  let current: unknown = root;
  for (const seg of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export function mockValueFromSchema(
  schema: unknown,
  root: Record<string, unknown>,
  depth: number,
  faker: Faker,
): unknown {
  if (depth > MAX_SCHEMA_DEPTH) {
    return null;
  }
  if (schema === null || schema === undefined) {
    return null;
  }
  if (typeof schema !== "object") {
    return null;
  }

  const s = schema as Record<string, unknown>;

  if (typeof s.$ref === "string") {
    const resolved = resolveRef(root, s.$ref);
    return mockValueFromSchema(resolved, root, depth + 1, faker);
  }

  if (Array.isArray(s.allOf) && s.allOf.length > 0) {
    return mockValueFromSchema(s.allOf[0], root, depth + 1, faker);
  }

  if (Array.isArray(s.oneOf) && s.oneOf.length > 0) {
    const picked = faker.helpers.arrayElement(s.oneOf as unknown[]);
    return mockValueFromSchema(picked, root, depth + 1, faker);
  }

  if (Array.isArray(s.anyOf) && s.anyOf.length > 0) {
    const picked = faker.helpers.arrayElement(s.anyOf as unknown[]);
    return mockValueFromSchema(picked, root, depth + 1, faker);
  }

  if (Array.isArray(s.enum) && s.enum.length > 0) {
    return faker.helpers.arrayElement(s.enum as unknown[]);
  }

  const type = schemaType(s) ?? (s.properties ? "object" : undefined);
  if (type === "string") {
    return mockStringFromSchema(s, faker);
  }
  if (type === "number") {
    const min = typeof s.minimum === "number" ? s.minimum : -1_000;
    const max = typeof s.maximum === "number" ? s.maximum : 1_000;
    return faker.number.float({ min, max, fractionDigits: 2 });
  }
  if (type === "integer") {
    const min = typeof s.minimum === "number" ? s.minimum : -1_000;
    const max = typeof s.maximum === "number" ? s.maximum : 1_000;
    return faker.number.int({ min, max });
  }
  if (type === "boolean") {
    return faker.datatype.boolean();
  }
  if (type === "array") {
    const itemSchema = s.items;
    const len = faker.number.int({ min: 1, max: 3 });
    return Array.from({ length: len }, () =>
      mockValueFromSchema(itemSchema, root, depth + 1, faker),
    );
  }
  if (type === "object" || s.properties) {
    const props = s.properties;
    const obj: Record<string, unknown> = {};
    if (props && typeof props === "object") {
      const required = Array.isArray(s.required) ? (s.required as string[]) : [];
      const keys = Object.keys(props as Record<string, unknown>);
      const keysToFill = required.length > 0 ? required : keys.slice(0, 8);
      for (const key of keysToFill) {
        const sub = (props as Record<string, unknown>)[key];
        obj[key] = mockValueFromSchema(sub, root, depth + 1, faker);
      }
    }
    return obj;
  }

  return {};
}

/** Lowest 2xx response in the spec, classified for mock generation. */
export type PrimarySuccessResponse =
  | { status: number; kind: "json"; schema: unknown }
  | { status: number; kind: "noContent" };

function sortedResponseCodes(responses: Record<string, unknown>): string[] {
  return Object.keys(responses).sort((a, b) => {
    const na = Number.parseInt(a, 10);
    const nb = Number.parseInt(b, 10);
    const aOk = !Number.isNaN(na) && na >= 200 && na < 300;
    const bOk = !Number.isNaN(nb) && nb >= 200 && nb < 300;
    if (aOk && bOk) {
      return na - nb;
    }
    if (aOk) {
      return -1;
    }
    if (bOk) {
      return 1;
    }
    return 0;
  });
}

/**
 * Picks the numerically lowest 2xx response and classifies it: JSON body mock vs no body (e.g. 204).
 */
export function pickPrimarySuccessResponse(
  operation: Record<string, unknown>,
): PrimarySuccessResponse | undefined {
  const responses = operation.responses;
  if (!responses || typeof responses !== "object") {
    return undefined;
  }
  const res = responses as Record<string, unknown>;
  const codes = sortedResponseCodes(res);

  for (const code of codes) {
    const na = Number.parseInt(code, 10);
    if (Number.isNaN(na) || na < 200 || na >= 300) {
      continue;
    }
    const response = res[code];
    if (!response || typeof response !== "object") {
      continue;
    }
    const content = (response as Record<string, unknown>).content;
    if (!content || typeof content !== "object" || Object.keys(content).length === 0) {
      return { status: na, kind: "noContent" };
    }
    const mt =
      (content as Record<string, unknown>)["application/json"] ??
      (content as Record<string, unknown>)["application/problem+json"];
    if (!mt || typeof mt !== "object") {
      return { status: na, kind: "noContent" };
    }
    const schema = (mt as Record<string, unknown>).schema;
    if (schema !== undefined) {
      return { status: na, kind: "json", schema };
    }
    return { status: na, kind: "noContent" };
  }
  return undefined;
}

export function pickSuccessResponseSchema(operation: Record<string, unknown>): unknown {
  const p = pickPrimarySuccessResponse(operation);
  return p?.kind === "json" ? p.schema : undefined;
}

export function pickRequestBodySchema(operation: Record<string, unknown>): unknown {
  const body = operation.requestBody;
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const content = (body as Record<string, unknown>).content;
  if (!content || typeof content !== "object") {
    return undefined;
  }
  const mt = (content as Record<string, unknown>)["application/json"] ?? Object.values(content)[0];
  if (!mt || typeof mt !== "object") {
    return undefined;
  }
  return (mt as Record<string, unknown>).schema;
}
