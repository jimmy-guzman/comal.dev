import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI } from "openapi-types";
import { headers } from "next/headers";
import YAML from "yaml";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  createPlaygroundFaker,
  fillPathTemplateForPlayground,
  findOperationByPathTemplate,
  listPlaygroundOperations,
  mockValueFromSchema,
  pickPrimarySuccessResponse,
  pickRequestBodySchema,
  resolveOperation,
} from "@/lib/openapi-playground";
import {
  playgroundMemoryDelete,
  playgroundMemoryGet,
  playgroundMemorySet,
} from "@/lib/playground-memory";
import { getWorkspaceSpecForUser } from "@/lib/studio";

const invokeBodySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  path: z.string().min(1),
  body: z.unknown().optional(),
});

const playgroundMethodEnum = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

async function parseOpenApiDoc(
  content: string,
): Promise<{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }> {
  const docYaml = YAML.parseDocument(content);
  if (docYaml.errors.length > 0) {
    return { ok: false, error: docYaml.errors[0]?.message ?? "Invalid YAML." };
  }
  const parsed = docYaml.toJSON();
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, error: "OpenAPI document must be an object." };
  }
  const v = (parsed as Record<string, unknown>).openapi;
  if (typeof v !== "string" || (!/^3\.0\.\d+/.test(v) && !/^3\.1\.\d+/.test(v))) {
    return { ok: false, error: "Only OpenAPI 3.0.x and 3.1.x are supported in the playground." };
  }
  try {
    const doc = (await SwaggerParser.dereference(
      parsed as unknown as OpenAPI.Document,
    )) as Record<string, unknown>;
    return { ok: true, doc };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not resolve OpenAPI references.";
    return { ok: false, error: msg };
  }
}

/** Decode path segments for matching (browser may send encoded). */
function normalizeRequestPath(p: string) {
  try {
    const decoded = decodeURI(p);
    return decoded.startsWith("/") ? decoded : `/${decoded}`;
  } catch {
    return p.startsWith("/") ? p : `/${p}`;
  }
}

const no2xxBody = { message: "No 2xx response defined for this operation." };

export async function GET(req: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const spec = await getWorkspaceSpecForUser(session.user.id, workspaceId);

  if (!spec) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const url = new URL(req.url);
  const sampleMethodRaw = url.searchParams.get("sampleBodyMethod");
  const samplePathRaw = url.searchParams.get("sampleBodyPathTemplate");

  if (sampleMethodRaw !== null && samplePathRaw !== null) {
    const methodParsed = playgroundMethodEnum.safeParse(sampleMethodRaw.trim().toUpperCase());
    if (!methodParsed.success) {
      return Response.json({ error: "Invalid sampleBodyMethod." }, { status: 400 });
    }
    const pathTemplate = samplePathRaw.trim();
    if (pathTemplate.length === 0) {
      return Response.json({ error: "Invalid sampleBodyPathTemplate." }, { status: 400 });
    }

    const parsed = await parseOpenApiDoc(spec.content);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const operation = findOperationByPathTemplate(parsed.doc, pathTemplate, methodParsed.data);
    if (!operation) {
      return Response.json({ error: "Operation not found for sample." }, { status: 404 });
    }

    const reqSchema = pickRequestBodySchema(operation);
    if (reqSchema === undefined) {
      return Response.json({
        sampleRequestBody: null,
        revisionNumber: spec.revisionNumber,
      });
    }

    const requestPath = fillPathTemplateForPlayground(pathTemplate);
    const faker = createPlaygroundFaker(
      workspaceId,
      spec.revisionNumber,
      methodParsed.data,
      requestPath,
    );
    const sampleRequestBody = mockValueFromSchema(reqSchema, parsed.doc, 0, faker);
    return Response.json({
      sampleRequestBody,
      revisionNumber: spec.revisionNumber,
    });
  }

  const parsed = await parseOpenApiDoc(spec.content);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const operations = listPlaygroundOperations(parsed.doc);

  return Response.json({
    revisionNumber: spec.revisionNumber,
    operations,
  });
}

export async function POST(req: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const spec = await getWorkspaceSpecForUser(session.user.id, workspaceId);

  if (!spec) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bodyParsed = invokeBodySchema.safeParse(json);
  if (!bodyParsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { method, path: rawPath, body: requestBody } = bodyParsed.data;
  const requestPath = normalizeRequestPath(rawPath);

  const parsed = await parseOpenApiDoc(spec.content);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const doc = parsed.doc;

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    const cached = playgroundMemoryGet(workspaceId, "GET", requestPath);
    if (cached !== undefined) {
      return Response.json({
        status: 200,
        body: cached,
        revisionNumber: spec.revisionNumber,
        source: "memory" as const,
      });
    }
  }

  const resolved = resolveOperation(doc, method, requestPath);
  if (!resolved) {
    return Response.json(
      {
        error: `No operation found for ${method} ${requestPath}.`,
        revisionNumber: spec.revisionNumber,
      },
      { status: 404 },
    );
  }

  const { operation } = resolved;

  const faker = createPlaygroundFaker(workspaceId, spec.revisionNumber, method, requestPath);

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    const primary = pickPrimarySuccessResponse(operation);
    if (!primary) {
      return Response.json({
        status: 200,
        body: no2xxBody,
        revisionNumber: spec.revisionNumber,
        source: "generated" as const,
      });
    }
    if (primary.kind === "noContent") {
      return Response.json({
        status: primary.status,
        body: null,
        revisionNumber: spec.revisionNumber,
        source: "generated" as const,
      });
    }
    const mock = mockValueFromSchema(primary.schema, doc, 0, faker);
    return Response.json({
      status: primary.status,
      body: mock,
      revisionNumber: spec.revisionNumber,
      source: "generated" as const,
    });
  }

  const reqSchema = pickRequestBodySchema(operation);
  const primary = pickPrimarySuccessResponse(operation);

  const hasUserRequestObject =
    requestBody !== undefined && requestBody !== null && typeof requestBody === "object";

  let merged: Record<string, unknown> = hasUserRequestObject
    ? { ...(requestBody as Record<string, unknown>) }
    : {};

  if (reqSchema !== undefined && typeof reqSchema === "object") {
    const mockFromReq = mockValueFromSchema(reqSchema, doc, 0, faker);
    if (mockFromReq && typeof mockFromReq === "object" && !Array.isArray(mockFromReq)) {
      merged = { ...(mockFromReq as Record<string, unknown>), ...merged };
    }
  }

  const canMergeRequestIntoResponse =
    (reqSchema !== undefined && typeof reqSchema === "object") || hasUserRequestObject;

  if (!primary) {
    return Response.json({
      status: 200,
      body: no2xxBody,
      revisionNumber: spec.revisionNumber,
      source: "generated" as const,
    });
  }

  if (primary.kind === "noContent") {
    if (method === "DELETE") {
      playgroundMemoryDelete(workspaceId, "GET", requestPath);
    }
    return Response.json({
      status: primary.status,
      body: null,
      revisionNumber: spec.revisionNumber,
      source: "generated" as const,
    });
  }

  let responseBody: unknown = mockValueFromSchema(primary.schema, doc, 0, faker);

  if (
    canMergeRequestIntoResponse &&
    responseBody &&
    typeof responseBody === "object" &&
    !Array.isArray(responseBody)
  ) {
    responseBody = { ...(responseBody as Record<string, unknown>), ...merged };
  }

  let storePath = requestPath;
  if (
    !resolved.pathTemplate.includes("{") &&
    (method === "POST" || method === "PUT") &&
    responseBody &&
    typeof responseBody === "object" &&
    !Array.isArray(responseBody) &&
    "id" in (responseBody as Record<string, unknown>)
  ) {
    const base = requestPath.replace(/\/$/, "");
    const idVal = (responseBody as { id: unknown }).id;
    storePath = `${base}/${String(idVal)}`;
  }

  playgroundMemorySet(workspaceId, "GET", storePath, responseBody);

  return Response.json({
    status: primary.status,
    body: responseBody,
    revisionNumber: spec.revisionNumber,
    source: "generated" as const,
    storedGetPath: storePath,
  });
}
