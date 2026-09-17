/** Keep software WebGL responsive without changing simulation or disabling 3D. */
export function isSoftwareRenderer(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(
    gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
  );
  return /swiftshader|llvmpipe|softpipe|software/i.test(name);
}
export function renderPixelRatio(
  width: number,
  height: number,
  dpr: number,
  software: boolean,
): number {
  return software
    ? Math.min(1, 640 / Math.max(1, width), 480 / Math.max(1, height))
    : Math.min(dpr, 1.5);
}
