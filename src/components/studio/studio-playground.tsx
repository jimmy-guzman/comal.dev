"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  fillPathTemplateForPlayground,
  type PlaygroundOperation,
} from "@/lib/openapi-playground";

type StudioPlaygroundProps = {
  workspaceId: string;
  specRevisionNumber: number;
};

type InvokeResult =
  | {
      ok: true;
      status: number;
      body: unknown;
      source?: string;
      storedGetPath?: string;
      revisionNumber: number;
    }
  | { ok: false; error: string; status?: number };

export function StudioPlayground({ workspaceId, specRevisionNumber }: StudioPlaygroundProps) {
  const [operations, setOperations] = useState<PlaygroundOperation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [selected, setSelected] = useState<PlaygroundOperation | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [bodyInput, setBodyInput] = useState("{}");
  const [invokeResult, setInvokeResult] = useState<InvokeResult | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  const loadOperations = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/playground`, {
        credentials: "include",
      });
      const data = (await res.json()) as { operations?: PlaygroundOperation[]; error?: string };
      if (!res.ok) {
        setListError(data.error ?? "Could not load playground.");
        setOperations([]);
        return;
      }
      setOperations(data.operations ?? []);
    } catch {
      setListError("Could not load playground.");
      setOperations([]);
    } finally {
      setLoadingList(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOperations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOperations, specRevisionNumber]);

  const selectOperation = useCallback(
    async (op: PlaygroundOperation) => {
      setSelected(op);
      setPathInput(fillPathTemplateForPlayground(op.pathTemplate));
      setInvokeResult(null);
      if (!op.hasRequestBody) {
        setBodyInput("");
        setLoadingSample(false);
        return;
      }
      setLoadingSample(true);
      setBodyInput("{}");
      try {
        const params = new URLSearchParams({
          sampleBodyMethod: op.method,
          sampleBodyPathTemplate: op.pathTemplate,
        });
        const res = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/playground?${params.toString()}`,
          { credentials: "include" },
        );
        const data = (await res.json()) as { sampleRequestBody?: unknown };
        if (res.ok && data.sampleRequestBody !== undefined && data.sampleRequestBody !== null) {
          setBodyInput(JSON.stringify(data.sampleRequestBody, null, 2));
        } else {
          setBodyInput("{}");
        }
      } catch {
        setBodyInput("{}");
      } finally {
        setLoadingSample(false);
      }
    },
    [workspaceId],
  );

  const runInvoke = useCallback(async () => {
    if (!selected) {
      return;
    }
    setInvoking(true);
    setInvokeResult(null);
    try {
      let parsedBody: unknown = undefined;
      const specDefinesRequestBody =
        !["GET", "HEAD", "OPTIONS"].includes(selected.method) && selected.hasRequestBody;
      if (specDefinesRequestBody && bodyInput.trim().length > 0) {
        try {
          parsedBody = JSON.parse(bodyInput) as unknown;
        } catch {
          setInvokeResult({ ok: false, error: "Request body must be valid JSON." });
          setInvoking(false);
          return;
        }
      }

      const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/playground`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: selected.method,
          path: pathInput.trim(),
          body: parsedBody,
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        setInvokeResult({
          ok: false,
          error: typeof data.error === "string" ? data.error : "Request failed.",
          status: res.status,
        });
        return;
      }

      setInvokeResult({
        ok: true,
        status: typeof data.status === "number" ? data.status : res.status,
        body: data.body,
        source: typeof data.source === "string" ? data.source : undefined,
        storedGetPath: typeof data.storedGetPath === "string" ? data.storedGetPath : undefined,
        revisionNumber: typeof data.revisionNumber === "number" ? data.revisionNumber : 0,
      });
    } catch {
      setInvokeResult({ ok: false, error: "Network error." });
    } finally {
      setInvoking(false);
    }
  }, [workspaceId, selected, pathInput, bodyInput]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <p className="text-muted-foreground text-xs">
        Mock responses use the <strong className="text-foreground">saved</strong> spec (revision{" "}
        {specRevisionNumber}). Save the spec editor to refresh operations.
      </p>

      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
        <div className="border-border flex w-44 shrink-0 flex-col overflow-hidden border-r pr-2 md:w-52">
          <div className="text-muted-foreground mb-2 text-[0.65rem] font-medium tracking-wide uppercase">
            Operations
          </div>
          {loadingList ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : listError ? (
            <p className="text-destructive text-xs">{listError}</p>
          ) : operations.length === 0 ? (
            <p className="text-muted-foreground text-xs">No operations in the spec.</p>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <ul className="space-y-1 pr-2">
                {operations.map((op) => {
                  const id = `${op.method}:${op.pathTemplate}`;
                  const isActive =
                    selected?.method === op.method && selected?.pathTemplate === op.pathTemplate;
                  return (
                    <li key={id}>
                      <button
                        className={`hover:bg-muted/80 w-full rounded px-2 py-1.5 text-left text-xs ${
                          isActive ? "bg-muted" : ""
                        }`}
                        onClick={() => void selectOperation(op)}
                        type="button"
                      >
                        <span className="text-foreground font-mono">{op.method}</span>{" "}
                        <span className="text-muted-foreground break-all">{op.pathTemplate}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          {selected ? (
            <>
              <div className="space-y-1">
                <label
                  className="text-muted-foreground text-[0.65rem] font-medium"
                  htmlFor="pg-path"
                >
                  Path
                </label>
                <Input
                  className="font-mono text-xs"
                  id="pg-path"
                  onChange={(e) => setPathInput(e.target.value)}
                  value={pathInput}
                />
              </div>
              {!["GET", "HEAD", "OPTIONS"].includes(selected.method) && selected.hasRequestBody ? (
                <div className="flex min-h-0 flex-1 flex-col gap-1">
                  <label
                    className="text-muted-foreground text-[0.65rem] font-medium"
                    htmlFor="pg-body"
                  >
                    JSON body
                    {loadingSample ? (
                      <span className="text-muted-foreground ml-2 font-normal"> · Loading sample…</span>
                    ) : null}
                  </label>
                  <Textarea
                    className="min-h-24 flex-1 font-mono text-xs"
                    disabled={loadingSample}
                    id="pg-body"
                    onChange={(e) => setBodyInput(e.target.value)}
                    spellCheck={false}
                    value={bodyInput}
                  />
                </div>
              ) : !["GET", "HEAD", "OPTIONS"].includes(selected.method) ? (
                <p className="text-muted-foreground text-xs">
                  No request body in the spec for this operation.
                </p>
              ) : null}
              <Button
                disabled={invoking || loadingSample}
                onClick={() => void runInvoke()}
                size="sm"
                type="button"
              >
                {invoking ? "Sending…" : "Send request"}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">Select an operation to try the mock.</p>
          )}

          {invokeResult ? (
            <div className="border-border mt-1 min-h-0 flex-1 overflow-hidden border-t pt-2">
              {invokeResult.ok ? (
                <div className="flex h-full min-h-0 flex-col gap-1">
                  <p className="text-muted-foreground text-xs">
                    <span className="text-foreground font-mono">{invokeResult.status}</span>
                    {invokeResult.source ? <span> · {invokeResult.source}</span> : null}
                    {invokeResult.storedGetPath ? (
                      <span className="block break-all">
                        Stored GET{" "}
                        <code className="text-foreground">{invokeResult.storedGetPath}</code>
                      </span>
                    ) : null}
                  </p>
                  <ScrollArea className="border-border max-h-64 min-h-0 rounded border">
                    {invokeResult.body === null ? (
                      <p className="text-muted-foreground p-2 text-xs">
                        No content (empty response body).
                      </p>
                    ) : (
                      <pre className="text-foreground p-2 font-mono text-[0.65rem] leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(invokeResult.body, null, 2)}
                      </pre>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <p className="text-destructive text-xs">
                  {invokeResult.error}
                  {invokeResult.status != null ? ` (${invokeResult.status})` : ""}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

