"use client";

import { useForm } from "@tanstack/react-form";
import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useState } from "react";

import { loginWithEmail } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";
import { loginEmailSchema } from "@/lib/schemas/auth-email";
import { cn } from "@/lib/utils";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [githubPending, setGithubPending] = useState(false);
  const { executeAsync, result, isPending, hasErrored } = useAction(loginWithEmail);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginEmailSchema,
    },
    onSubmit: async ({ value }) => {
      await executeAsync(value);
    },
  });

  const handleGithub = () => {
    setGithubPending(true);
    void authClient.signIn
      .social({
        provider: "github",
        callbackURL: `${env.NEXT_PUBLIC_APP_URL}/`,
      })
      .finally(() => {
        setGithubPending(false);
      });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              {hasErrored && result.serverError ? (
                <p role="alert" className="text-destructive text-sm">
                  {result.serverError}
                </p>
              ) : null}
              <form.Field name="email">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        autoComplete="email"
                        placeholder="m@example.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="password">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <div className="flex items-center">
                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      </div>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="password"
                        autoComplete="current-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        aria-invalid={isInvalid}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </form.Field>
              <Field>
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      className="w-full"
                      disabled={isSubmitting || isPending || githubPending}
                      type="submit"
                    >
                      {isSubmitting || isPending ? <Spinner data-icon="inline-start" /> : null}
                      Login
                    </Button>
                  )}
                </form.Subscribe>
                <Button
                  className="w-full"
                  disabled={isPending || githubPending}
                  type="button"
                  variant="outline"
                  onClick={handleGithub}
                >
                  {githubPending ? <Spinner data-icon="inline-start" /> : null}
                  Login with GitHub
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link href="/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
