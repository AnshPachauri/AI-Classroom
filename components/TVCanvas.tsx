"use client";
import { useEffect, useState } from "react";

export const W = 1920;
export const H = 1080;

/** Fixed 1920x1080 design canvas, scaled to fit whatever viewport it's in. */
export default function TVCanvas({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{
          width: W,
          height: H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          background: "radial-gradient(1200px 700px at 20% 0%, #101a33 0%, var(--bg) 60%)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
