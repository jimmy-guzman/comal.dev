"use server";

import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { actionClient } from "@/lib/safe-action";
import { loginEmailSchema, signUpEmailSchema } from "@/lib/schemas/auth-email";

export const loginWithEmail = actionClient
  .inputSchema(loginEmailSchema)
  .action(async ({ parsedInput }) => {
    const h = await headers();

    try {
      await auth.api.signInEmail({
        body: {
          email: parsedInput.email,
          password: parsedInput.password,
        },
        headers: h,
      });
    } catch (e) {
      if (e instanceof APIError) {
        throw new Error("Invalid email or password.");
      }
      throw e;
    }

    redirect("/");
  });

export const signUpWithEmail = actionClient
  .inputSchema(signUpEmailSchema)
  .action(async ({ parsedInput }) => {
    const h = await headers();

    try {
      await auth.api.signUpEmail({
        body: {
          name: parsedInput.name,
          email: parsedInput.email,
          password: parsedInput.password,
        },
        headers: h,
      });
    } catch (e) {
      if (e instanceof APIError) {
        throw new Error("Could not create account. Try again or sign in if you already have one.");
      }
      throw e;
    }

    redirect("/");
  });
