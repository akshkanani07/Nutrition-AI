"""Image validation utilities — magic-byte type detection, size checks, EXIF orientation."""

from __future__ import annotations

import io
import struct

from PIL import Image, ImageOps


def detect_mime_type(header: bytes) -> str | None:
    """Detect image MIME type from the first bytes (magic bytes), not the extension."""
    if header[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if header[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_and_preprocess(
    data: bytes,
    *,
    max_size_bytes: int,
    allowed_mime_types: set[str],
    min_short_side: int,
    max_long_side: int,
) -> tuple[Image.Image, str]:
    """Validate raw image bytes and return a preprocessed PIL Image and its MIME type.

    Raises ValueError with a structured (code, message, hint) tuple.
    """
    # --- size check ---
    if len(data) > max_size_bytes:
        raise ValueError(
            "IMAGE_TOO_LARGE",
            f"Image is {len(data)} bytes, exceeding the {max_size_bytes} byte limit.",
            "Upload a smaller image (max 10 MB).",
        )

    # --- magic-byte type check ---
    mime = detect_mime_type(data[:12])
    if mime is None or mime not in allowed_mime_types:
        raise ValueError(
            "INVALID_IMAGE_TYPE",
            f"Unsupported image type. Detected: {mime}.",
            "Upload a JPEG, PNG, or WEBP image.",
        )

    # --- decode ---
    try:
        img = Image.open(io.BytesIO(data))
        img.load()  # force full decode — catches truncated files
    except Exception as exc:
        raise ValueError(
            "INVALID_IMAGE",
            f"Image could not be decoded: {exc}",
            "The file may be corrupted or truncated.",
        ) from exc

    # --- EXIF orientation ---
    img = ImageOps.exif_transpose(img)

    # --- flatten transparency (RGBA / P → RGB) ---
    if img.mode in ("RGBA", "LA", "P", "PA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # --- short side check ---
    w, h = img.size
    short_side = min(w, h)
    if short_side < min_short_side:
        raise ValueError(
            "INVALID_IMAGE",
            f"Image short side is {short_side} px, below the {min_short_side} px minimum.",
            "Upload a larger image.",
        )

    # --- downscale longest side ---
    long_side = max(w, h)
    if long_side > max_long_side:
        ratio = max_long_side / long_side
        new_w = int(w * ratio)
        new_h = int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    return img, mime

