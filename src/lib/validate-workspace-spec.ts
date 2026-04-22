import { openapiV3, openapiV31 } from "@apidevtools/openapi-schemas";
import { Ruleset, Spectral } from "@stoplight/spectral-core";
import { oas } from "@stoplight/spectral-rulesets";
import type { ErrorObject } from "ajv";
import AjvDraft04 from "ajv-draft-04";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import YAML from "yaml";

export type SpectralIssue = {
  severity: number;
  code: string | number;
  message: string;
  path: (string | number)[];
};

export type ValidateWorkspaceSpecYamlResult =
  | { ok: true; spectralIssues: SpectralIssue[] }
  | {
      ok: false;
      stage: "yaml";
      message: string;
      line?: number;
      column?: number;
    }
  | {
      ok: false;
      stage: "openapi-ajv";
      errors: Array<{ message: string; path: string; keyword?: string }>;
    }
  | {
      ok: false;
      stage: "spectral";
      issues: SpectralIssue[];
    }
  | { ok: false; stage: "version"; message: string };

let validateOpenApi30: ReturnType<InstanceType<typeof AjvDraft04>["compile"]> | undefined;
let validateOpenApi31: ReturnType<InstanceType<typeof Ajv2020>["compile"]> | undefined;
let spectral: Spectral | undefined;

function getValidate30() {
  if (!validateOpenApi30) {
    const ajv = new AjvDraft04({ allErrors: true, strict: false });
    addFormats(ajv);
    validateOpenApi30 = ajv.compile(openapiV3);
  }
  return validateOpenApi30;
}

function getValidate31() {
  if (!validateOpenApi31) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      strictSchema: false,
    });
    addFormats(ajv);
    ajv.removeKeyword("unevaluatedProperties");
    ajv.removeKeyword("if");
    validateOpenApi31 = ajv.compile(openapiV31);
  }
  return validateOpenApi31;
}

function getSpectral() {
  if (!spectral) {
    spectral = new Spectral();
    spectral.setRuleset(new Ruleset(oas));
  }
  return spectral;
}

function mapAjvErrors(errors: ErrorObject[] | null | undefined) {
  if (!errors?.length) {
    return [{ message: "OpenAPI document failed validation.", path: "" }];
  }
  return errors.map((e) => ({
    message: e.message ?? "Validation error",
    path: e.instancePath || "/",
    keyword: e.keyword,
  }));
}

function detectOpenApiMajorVersion(doc: unknown): "3.0" | "3.1" | null {
  if (!doc || typeof doc !== "object") {
    return null;
  }
  const v = (doc as Record<string, unknown>).openapi;
  if (typeof v !== "string") {
    return null;
  }
  if (/^3\.0\.\d+/.test(v)) {
    return "3.0";
  }
  if (/^3\.1\.\d+/.test(v)) {
    return "3.1";
  }
  return null;
}

export async function validateWorkspaceSpecYaml(
  content: string,
): Promise<ValidateWorkspaceSpecYamlResult> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, stage: "yaml", message: "Document is empty." };
  }

  const doc = YAML.parseDocument(content);
  if (doc.errors.length > 0) {
    const err = doc.errors[0];
    const linePos = err.linePos?.[0];
    return {
      ok: false,
      stage: "yaml",
      message: err.message,
      line: linePos?.line,
      column: linePos?.col,
    };
  }

  const parsed = doc.toJSON();
  if (parsed === undefined || parsed === null) {
    return {
      ok: false,
      stage: "yaml",
      message: "Document could not be parsed to an object.",
    };
  }

  const version = detectOpenApiMajorVersion(parsed);
  if (!version) {
    return {
      ok: false,
      stage: "version",
      message: "Only OpenAPI 3.0.x and 3.1.x are supported (set openapi to 3.0.x or 3.1.x).",
    };
  }

  const validate = version === "3.0" ? getValidate30() : getValidate31();
  const valid = validate(parsed);
  if (!valid) {
    return {
      ok: false,
      stage: "openapi-ajv",
      errors: mapAjvErrors(validate.errors),
    };
  }

  const diagnostics = await getSpectral().run(parsed, {
    ignoreUnknownFormat: true,
  });

  const mapDiagnostic = (d: (typeof diagnostics)[0]): SpectralIssue => ({
    severity: d.severity,
    code: d.code,
    message: d.message,
    path: [...d.path],
  });

  const spectralErrors = diagnostics.filter((d) => d.severity === 0);
  if (spectralErrors.length > 0) {
    return {
      ok: false,
      stage: "spectral",
      issues: spectralErrors.map(mapDiagnostic),
    };
  }

  return {
    ok: true,
    spectralIssues: diagnostics.map(mapDiagnostic),
  };
}
