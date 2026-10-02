"use client";

import React from "react";
import { motion } from "framer-motion";
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
  preview?: boolean;
}) {
  const content = children ?? text;
  const shadowScale = preview ? 0.5 : 1;

  if (!design?.animation || design.animation.type === "none") {
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
      animate="animate"
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
