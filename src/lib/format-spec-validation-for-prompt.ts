import type { ValidateWorkspaceSpecYamlResult } from "@/lib/validate-workspace-spec";

function formatPath(path: (string | number)[]) {
  if (path.length === 0) {
    return "document";
  }
  return path.map(String).join(" › ");
}

export function formatSpecValidationForPrompt(
  result: ValidateWorkspaceSpecYamlResult,
  opts?: { maxIssues?: number; specValidating?: boolean },
): string {
  const maxIssues = opts?.maxIssues ?? 20;
  const lines: string[] = [];

  if (opts?.specValidating) {
    lines.push(
      "Note: The editor may still be debouncing validation; the following server validation is authoritative.",
    );
  }

  if (!result.ok) {
    switch (result.stage) {
      case "yaml": {
        lines.push(`YAML: ${result.message}`);
        if (result.line != null) {
          lines.push(
            `(line ${result.line}${result.column != null ? `, column ${result.column}` : ""})`,
          );
        }
        break;
      }
      case "version": {
        lines.push(`Version: ${result.message}`);
        break;
      }
      case "openapi-ajv": {
        lines.push(`OpenAPI schema (AJV): ${result.errors.length} issue(s).`);
        for (const err of result.errors.slice(0, maxIssues)) {
          lines.push(
            `- ${err.path || "/"}${err.keyword ? ` [${err.keyword}]` : ""}: ${err.message}`,
          );
        }
        if (result.errors.length > maxIssues) {
          lines.push(`… and ${result.errors.length - maxIssues} more.`);
        }
        break;
      }
      case "spectral": {
        lines.push(`Spectral (blocking): ${result.issues.length} issue(s).`);
        for (const issue of result.issues.slice(0, maxIssues)) {
          lines.push(`- ${formatPath(issue.path)} [${issue.code}]: ${issue.message}`);
        }
        if (result.issues.length > maxIssues) {
          lines.push(`… and ${result.issues.length - maxIssues} more.`);
        }
        break;
      }
    }
    return lines.join("\n");
  }

  lines.push("Validation: document parses and matches OpenAPI schema.");
  if (result.spectralIssues.length > 0) {
    lines.push(`Spectral notes (non-blocking): ${result.spectralIssues.length} item(s).`);
    for (const issue of result.spectralIssues.slice(0, maxIssues)) {
      lines.push(`- ${formatPath(issue.path)} [${issue.code}]: ${issue.message}`);
    }
    if (result.spectralIssues.length > maxIssues) {
      lines.push(`… and ${result.spectralIssues.length - maxIssues} more.`);
    }
  } else {
    lines.push("Spectral: no additional notes.");
  }

  return lines.join("\n");
}
