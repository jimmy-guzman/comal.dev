import type { InferUITools, UIMessage } from "ai";

import type { BuiltinToolSet } from "@/agents/tools/build";

interface AppUIDataTypes {
  "conversation-created": { id: string };
  "conversation-title": { id: string; title: string };
}

export type AppUIMessage = UIMessage<
  unknown,
  { [K in keyof AppUIDataTypes]: AppUIDataTypes[K] },
  InferUITools<{ [K in keyof BuiltinToolSet]: BuiltinToolSet[K] }>
>;
