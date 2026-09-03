/** Thin WebGL plumbing for the liquid-logo shader: compile, buffers, texture, draw. */
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from "./shaders";

export interface LiquidUniforms {
  speed: number;
  iterations: number;
  scale: number;
  dotFactor: number;
  vOffset: number;
  intensityFactor: number;
  expFactor: number;
  colorFactors: readonly [number, number, number];
  colorShift: number;
  dotMultiplier: number;
  noiseIntensity: number;
  logoOpacity: number;
  logoScale: number;
  logoInteractStrength: number;
}

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: { vertexPosition: number };
  uniformLocations: Record<string, WebGLUniformLocation | null>;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createProgramInfo(gl: WebGLRenderingContext): ProgramInfo | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const uniformNames = [
    "u_resolution", "u_time", "u_speed", "u_iterations", "u_scale", "u_dotFactor",
    "u_vOffset", "u_intensityFactor", "u_expFactor", "u_colorFactors", "u_colorShift",
    "u_dotMultiplier", "u_noiseIntensity", "u_logoTexture", "u_logoOpacity",
    "u_logoScale", "u_logoAspectRatio", "u_logoInteractStrength", "u_logoBlendMode",
  ];
  const uniformLocations: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniformLocations[name] = gl.getUniformLocation(program, name);

  return {
    program,
    attribLocations: { vertexPosition: gl.getAttribLocation(program, "aVertexPosition") },
    uniformLocations,
  };
}

/** A fullscreen quad, drawn as a TRIANGLE_STRIP. */
export function createFullscreenQuad(gl: WebGLRenderingContext): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  if (!buffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return buffer;
}

/** Uploads a square, transparent-background 2D canvas (the drawn mark) as the logo texture. */
export function createLogoTexture(gl: WebGLRenderingContext, source: HTMLCanvasElement): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return texture;
}

export function drawLiquidFrame(
  gl: WebGLRenderingContext,
  info: ProgramInfo,
  positionBuffer: WebGLBuffer,
  texture: WebGLTexture,
  canvas: HTMLCanvasElement,
  uniforms: LiquidUniforms,
  timeSeconds: number
): void {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.useProgram(info.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(info.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(info.attribLocations.vertexPosition);

  const u = info.uniformLocations;
  gl.uniform2f(u.u_resolution, canvas.width, canvas.height);
  gl.uniform1f(u.u_time, timeSeconds);
  gl.uniform1f(u.u_speed, uniforms.speed);
  gl.uniform1f(u.u_iterations, uniforms.iterations);
  gl.uniform1f(u.u_scale, uniforms.scale);
  gl.uniform1f(u.u_dotFactor, uniforms.dotFactor);
  gl.uniform1f(u.u_vOffset, uniforms.vOffset);
  gl.uniform1f(u.u_intensityFactor, uniforms.intensityFactor);
  gl.uniform1f(u.u_expFactor, uniforms.expFactor);
  gl.uniform3f(u.u_colorFactors, ...uniforms.colorFactors);
  gl.uniform1f(u.u_colorShift, uniforms.colorShift);
  gl.uniform1f(u.u_dotMultiplier, uniforms.dotMultiplier);
  gl.uniform1f(u.u_noiseIntensity, uniforms.noiseIntensity);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(u.u_logoTexture, 0);
  gl.uniform1f(u.u_logoOpacity, uniforms.logoOpacity);
  gl.uniform1f(u.u_logoScale, uniforms.logoScale);
  gl.uniform1f(u.u_logoAspectRatio, 1.0);
  gl.uniform1f(u.u_logoInteractStrength, uniforms.logoInteractStrength);
  gl.uniform1i(u.u_logoBlendMode, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

/** Draws a bold, centered glyph onto a square transparent canvas to use as the logo shape. */
export function drawMarkTexture(mark: string, sizePx: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(sizePx * 0.62)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(mark, sizePx / 2, sizePx * 0.56);
  return canvas;
}
