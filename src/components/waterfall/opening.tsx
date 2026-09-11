import { useEffect, useRef, useState } from "react";

const BARS = [
  { left: "18%", width: 2, delay: 0, height: "50%", alpha: 0.55 },
  { left: "28%", width: 3.5, delay: 0.05, height: "62%", alpha: 0.85 },
  { left: "37%", width: 2.2, delay: 0.1, height: "46%", alpha: 0.5 },
  { left: "50%", width: 4.5, delay: 0, height: "70%", alpha: 1 },
  { left: "62%", width: 2.4, delay: 0.08, height: "52%", alpha: 0.6 },
  { left: "72%", width: 3.2, delay: 0.04, height: "58%", alpha: 0.8 },
  { left: "82%", width: 2, delay: 0.12, height: "44%", alpha: 0.45 },
] as const;

export function Opening({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [t, setT] = useState(0);
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  }

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const audio = typeof Audio !== "undefined" ? new Audio("/waterfall-sting.wav") : null;
    if (audio) {
      audio.preload = "auto";
      if (!reduce) void audio.play().catch(() => {});
    }
    if (reduce) {
      const id = window.setTimeout(finish, 360);
      return () => {
        window.clearTimeout(id);
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      };
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      setT(elapsed);
      if (elapsed < 3200) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, []);

  const fall = Math.min(1, t / 520);
  const flash = t < 420 ? 0 : Math.max(0, 1 - (t - 420) / 640);
  const bloom = t < 500 ? 0 : Math.min(1, (t - 500) / 700);
  const line = t < 680 ? 0 : Math.min(1, (t - 680) / 480);
  const tag = t < 900 ? 0 : Math.min(1, (t - 900) / 500);
  const fade = t < 2680 ? 1 : Math.max(0, 1 - (t - 2680) / 520);

  return (
    <button
      type="button"
      className="opening"
      style={{ opacity: fade }}
      onClick={finish}
      aria-label="Waterfall"
    >
      <div
        className="opening-flash"
        style={{
          opacity: flash * 0.85,
          transform: `scale(${0.7 + (1 - flash) * 1.4})`,
        }}
      />
      {BARS.map((bar, i) => {
        const local = Math.min(1, Math.max(0, (fall - bar.delay) / 0.78));
        const y = -55 + 155 * local;
        const a =
          bar.alpha *
          (local < 0.08 ? local / 0.08 : 1) *
          (local > 0.82 ? (1 - local) / 0.18 : 1);
        return (
          <span
            key={i}
            className="opening-bar"
            style={{
              left: bar.left,
              width: bar.width,
              height: bar.height,
              opacity: a,
              transform: `translate(-50%, ${y}vh)`,
            }}
          />
        );
      })}
      <div className="opening-mark">
        <p
          className="opening-title"
          style={{
            opacity: bloom,
            transform: `scale(${0.92 + 0.08 * bloom})`,
            filter: `blur(${(1 - bloom) * 8}px)`,
          }}
        >
          Waterfall
        </p>
        <span
          className="opening-line"
          style={{
            opacity: line,
            transform: `scaleX(${0.18 + 0.82 * line})`,
          }}
        />
        <p className="opening-tag" style={{ opacity: tag * 0.55 }}>
          every shilling in its place
        </p>
      </div>
    </button>
  );
}
