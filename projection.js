import {cellTurn, dot} from './rhombic.js';

export const fieldScale = .82;
export const readingPhase = index => index * Math.PI / 4;
export const readingPose = phase => cellTurn(-phase);

// A homogeneous plane in the hyperboloid's projective (Klein) model.
// Its four corners have the same time coordinate and unit Lorentz norm.
// Interpolating projectively gives a totally geodesic plane in H^3.
export function projectReadingPlane(phase, stationPhase, width, height, viewportWidth, viewportHeight) {
 if (!(width > 0 && height > 0 && viewportWidth > 0 && viewportHeight > 0)) return null;
 const camera = readingPose(phase), station = readingPose(stationPhase);
 const z = .8, half = z * fieldScale * width / viewportHeight, vertical = half * height / width;
 const time = Math.sqrt(1 + half * half + vertical * vertical + z * z);
 const apply = (m, v) => m.map(row => row.reduce((sum, x, i) => sum + x * v[i], 0));
 const spatial = v => [1, 2, 3].map(col => dot(camera.map(row => row[col]), apply(station, v)));
 const origin = spatial([time, -half, vertical, z]);
 const dx = spatial([0, 2 * half / width, 0, 0]);
 const dy = spatial([0, 0, -2 * vertical / height, 0]);
 const corners = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) =>
  origin.map((v, i) => v + dx[i] * x + dy[i] * y));
 if (corners.some(p => p[2] <= .02)) return null;
 const focal = viewportHeight / (2 * fieldScale), denominator = origin[2];
 const horizontal = p => (viewportWidth / 2 * p[2] + focal * p[0]) / denominator;
 const downward = p => (viewportHeight / 2 * p[2] - focal * p[1]) / denominator;
 return [horizontal(dx), downward(dx), 0, dx[2] / denominator,
  horizontal(dy), downward(dy), 0, dy[2] / denominator,
  0, 0, 1, 0, horizontal(origin), downward(origin), 0, 1];
}
