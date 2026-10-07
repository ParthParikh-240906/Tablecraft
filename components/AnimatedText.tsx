"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { textAnimationVariants } from "@/lib/textAnimations";
import type { TextDesign } from "@/lib/design";
import { getShadowStyle } from "@/lib/design";

export function AnimatedText({
  text,
  design,
  className,
  style,
  children,
  preview = false,
}: {
  text?: string;
  design?: TextDesign;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** Console preview renders shadows at half strength (matches FitText measuring space). */
  preview?: boolean;
}) {
  const content = children ?? text;
  // Scroll-triggered: animations play when the element scrolls into view
  // (once), not on mount — so below-the-fold content animates on arrival.
  // delay stays time-after-visible. Reduced-motion users get the static path.
  const reduceMotion = useReducedMotion();
  const shadowScale = preview ? 0.5 : 1;

  if (!design?.animation || design.animation.type === "none" || reduceMotion) {
    return (
      <div
        className={className}
        style={{ ...style, textShadow: getShadowStyle(design?.shadow, shadowScale) }}
      >
        {content}
      </div>
    );
  }

  const anim = design.animation;
  const variant = textAnimationVariants[anim.type] || textAnimationVariants.none;

  return (
    <motion.div
      key={JSON.stringify(anim) + (design.shadow ? JSON.stringify(design.shadow) : '')}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.25 }}
      variants={variant}
      transition={{
        duration: anim.duration,
        delay: anim.delay,
        ease: "easeOut"
      }}
      className={className}
      style={{ ...style, textShadow: getShadowStyle(design.shadow, shadowScale) }}
    >
      {content}
    </motion.div>
  );
}
