import { Layer, ManagedRuntime } from "effect";

import { AgentService } from "@/lib/agents";
import { ChatService } from "@/lib/chat";
import { ChatPersistService } from "@/lib/chat/persist-stream";
import { ChatStoreService } from "@/lib/chat/store";
import { CostService } from "@/lib/cost";
import { EvalRunnerService } from "@/lib/eval-runner";
import { EvalService } from "@/lib/evals";
import { SystemAgentService } from "@/lib/system-agent";

import { AppLive } from "./service";

const ServicesLive = Layer.mergeAll(
  AgentService.Default,
  ChatService.Default,
  ChatStoreService.Default,
  ChatPersistService.Default,
  CostService.Default,
  EvalService.Default,
  EvalRunnerService.Default,
  SystemAgentService.Default,
);

const MainLive = ServicesLive.pipe(Layer.provideMerge(AppLive));

export const appRuntime = ManagedRuntime.make(MainLive);
