'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp } from '@/lib/motion';

/** Page transition: content area only (sidebar/top bar never animate on route change). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial="hidden" animate="show" variants={fadeUp}>
      {children}
    </motion.div>
  );
}
