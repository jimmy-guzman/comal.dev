"use client";

import "react-json-view-lite/dist/index.css";

import { darkStyles, JsonView } from "react-json-view-lite";

interface Props {
  data: unknown;
}

const style = {
  ...darkStyles,
  container: "bg-muted/50 p-3 text-xs font-mono overflow-auto max-h-80",
};

export function JsonViewer({ data }: Props) {
  if (data === undefined || data === null) {
    return <span className="text-muted-foreground text-xs">null</span>;
  }

  return <JsonView data={data} shouldExpandNode={() => false} style={style} />;
}
