export function createDirtySync(
  load: () => Promise<unknown>,
  onError: (error: unknown) => void,
) {
  let disposed = false,
    dirty = false,
    running: Promise<void> | null = null;
  const request = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    dirty = true;
    if (running) return running;
    running = (async () => {
      try {
        do {
          dirty = false;
          await load();
        } while (dirty && !disposed);
      } catch (error) {
        if (!disposed) onError(error);
      } finally {
        running = null;
      }
    })();
    return running;
  };
  return {
    request,
    dispose: () => {
      disposed = true;
      dirty = false;
    },
  };
}
export class EventDeduplicator {
  private ids = new Set<string>();
  accept(id: string) {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > 1000) this.ids.delete(this.ids.values().next().value!);
    return true;
  }
}
