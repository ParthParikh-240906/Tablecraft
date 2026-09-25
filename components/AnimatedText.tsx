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
}: {
  text?: string;
  design?: TextDesign;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const content = children ?? text;
  
  if (!design?.animation || design.animation.type === "none") {
    return (
      <div 
        className={className} 
        style={{ ...style, textShadow: getShadowStyle(design?.shadow) }}
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
      style={{ ...style, textShadow: getShadowStyle(design.shadow) }}
    >
      {content}
    </motion.div>
  );
}
