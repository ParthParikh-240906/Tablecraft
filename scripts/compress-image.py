#!/usr/bin/env python3
"""Compress an image using Pillow. Resizes and lowers quality."""
import sys
import os
from PIL import Image

def main():
    if len(sys.argv) < 4:
        print("Usage: compress-image.py <input> <output> <max_width>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    max_width = int(sys.argv[3])

    img = Image.open(input_path)

    # Convert to RGB if necessary (handles PNG with transparency)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize if needed
    w, h = img.size
    if w > max_width:
        new_h = int(h * max_width / w)
        img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)

    img.save(output_path, "JPEG", quality=85, optimize=True)
    print(f"Compressed: {os.path.getsize(output_path)} bytes")


if __name__ == "__main__":
    main()
