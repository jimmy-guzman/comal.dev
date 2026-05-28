import { SidebarTrigger } from "@/components/ui/sidebar";

export const FloatingSidebarTrigger = () => {
  return (
    <div className="pt-safe-or-2 ps-safe-or-2 absolute start-0 top-0 z-20">
      <SidebarTrigger className="bg-background/80 border supports-backdrop-filter:backdrop-blur-sm" />
    </div>
  );
};
