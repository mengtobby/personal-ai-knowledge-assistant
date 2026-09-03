import { useEffect, useRef, useState } from "react";
import {
  createFullscreenQuad,
  createLogoTexture,
  createProgramInfo,
  drawLiquidFrame,
  drawMarkTexture,
  type LiquidUniforms,
} from "./webgl";

// Cool, silvery-blue liquid metal rather than the demo's default rainbow —
// calmer, and closer to the app's own accent color. Speed is slowed down and
// iterations trimmed a little, since this runs continuously as a small,
// always-visible brand mark rather than a one-off hero animation.
const DEFAULT_UNIFORMS: LiquidUniforms = {
  speed: 1.1,
  iterations: 10,
  scale: 0.05,
  dotFactor: 0.1,
  vOffset: 6.4,
  intensityFactor: 0.23,
  expFactor: 0.6,
  colorFactors: [0, 0, 0],
  colorShift: 0,
  dotMultiplier: 0.3,
  noiseIntensity: 4,
  logoOpacity: 1,
  logoScale: 0.82,
  logoInteractStrength: 0.4,
};

const MAX_DEVICE_PIXEL_RATIO = 2;
const LOGO_TEXTURE_SIZE = 256;

interface LiquidLogoProps {
  /** Rendered size in CSS pixels (square). */
  size?: number;
  /** Short glyph drawn as the liquid shape. */
  mark?: string;
  className?: string;
}

/** Small animated liquid-metal brand mark; falls back to a static badge without WebGL. */
export function LiquidLogo({ size = 48, mark = "K", className }: LiquidLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      setFallback(true);
      return;
    }

    const programInfo = createProgramInfo(gl);
    const positionBuffer = createFullscreenQuad(gl);
    const texture = createLogoTexture(gl, drawMarkTexture(mark, LOGO_TEXTURE_SIZE));
    if (!programInfo || !positionBuffer || !texture) {
      setFallback(true);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frameId = 0;

    const renderAt = (now: number) => {
      drawLiquidFrame(gl, programInfo, positionBuffer, texture, canvas, DEFAULT_UNIFORMS, (now - start) / 1000);
    };

    const loop = (now: number) => {
      renderAt(now);
      frameId = requestAnimationFrame(loop);
    };

    const handleVisibility = () => {
      cancelAnimationFrame(frameId);
      if (!document.hidden) frameId = requestAnimationFrame(loop);
    };

    if (reduceMotion) {
      renderAt(start + 1400); // one settled frame; respects the user's motion preference
    } else {
      frameId = requestAnimationFrame(loop);
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", handleVisibility);
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(programInfo.program);
    };
  }, [size, mark]);

  if (fallback) {
    return (
      <div
        className={`liquid-logo-fallback${className ? ` ${className}` : ""}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden="true"
      >
        {mark}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`liquid-logo${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
