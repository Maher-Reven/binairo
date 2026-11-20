import { Platform, Share } from "react-native";

export type ShareOutcome = "shared" | "copied" | "dismissed";

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error != null && "name" in error && error.name === "AbortError";
}

/**
 * Native uses the system share sheet. Web uses the share sheet when the
 * browser has one, and copies the line when it does not.
 */
export async function shareResult(line: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message: line });
    if (result.action === Share.dismissedAction) return "dismissed";
    return "shared";
  } catch (error) {
    if (isAbort(error)) return "dismissed";
    if (Platform.OS !== "web") throw error;
  }
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clipboard?.writeText) {
    await clipboard.writeText(line);
    return "copied";
  }
  throw new Error("Could not share that line.");
}
