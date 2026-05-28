import { ThemePicker } from "@/components/theme-picker";

export default function AppearanceSettingsPage() {
  return (
    <div className="pb-safe-or-8 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">appearance</h1>
        <p className="text-muted-foreground text-sm">how the app looks on this device.</p>
      </div>
      <ThemePicker />
    </div>
  );
}
