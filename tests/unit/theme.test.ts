/**
 * tests/unit/theme.test.ts
 * Covers lib/theme.ts + lib/textAnimations.ts — unified theme + animation map.
 * Guards against accidental theme drift between console / public site / marketing.
 */
import { describe, it, expect } from "vitest";
import { UNIFIED_THEME, getThemeColors } from "@/lib/theme";
import { textAnimationVariants } from "@/lib/textAnimations";

describe("unified theme", () => {
  it("has the canonical dark theme values", () => {
    expect(UNIFIED_THEME.main).toBe("#0f0f0f");
    expect(UNIFIED_THEME.text).toBe("#f5f5f4");
    expect(UNIFIED_THEME.highlight).toBe("#f97316");
  });

  it("getThemeColors returns the same object", () => {
    expect(getThemeColors()).toEqual(UNIFIED_THEME);
  });

  it("all values are valid hex colors", () => {
    for (const v of Object.values(UNIFIED_THEME)) {
      expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("textAnimationVariants", () => {
  it("exposes all four animation types used by TextDesign", () => {
    expect(Object.keys(textAnimationVariants).sort()).toEqual(
      ["fadeIn", "none", "scaleOut", "slideUp"].sort()
    );
  });

  it("every variant has initial + animate states", () => {
    for (const v of Object.values(textAnimationVariants)) {
      expect(v).toHaveProperty("initial");
      expect(v).toHaveProperty("animate");
    }
  });

  it("'none' variant is a visible no-op (opacity 1)", () => {
    expect(textAnimationVariants.none.initial.opacity).toBe(1);
    expect(textAnimationVariants.none.animate.opacity).toBe(1);
  });

  it("animated variants start invisible", () => {
    expect(textAnimationVariants.slideUp.initial.opacity).toBe(0);
    expect(textAnimationVariants.scaleOut.initial.opacity).toBe(0);
    expect(textAnimationVariants.fadeIn.initial.opacity).toBe(0);
  });
});
