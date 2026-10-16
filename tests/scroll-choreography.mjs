import assert from 'node:assert/strict';
import {phaseAtScroll} from '../scroll-choreography.js';
import {dot} from '../polyhedral.js';
import {readingPose,readingPhase} from '../camera-path.js';
const marks=[{y:600,phase:Math.PI/4},{y:1300,phase:Math.PI/2},{y:2000,phase:3*Math.PI/4}];
for(const m of marks)assert.equal(phaseAtScroll(m.y,marks),m.phase);
for(const m of marks.slice(0,-1)){
 assert.ok(phaseAtScroll(m.y-50,marks)<m.phase);
 assert.ok(phaseAtScroll(m.y+50,marks)>m.phase);
 const left=(m.phase-phaseAtScroll(m.y-.01,marks))/.01;
 const right=(phaseAtScroll(m.y+.01,marks)-m.phase)/.01;
 assert.ok(left>0&&Math.abs(left-right)<1e-7);
}
let previous=0;for(let y=0;y<=2400;y++){const p=phaseAtScroll(y,marks);assert.ok(p>=previous);previous=p;}
// The scroll parameter follows a single circle around the fixed original
// cell center. Forward progression moves the eye toward screen-right,
// so stationary text travels from right to left.
const origin=[1,0,0,0],initial=readingPose(0),final=readingPose(readingPhase(3));
const initialEye=initial.map(row=>row[0]);
for(let y=0;y<2000;y+=5){
 const phase=phaseAtScroll(y,marks),next=phaseAtScroll(y+.01,marks);
 const frame=readingPose(phase),following=readingPose(next),eye=frame.map(row=>row[0]);
 const right=frame.map(row=>row[1]),up=frame.map(row=>row[2]),forward=frame.map(row=>row[3]);
 assert.ok(Math.abs(dot(eye,origin)-dot(initialEye,origin))<1e-10);
 assert.ok(Math.abs(dot(right,origin))<1e-10&&Math.abs(dot(up,origin))<1e-10);
 assert.ok(dot(forward,origin)>0);
 const displacement=following.map((row,i)=>row[0]-eye[i]);
 assert.ok(dot(displacement,right)>0,'Camera must move continuously toward screen-right');
}
for(let i=1;i<4;i++)assert.ok(Math.abs(initial[i][0]+final[i][0])<1e-10);
console.log('Continuous nonzero motion through reading poses, monotone scroll transitions, right-to-left travel, and a half-circle about the fixed original cell center verified.');
