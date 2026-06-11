const KEY = 'xwing:guestId';

/** A durable anonymous id for this device — no signup. (Signed token is a later hardening.) */
export function getGuestId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
