import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

/**
 * Screenshot detection for the Dhikra capture loop.
 *
 * MVP approach: scan the device's "Screenshots" album through expo-media-library
 * (works in Expo Go and dev builds, no custom native code). A background
 * FileObserver native module is the documented next step for detection while
 * the app is closed — see README roadmap.
 */

export type DetectedScreenshot = {
  id: string;
  uri: string;
  filename: string;
  createdAt: number;
  width: number;
  height: number;
  asset: MediaLibrary.Asset;
};

const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function ensureMediaPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const permission = await MediaLibrary.requestPermissionsAsync();
  return permission.granted;
}

export async function scanRecentScreenshots(
  options: { limit?: number; sinceMs?: number } = {},
): Promise<DetectedScreenshot[]> {
  if (Platform.OS === "web") return [];
  const { limit = 12, sinceMs = Date.now() - DEFAULT_WINDOW_MS } = options;
  const granted = await ensureMediaPermissions();
  if (!granted) return [];

  const album = await MediaLibrary.getAlbumAsync("Screenshots").catch(() => null);
  const query: MediaLibrary.AssetsOptions = {
    first: limit,
    sortBy: [MediaLibrary.SortBy.creationTime],
    mediaType: [MediaLibrary.MediaType.photo],
  };
  if (album) query.album = album;

  const result = await MediaLibrary.getAssetsAsync(query);
  return result.assets
    .filter((asset) => asset.creationTime >= sinceMs)
    .map((asset) => ({
      id: asset.id,
      uri: asset.uri,
      filename: asset.filename,
      createdAt: asset.creationTime,
      width: asset.width,
      height: asset.height,
      asset,
    }));
}

/** Reads a screenshot's bytes as base64 for the server vision analysis. */
export async function readScreenshotBase64(
  shot: DetectedScreenshot,
): Promise<{ base64: string; mimeType: string }> {
  const info = await MediaLibrary.getAssetInfoAsync(shot.asset);
  const localUri = info.localUri ?? shot.uri;
  const mimeType = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, mimeType };
}

export async function readImageUriBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  const mimeType = /\.png($|\?)/i.test(uri) ? "image/png" : "image/jpeg";
  if (Platform.OS !== "web") {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { base64, mimeType };
  }
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { base64: btoa(binary), mimeType: response.headers.get("content-type") || mimeType };
}
