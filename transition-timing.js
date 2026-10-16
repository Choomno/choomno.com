import {readingPhase,routeJoinPhases} from './camera-path.js';

export const textSlideDuration=1600;
export const travelDuration=4800;
export const transitionDuration=2*textSlideDuration+travelDuration;
// Unit displacement, starting at rest and reaching speed 1.25 with zero
// acceleration at both ends. The bridge continues at that same speed.
const departure=t=>t*t*t*(5+t*(-6.25+2.25*t));
const integral=t=>t*t*t*t*(2.5+t*(-3+t));

// The bridge ramps smoothly to a broad constant-speed middle. This avoids
// concentrating the fastest movement and rotation at the inward turn.
function bridge(u,side){
 const ramp=.2,join=1.25*side*travelDuration/textSlideDuration;
 const area=u<ramp?ramp*integral(u/ramp):u>1-ramp?
  1-ramp-ramp*integral((1-u)/ramp):u-ramp/2;
 return side+join*u+(1-2*side-join)*area/(1-ramp);
}

export function transitionProgress(elapsed,leg){
 const time=Math.max(0,Math.min(transitionDuration,elapsed));
 const side=routeJoinPhases[2*leg]/readingPhase(1)-leg;
 if(time<=textSlideDuration)return side*departure(time/textSlideDuration);
 if(time<=textSlideDuration+travelDuration)
  return bridge((time-textSlideDuration)/travelDuration,side);
 return 1-side*departure((transitionDuration-time)/textSlideDuration);
}
