import { requireNativeModule } from "expo-modules-core";

/**
 * Binding for the native ScreenshotWatcher module (dev builds only).
 * Falls back to null in Expo Go / on iOS, where the module does not exist.
 */

export type ScreenshotEvent = {
  id: string;
  uri: string;
  filename: string;
  createdAt: number;
  width: number;
  height: number;
};

type NativeScreenshotWatcher = {
  addListener(event: "onScreenshotTaken", listener: (payload: ScreenshotEvent) => void): { remove(): void };
  removeAllListeners(event: "onScreenshotTaken"): void;
};

let moduleRef: NativeScreenshotWatcher | null | undefined;

function getWatcher(): NativeScreenshotWatcher | null {
  if (moduleRef === undefined) {
    try {
      moduleRef = requireNativeModule("ScreenshotWatcher") as NativeScreenshotWatcher;
    } catch {
      moduleRef = null;
    }
  }
  return moduleRef;
}

/** Subscribes to new-screenshot events; returns an unsubscribe fn or null. */
export function subscribeToScreenshots(listener: (shot: ScreenshotEvent) => void): (() => void) | null {
  const watcher = getWatcher();
  if (!watcher) return null;
  try {
    const subscription = watcher.addListener("onScreenshotTaken", listener);
    return () => subscription.remove();
  } catch {
    return null;
  }
}

export function isNativeWatcherAvailable(): boolean {
  return getWatcher() !== null;
}
