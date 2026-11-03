import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string | number;
  duration?: number;
  className?: string;
}

const AnimatedCounter = ({ value, duration = 1200, className }: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState("0");
  const prevValue = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Parse the numeric value (strip commas, handle "N/A", etc.)
    const raw = typeof value === "number" ? value : value;
    const cleaned = String(raw).replace(/,/g, "");
    const target = parseInt(cleaned, 10);

    // If not a valid number, show as-is (no animation)
    if (isNaN(target)) {
      setDisplayValue(String(value));
      return;
    }

    const start = prevValue.current;
    const diff = target - start;
    const startTime = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = Math.round(start + diff * easedProgress);

      setDisplayValue(new Intl.NumberFormat("en-GB").format(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
};

export default AnimatedCounter;
