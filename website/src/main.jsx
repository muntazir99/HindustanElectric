import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig, motion } from "motion/react";

// Placeholder until the pages are built (PLAN.md §21.8). MotionConfig follows the phone's "reduce motion" setting.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        Hindustan Electric
      </motion.h1>
    </MotionConfig>
  </StrictMode>,
);
