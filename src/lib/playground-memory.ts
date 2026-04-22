/** In-memory store for playground mock persistence (per dev server process). */

const store = new Map<string, unknown>();

function key(workspaceId: string, method: string, path: string) {
  return `${workspaceId}\t${method}\t${path}`;
}

export function playgroundMemoryGet(
  workspaceId: string,
  method: string,
  path: string,
): unknown | undefined {
  return store.get(key(workspaceId, method, path));
}

export function playgroundMemorySet(
  workspaceId: string,
  method: string,
  path: string,
  value: unknown,
): void {
  store.set(key(workspaceId, method, path), value);
}

export function playgroundMemoryDelete(workspaceId: string, method: string, path: string): void {
  store.delete(key(workspaceId, method, path));
}
