"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { RaceController } from "./controller";

/**
 * The live half of the race environment: the canvas, and the controller that drives it and
 * the atmosphere around it. The controller is imported once the browser is idle, so the
 * environment never competes with first paint — until then the page shows the static
 * atmosphere rendered on the server.
 */
export function RaceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<RaceController | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const canvas = canvasRef.current;
    const env = canvas?.parentElement;
    if (!canvas || !env) return;

    let cancelled = false;
    const boot = async () => {
      const { createRaceController } = await import("./controller");
      if (cancelled) return;
      controllerRef.current = createRaceController(env, canvas);
    };

    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200) as unknown as number);
    const idleHandle = idle(() => void boot(), { timeout: 1500 });

    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(idleHandle);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  // The layout outlives route changes; a new page means new zones to measure.
  useEffect(() => {
    controllerRef.current?.refresh();
  }, [pathname]);

  return <canvas ref={canvasRef} className="race-canvas" />;
}
