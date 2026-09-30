import { ValidationError } from '@inithium/api-utils';
import { deleteAsset, getAssetById } from '@inithium/db';
import { deleteObject } from '@inithium/storage';

// Every R2-backed image field (staff photo, program/product/gallery image, image settings) stores
// { url, assetId }. The Asset row - not whatever url the client sent - is the source of truth for
// a cloud image's public url, so a caller can't point a "cloud" record at an arbitrary host.
export const resolveCloudAssetUrl = async (assetId: string): Promise<string> => {
  const asset = await getAssetById(assetId);
  if (!asset) {
    throw ValidationError('Uploaded image not found');
  }
  return asset.publicUrl;
};

// R2 object before the Asset row, so a failed deleteObject leaves a still-discoverable orphan
// Asset record rather than a dangling object nothing references any more.
export const releaseCloudAsset = async (assetId: string | null | undefined): Promise<void> => {
  if (!assetId) return;
  const asset = await getAssetById(assetId);
  if (!asset) return;
  await deleteObject(asset.providerKey);
  await deleteAsset(assetId);
};

// Runs after the owning record was already saved, so a cleanup failure is logged rather than
// failing a request whose actual change already succeeded.
export const releaseReplacedCloudAsset = async (
  previousAssetId: string | null | undefined,
  nextAssetId: string | null | undefined,
): Promise<void> => {
  if (!previousAssetId || previousAssetId === nextAssetId) return;
  try {
    await releaseCloudAsset(previousAssetId);
  } catch (error) {
    console.error(`[storage] Failed to release replaced asset ${previousAssetId}:`, error);
  }
};
