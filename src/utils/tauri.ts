/** Returns true when running inside a Tauri desktop shell */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}
