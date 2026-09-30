import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Box, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '../components';
import { FieldShell } from '../components/FieldShell/FieldShell';
import { useElementSize } from './useElementSize';
import type { FieldProps } from '../tokens/field';

export interface MediaFieldTab {
  readonly value: string;
  readonly label: string;
  readonly content: ReactNode;
}

export interface UploadedAsset {
  readonly url: string;
  readonly assetId: string;
}

export interface MediaFieldHandle {
  // Resolves any pending (selected-but-not-yet-uploaded) crop into a real upload and returns the
  // result directly - a caller must NOT instead just re-read this component's own `value` after
  // awaiting this, since the state update from a successful upload is applied via this
  // component's own setState and isn't guaranteed visible in the caller's already-captured render
  // closure by the time this promise resolves (a classic stale-closure trap across an await).
  // Returns null when there's nothing pending to resolve (no file was ever selected, or a
  // different tab is active) - the caller's already-known value is already final in that case.
  // Throws if a pending upload was attempted and failed, so a caller's own save flow (already
  // wrapped in its own try/catch) aborts instead of silently saving without the new image.
  readonly resolvePendingUpload: () => Promise<UploadedAsset | null>;
}

export interface MediaFieldProps extends FieldProps {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (url: string) => void;
  // Fires only on a successful Upload commit (null on a URL-paste commit or when nothing has
  // been chosen yet) - richer future consumers that want to persist the assetId (not just the
  // bare url every consumer in this pass stores) use this.
  readonly onAssetChange?: (asset: UploadedAsset | null) => void;
  // Undefined = no Upload tab renders. This is the entire "is storage installed" signal: only a
  // storage-aware replacement of the calling dialog ever supplies this prop, and which version
  // of that file is on disk is controlled by the CLI's existing requires-gated injection
  // mechanism - MediaField itself never imports @inithium/storage or @inithium/api-client.
  readonly onUpload?: (file: File) => Promise<UploadedAsset>;
  // Composition slot - a caller's own generator UI (Avatar's dicebear/initials controls,
  // Banner's trianglify controls) renders here unchanged; MediaField never imports either.
  readonly extraTabs?: readonly MediaFieldTab[];
  readonly mode?: string;
  readonly defaultMode?: string;
  readonly onModeChange?: (mode: string) => void;
  readonly accept?: string;
  readonly maxSizeBytes?: number;
  // width / height of the crop frame a selected file is dragged against before upload - callers
  // whose display container isn't square (Banner's wide strip vs Avatar's 1:1 circle) must pass
  // their own real ratio, or an uploaded image ends up centered against the wrong shape (see
  // ImageCropStep's own comment on why this can't just default to whatever the source image is).
  readonly aspectRatio?: number;
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_ACCEPT = 'image/*';
const DEFAULT_ASPECT_RATIO = 1;
// Caps the exported crop's long edge - full source resolution within the visible crop region
// would otherwise scale with however large the user's source photo happens to be (a 12MP phone
// photo cropped to a thin banner strip can still be several thousand px wide), well past what an
// avatar/banner ever needs and well past the 5MB server-side cap this would risk hitting at
// higher resolutions.
const MAX_CROP_OUTPUT_DIMENSION = 1600;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

interface ImageCropStepProps {
  readonly file: File;
  readonly aspectRatio: number;
  readonly disabled?: boolean;
  readonly onCancel: () => void;
}

export interface ImageCropStepHandle {
  // Renders whatever's currently visible in the frame out to a new File at the source image's
  // own native resolution (Canvas's drawImage source rect is always in natural-image pixels,
  // regardless of the image's current CSS-rendered size). Resolves null if the image/frame
  // haven't finished measuring yet - callers should treat that as a retryable failure.
  readonly getCroppedFile: () => Promise<File | null>;
}

// Pan-only reposition-before-upload step (no zoom) - the source image is scaled to fully cover
// a fixed-aspect-ratio frame (the same "cover" behavior CSS object-fit: cover already applies at
// render time, just computed explicitly here so drag bounds can be derived from it), then the
// user drags it within that frame. Dragging is clamped so the frame can never reveal empty space
// past the image's edges. There's deliberately no "confirm crop" button here - whatever position
// is current at the moment the caller invokes getCroppedFile (via MediaField's own
// resolvePendingUpload, itself invoked by the outer dialog's Save button) is what gets used, so
// there's no separate confirm-then-save double submission for the user to trip over.
const ImageCropStep = forwardRef<ImageCropStepHandle, ImageCropStepProps>(({ file, aspectRatio, disabled, onCancel }, ref) => {
  // Deliberately NOT `useMemo(() => URL.createObjectURL(file), [file])` + a separate cleanup
  // effect - under StrictMode's dev-only double-invoke (mount -> run effects -> clean them up ->
  // run them again), a cleanup effect keyed off a memoized value revokes that same URL on the
  // simulated first mount, and the replayed effect never gets a fresh one since the memo doesn't
  // recompute. Creating and revoking the URL inside the *same* effect invocation sidesteps that -
  // the replay simply creates and stores a new URL rather than reusing an already-revoked one.
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const { ref: frameRef, size: frameSize } = useElementSize();
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  // Centers the image in the frame exactly once, the first moment both measurements are known -
  // re-centering on every later resize would fight the user's own drag.
  const hasCenteredRef = useRef(false);
  // getCroppedFile (below) is only rebuilt when its own dependency array changes, not on every
  // drag frame - mirroring the live position into a ref lets it always read the latest value
  // without needing position itself as a dependency (which would rebuild the handle, and thus
  // reassign the forwarded ref, on every pixel of drag movement).
  const positionRef = useRef(position);
  positionRef.current = position;

  const frameWidth = frameSize?.width ?? 0;
  const frameHeight = frameSize?.height ?? 0;
  const scale =
    naturalSize && frameWidth && frameHeight
      ? Math.max(frameWidth / naturalSize.width, frameHeight / naturalSize.height)
      : 0;
  const scaledWidth = naturalSize ? naturalSize.width * scale : 0;
  const scaledHeight = naturalSize ? naturalSize.height * scale : 0;
  // <= 0 by construction (scale was chosen so the image covers the frame on both axes), so the
  // image can only ever be dragged until one of its edges meets the frame's edge, never past it.
  const minX = frameWidth - scaledWidth;
  const minY = frameHeight - scaledHeight;

  useEffect(() => {
    if (hasCenteredRef.current || !scale) return;
    setPosition({ x: minX / 2, y: minY / 2 });
    hasCenteredRef.current = true;
  }, [scale, minX, minY]);

  useImperativeHandle(
    ref,
    () => ({
      getCroppedFile: () =>
        new Promise((resolve) => {
          if (!imgRef.current || !scale) {
            resolve(null);
            return;
          }
          // Map the visible frame rectangle (CSS px, frame-relative) back into the source
          // image's own natural pixel coordinates by undoing `scale`.
          const { x, y } = positionRef.current;
          const sx = -x / scale;
          const sy = -y / scale;
          const sWidth = frameWidth / scale;
          const sHeight = frameHeight / scale;

          const outputWidth = Math.round(Math.min(sWidth, MAX_CROP_OUTPUT_DIMENSION));
          const outputHeight = Math.round(outputWidth / aspectRatio);

          const canvas = document.createElement('canvas');
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(imgRef.current, sx, sy, sWidth, sHeight, 0, 0, outputWidth, outputHeight);

          // Preserves PNG (so a transparent logo/graphic stays transparent) - everything else
          // exports as JPEG regardless of source format, which covers the vast majority of
          // photo uploads well.
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            (blob) => resolve(blob ? new File([blob], file.name, { type: outputType }) : null),
            outputType,
            0.9,
          );
        }),
    }),
    [scale, frameWidth, frameHeight, aspectRatio, file],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scale || disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y };
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;
    setPosition({
      x: clamp(dragStateRef.current.originX + dx, minX, 0),
      y: clamp(dragStateRef.current.originY + dy, minY, 0),
    });
  };
  const endDrag = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="p" className="text-xs text-surface-400">
        Drag to reposition
      </Text>
      <div
        ref={frameRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-md border border-surface-300"
        style={{ aspectRatio: String(aspectRatio), cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          src={objectUrl ?? undefined}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const target = event.currentTarget;
            setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
          }}
          className="absolute left-0 top-0 max-w-none"
          style={{
            width: scaledWidth ? `${scaledWidth}px` : undefined,
            height: scaledHeight ? `${scaledHeight}px` : undefined,
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        />
      </div>
      <Box flex={{ direction: 'row', justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
});

ImageCropStep.displayName = 'ImageCropStep';

export const MediaField = forwardRef<MediaFieldHandle, MediaFieldProps>(
  (
    {
      label,
      required,
      disabled,
      error,
      helperText,
      value,
      defaultValue,
      onValueChange,
      onAssetChange,
      onUpload,
      extraTabs = [],
      mode,
      defaultMode,
      onModeChange,
      accept = DEFAULT_ACCEPT,
      maxSizeBytes,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      name,
      className,
    },
    ref,
  ) => {
    const autoId = useId();
    const helperTextId = helperText !== undefined ? `${autoId}-helper` : undefined;

    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
    const isValueControlled = value !== undefined;
    const currentValue = isValueControlled ? (value ?? '') : uncontrolledValue;

    const [urlDraft, setUrlDraft] = useState(currentValue);

    const [uncontrolledMode, setUncontrolledMode] = useState(defaultMode ?? extraTabs[0]?.value ?? 'url');
    const isModeControlled = mode !== undefined;
    const currentMode = isModeControlled ? (mode ?? 'url') : uncontrolledMode;

    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | undefined>(undefined);
    const [cropFile, setCropFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cropStepRef = useRef<ImageCropStepHandle>(null);

    const handleModeChange = (nextMode: string) => {
      if (!isModeControlled) setUncontrolledMode(nextMode);
      onModeChange?.(nextMode);
    };

    const commit = (url: string, asset: UploadedAsset | null) => {
      if (!isValueControlled) setUncontrolledValue(url);
      setUrlDraft(url);
      onValueChange?.(url);
      onAssetChange?.(asset);
    };

    const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      if (maxSizeBytes && file.size > maxSizeBytes) {
        setUploadError(`File is too large. Max size is ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`);
        return;
      }

      setUploadError(undefined);
      setCropFile(file);
    };

    // The only way an Upload-tab selection ever actually uploads: the outer dialog's Save button
    // calls this (see AvatarEditDialog/BannerEditDialog/BlogPostEditDialog's own handleSave) as
    // part of its own save sequence, rather than the old "confirm crop" button uploading
    // immediately and Save separately committing the result - that older two-step flow let a
    // user click Save before confirming the crop, saving with no image at all.
    useImperativeHandle(
      ref,
      () => ({
        resolvePendingUpload: async () => {
          if (currentMode !== 'upload' || !cropFile || !onUpload) return null;

          const croppedFile = await cropStepRef.current?.getCroppedFile();
          if (!croppedFile) {
            setUploadError('Could not process the selected image. Please try again.');
            throw new Error('Failed to produce a cropped image');
          }

          setIsUploading(true);
          try {
            const result = await onUpload(croppedFile);
            commit(result.url, result);
            setCropFile(null);
            return result;
          } catch (err) {
            setUploadError('Upload failed. Please try again.');
            throw err;
          } finally {
            setIsUploading(false);
          }
        },
      }),
      [currentMode, cropFile, onUpload],
    );

    return (
      <FieldShell label={label} required={required} error={error} helperText={helperText} helperTextId={helperTextId} className={className}>
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="rounded-md border" padding={{ base: 12 }}>
          <Tabs value={currentMode} onValueChange={handleModeChange}>
            <TabsList>
              {extraTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="url">URL</TabsTrigger>
              {onUpload && <TabsTrigger value="upload">Upload</TabsTrigger>}
            </TabsList>

            {extraTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {tab.content}
              </TabsContent>
            ))}

            <TabsContent value="url">
              <Box flex={{ direction: 'col', gap: 8 }}>
                <Input label="Image URL" name={name} disabled={disabled} value={urlDraft} onChange={(event) => setUrlDraft(event.target.value)} />
                <Box flex={{ direction: 'row', justify: 'end' }}>
                  <Button
                    variant={{ kind: 'filled', color: 'primary' }}
                    onClick={() => urlDraft.trim() && commit(urlDraft.trim(), null)}
                    disabled={disabled || !urlDraft.trim()}
                  >
                    Use URL
                  </Button>
                </Box>
              </Box>
            </TabsContent>

            {onUpload && (
              <TabsContent value="upload">
                {cropFile ? (
                  <ImageCropStep
                    ref={cropStepRef}
                    file={cropFile}
                    aspectRatio={aspectRatio}
                    disabled={isUploading}
                    onCancel={() => {
                      setCropFile(null);
                      setUploadError(undefined);
                    }}
                  />
                ) : (
                  <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                    <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={handleFileSelected} />
                    <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => fileInputRef.current?.click()} disabled={disabled}>
                      Choose File
                    </Button>
                    {currentValue ? <img src={currentValue} alt="" className="h-10 w-10 rounded object-cover" /> : null}
                  </Box>
                )}
                {isUploading ? (
                  <Text as="p" className="mt-2 text-xs text-surface-400">
                    Uploading…
                  </Text>
                ) : uploadError ? (
                  <Text as="p" className="mt-2 text-xs text-red-500">
                    {uploadError}
                  </Text>
                ) : null}
              </TabsContent>
            )}
          </Tabs>
        </Box>
      </FieldShell>
    );
  },
);

MediaField.displayName = 'MediaField';
