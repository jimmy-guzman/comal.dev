import { Layer, ManagedRuntime } from "effect";

import { AgentService } from "@/lib/agents";
import { ChatService } from "@/lib/chat";
import { ChatPersistService } from "@/lib/chat/persist-stream";
import { ChatStoreService } from "@/lib/chat/store";
import { CostService } from "@/lib/cost";
import { Credentials } from "@/lib/credentials/service";
import { EvalRunnerService } from "@/lib/eval-runner";
import { EvalService } from "@/lib/evals";
import { MemoryService } from "@/lib/memory";
import { ModelPricingService } from "@/lib/model-pricing";
import { SystemAgentService } from "@/lib/system-agent";

import { AppLive } from "./service";

const ServicesLive = Layer.mergeAll(
  AgentService.Default,
  ChatService.Default,
  ChatStoreService.Default,
  ChatPersistService.Default,
  CostService.Default,
  Credentials.Default,
  EvalService.Default,
  EvalRunnerService.Default,
  MemoryService.Default,
  ModelPricingService.Default,
  SystemAgentService.Default,
);

const MainLive = ServicesLive.pipe(Layer.provideMerge(AppLive));

export const appRuntime = ManagedRuntime.make(MainLive);
