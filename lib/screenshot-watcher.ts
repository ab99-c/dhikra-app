/**
 * Web fallback for the native screenshot watcher.
 * Screenshot watching is Android-only (MediaStore observer); on web there is
 * nothing to subscribe to.
 */

export type ScreenshotEvent = {
  id: string;
  uri: string;
  filename: string;
  createdAt: number;
  width: number;
  height: number;
};

export function subscribeToScreenshots(
  _listener: (shot: ScreenshotEvent) => void,
): (() => void) | null {
  return null;
}

export function isNativeWatcherAvailable(): boolean {
  return false;
}
