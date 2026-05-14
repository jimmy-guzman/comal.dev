import type { TraceStep } from "@/lib/chat/trace";

import { TraceStepCard } from "@/components/trace-step-card";

interface Props {
  steps: TraceStep[];
}

export function TraceTimeline({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">no events recorded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-4">
      {steps.map((step) => {
        return <TraceStepCard key={step.sequence} step={step} />;
      })}
    </div>
  );
}
