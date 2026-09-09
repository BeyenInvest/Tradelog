/**
 * Global registry of "there is a form with unsaved changes open right now"
 * (fixplan F1). useModalGuard acquires an entry while its form is dirty; the
 * PWA update flow (RegisterSW) consults it so a new deploy's reload can NEVER
 * wipe a half-written trade or review — the reload simply waits until the last
 * dirty form closes or saves.
 *
 * Deliberately not React state: the registry must be readable from the SW
 * update callback outside the component tree, and a module singleton is enough
 * for one document.
 */

let dirtyCount = 0;
const cleanListeners = new Set<() => void>();

/** Mark one dirty form as open. Returns a release function (idempotent). */
export function acquireDirtyForm(): () => void {
  dirtyCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    dirtyCount--;
    if (dirtyCount === 0) {
      // Copy first: a listener may re-register or a callback may open a new form.
      for (const l of [...cleanListeners]) {
        cleanListeners.delete(l);
        l();
      }
    }
  };
}

export function hasDirtyForm(): boolean {
  return dirtyCount > 0;
}

/**
 * Run `cb` as soon as no dirty form is open — immediately when that's already
 * the case. One-shot. Returns an unsubscribe for the pending case.
 */
export function whenAllFormsClean(cb: () => void): () => void {
  if (dirtyCount === 0) {
    cb();
    return () => {};
  }
  cleanListeners.add(cb);
  return () => cleanListeners.delete(cb);
}
