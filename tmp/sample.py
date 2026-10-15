from PIL import Image
import sys

img = Image.open("/Users/Lenovo/Desktop/Screenshot 2026-10-15 at 9.27.12 AM.png").convert("RGB")
W, H = img.size
print("size", W, H)

def px(x, y):
    return img.getpixel((int(x), int(y)))

pts = {
    "band_left": (300, 1150),
    "band_mid": (1000, 1150),
    "band_right": (1800, 1150),
    "band_low": (1000, 1220),
    "outside_left_of_frame": (100, 600),
    "outside_left_low": (100, 1150),
    "outside_below_left": (100, 1270),
    "cream_top": (1000, 300),
    "cream_mid": (1700, 500),
    "card_white": (555, 780),
    "toolbar_bg": (600, 187),
    "above_frame": (1000, 130),
}
for k, (x, y) in pts.items():
    print(f"{k:26s} ({x},{y}) -> {px(x, y)}")

# scan a vertical line down the middle to find color transitions
print("\nvertical scan x=1000:")
prev = None
for y in range(230, H, 2):
    c = px(1000, y)
    if prev is None or (abs(c[0]-prev[0]) + abs(c[1]-prev[1]) + abs(c[2]-prev[2])) > 30:
        print(f"  y={y}: {c}")
    prev = c

# scan horizontal at band to find frame edges
print("\nhorizontal scan y=1150:")
prev = None
for x in range(0, W, 2):
    c = px(x, 1150)
    if prev is None or (abs(c[0]-prev[0]) + abs(c[1]-prev[1]) + abs(c[2]-prev[2])) > 30:
        print(f"  x={x}: {c}")
    prev = c
