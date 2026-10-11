/**
 * The message an `ipcRenderer.invoke` failure carries for people. Electron wraps the main
 * process error as "Error invoking remote method 'x': Error: <message>"; only the message is ours.
 */
export function ipcErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']*':\s*(?:\w*Error:\s*)?/, "");
}
