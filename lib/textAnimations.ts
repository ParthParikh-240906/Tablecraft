export const textAnimationVariants = {
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  },
  scaleOut: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  none: {
    initial: { opacity: 1, y: 0, scale: 1 },
    animate: { opacity: 1, y: 0, scale: 1 },
  }
};
