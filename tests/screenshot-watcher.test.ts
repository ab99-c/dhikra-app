import { describe, expect, it } from "vitest";

import { isNativeWatcherAvailable, subscribeToScreenshots } from "../lib/screenshot-watcher";

describe("Dhikra screenshot watcher contract", () => {
  it("is a no-op on platforms without the native module", () => {
    expect(isNativeWatcherAvailable()).toBe(false);
    expect(subscribeToScreenshots(() => undefined)).toBeNull();
  });
});
