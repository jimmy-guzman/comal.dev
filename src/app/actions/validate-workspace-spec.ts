"use server";

import { z } from "zod";

import { authClient } from "@/lib/safe-action";
import {
  validateWorkspaceSpecYaml,
  type ValidateWorkspaceSpecYamlResult,
} from "@/lib/validate-workspace-spec";

const validateWorkspaceSpecInputSchema = z.object({
  content: z.string(),
});

export const validateWorkspaceSpecAction = authClient
  .inputSchema(validateWorkspaceSpecInputSchema)
  .action(async ({ parsedInput }): Promise<ValidateWorkspaceSpecYamlResult> => {
    return validateWorkspaceSpecYaml(parsedInput.content);
  });
