/** Horizontal field of view shared by perception and the first-person camera. */
export const DOOM_FOV = Math.PI / 2;
export function verticalFieldOfView(aspect: number) {
  return (
    (2 * Math.atan(Math.tan(DOOM_FOV / 2) / Math.max(0.1, aspect)) * 180) /
    Math.PI
  );
}
