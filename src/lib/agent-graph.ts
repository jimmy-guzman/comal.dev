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

/**
 * Detects whether wiring `childIds` as `parentId`'s sub-agents would create a
 * cycle, given the owner's existing parent->child `edges`. `parentId`'s own
 * outgoing edges are replaced by `childIds`. Returns the cycle path, or `null`
 * when the result stays acyclic.
 */
export const detectSubAgentCycle = (
  edges: Iterable<{ childAgentId: string; parentAgentId: string }>,
  parentId: string,
  childIds: string[],
): null | string[] => {
  const edgeMap = new Map<string, string[]>();

  for (const edge of edges) {
    const list = edgeMap.get(edge.parentAgentId) ?? [];

    list.push(edge.childAgentId);
    edgeMap.set(edge.parentAgentId, list);
  }

  edgeMap.set(parentId, childIds);

  return detectCycle(edgeMap, parentId);
};
