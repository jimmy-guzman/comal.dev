export const STUDIO_PANE_IDS = ["chat", "spec", "playground"] as const;

export type StudioPaneId = (typeof STUDIO_PANE_IDS)[number];

export type StudioPanePair = {
  left: StudioPaneId;
  right: StudioPaneId;
};

export const STUDIO_PANE_LABEL: Record<StudioPaneId, string> = {
  chat: "Chat",
  spec: "Spec editor",
  playground: "Playground",
};

export const DEFAULT_STUDIO_PANES = {
  left: "chat",
  right: "spec",
} as const satisfies StudioPanePair;

/**
 * Assigns `pane` to `column`. If that choice duplicates the other column, the two sides swap.
 * If it selects the third pane, that column updates and the previous pane for that column is hidden.
 */
export function assignStudioPane(
  column: "left" | "right",
  pane: StudioPaneId,
  current: StudioPanePair,
): StudioPanePair {
  if (column === "left") {
    if (pane === current.left) {
      return current;
    }
    if (pane === current.right) {
      return { left: current.right, right: current.left };
    }
    return { left: pane, right: current.right };
  }

  if (pane === current.right) {
    return current;
  }
  if (pane === current.left) {
    return { left: current.right, right: current.left };
  }
  return { left: current.left, right: pane };
}
