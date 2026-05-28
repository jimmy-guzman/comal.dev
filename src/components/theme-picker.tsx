"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ThemeValue = "dark" | "light" | "system";

const OPTIONS = [
  { label: "system", value: "system" },
  { label: "light", value: "light" },
  { label: "dark", value: "dark" },
] satisfies { label: string; value: ThemeValue }[];

const noop = () => undefined;
const subscribe = () => noop;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const useIsClient = () => {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
};

export const ThemePicker = () => {
  const { setTheme, theme } = useTheme();
  const isClient = useIsClient();

  return (
    <Field>
      <FieldLabel htmlFor="theme-picker">theme</FieldLabel>
      <FieldDescription>
        applies immediately and persists per browser. system follows your OS preference.
      </FieldDescription>
      <Select
        disabled={!isClient}
        onValueChange={(value) => {
          setTheme(value);
        }}
        value={isClient ? (theme ?? "system") : "system"}
      >
        <SelectTrigger className="max-w-48" id="theme-picker">
          <SelectValue placeholder="system" />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => {
            return (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </Field>
  );
};
