import { Button, cn } from "@hayi/ui";
import { type DragEvent, useId, useState } from "react";
import type { UploadProgress } from "../hooks/use-image-upload";

interface ImageDropProps {
  /** Files picked or dropped, in order. */
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}

/** D3d screen 25 drop zone: drag images here or pick them; JPEG, PNG, WebP up to 5 MB. */
export function ImageDrop({ onFiles, disabled = false, label = "Kéo ảnh vào đây hoặc chọn từ máy" }: ImageDropProps) {
  const inputId = useId();
  const [over, setOver] = useState(false);

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    if (!disabled) onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "grid min-h-36 place-items-center gap-1 rounded-lg border-2 border-dashed border-line-strong p-4 text-center transition-colors",
        over && "border-matcha-700 bg-matcha-50",
        disabled && "opacity-60",
      )}
    >
      <label
        htmlFor={inputId}
        className={cn(
          "grid cursor-pointer justify-items-center gap-1 rounded-md px-3 py-2",
          // The input is visually hidden: its keyboard focus shows on the label (the same ring as focusRing).
          "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus",
          disabled && "cursor-not-allowed",
        )}
      >
        <span className="text-body font-semibold text-matcha-700">{label}</span>
        <span className="text-caption text-ink-muted">JPEG, PNG, WebP · tối đa 5 MB</span>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            // The same file can be picked again after an error.
            e.currentTarget.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
    </div>
  );
}

/** The image being uploaded: name, progress and "Huỷ tải" (screen 25). */
export function UploadTile({ uploading, onCancel }: { uploading: UploadProgress; onCancel: () => void }) {
  const percent = Math.round(uploading.progress * 100);
  return (
    <div className="grid content-start gap-2 rounded-lg border border-line bg-paper p-3">
      <div aria-hidden="true" className="aspect-[4/3] w-full rounded-md bg-sunken" />
      <p className="text-label font-semibold">{uploading.checking ? "Đang kiểm tra ảnh…" : "Đang tải lên…"}</p>
      <p className="text-caption break-all text-ink-muted tabular-nums">{`${uploading.fileName} · ${percent}%`}</p>
      <div
        role="progressbar"
        aria-label={`Đang tải ${uploading.fileName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
      >
        <div className="h-full bg-matcha-700 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      {/* Once the bytes are stored, the server check cannot be cancelled. */}
      {uploading.checking ? null : (
        <Button variant="ghost" density="compact" className="justify-self-start" onClick={onCancel}>
          Huỷ tải
        </Button>
      )}
    </div>
  );
}
