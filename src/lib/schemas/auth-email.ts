import { z } from "zod";

export const loginEmailSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(128),
});

export const signUpEmailSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});
