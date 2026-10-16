let sequence = 0;

/** A new record id, unique on this device: time, a running count and a random tail. */
export function createId(): string {
  return `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`;
}
