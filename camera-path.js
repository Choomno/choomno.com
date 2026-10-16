// Shared by the ray tracer and the stationary text planes.
import {cellTurn} from './rhombic.js';
export const readingPhase=index=>index*Math.PI/4;
export const orbitRadius=2.0;
const phi=(1+Math.sqrt(5))/2;
export const orbitStart=Math.atan(phi*phi);
export const readingPose=phase=>cellTurn(orbitStart-Math.PI/4-phase,orbitRadius);
