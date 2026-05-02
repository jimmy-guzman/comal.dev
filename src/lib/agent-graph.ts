type Edges = ReadonlyMap<string, readonly string[]>;

const walk = (
  edges: Edges,
  nodeId: string,
  visiting: Set<string>,
  path: string[],
): null | string[] => {
  if (visiting.has(nodeId)) {
    const cycleStart = path.indexOf(nodeId);

    return cycleStart === -1 ? [nodeId, nodeId] : [...path.slice(cycleStart), nodeId];
  }

  visiting.add(nodeId);
  path.push(nodeId);

  for (const childId of edges.get(nodeId) ?? []) {
    const cycle = walk(edges, childId, visiting, path);

    if (cycle) {
      return cycle;
    }
  }

  path.pop();
  visiting.delete(nodeId);

  return null;
};

/**
 * Detects a cycle reachable from `startId` in a directed parent->children graph.
 * Returns the cycle path (e.g. `["a", "b", "c", "a"]`) or `null` when no cycle exists.
 */
export const detectCycle = (edges: Edges, startId: string): null | string[] => {
  return walk(edges, startId, new Set(), []);
};
