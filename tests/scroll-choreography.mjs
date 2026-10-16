import assert from 'node:assert/strict';
import {phaseAtScroll} from '../scroll-choreography.js';
import {dot,advance,identity} from '../polyhedral.js';
import {readingPose} from '../camera-path.js';
import {readFile} from 'node:fs/promises';
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
const data=JSON.parse(await readFile(new URL('../dodecahedral-data.json',import.meta.url),'utf8'));
// Calibrate the opening view to a canonical ideal vertex directly behind it.
const phi=(1+Math.sqrt(5))/2;
const f=readingPose(0),U=[1,phi/Math.sqrt(3),0,1/phi/Math.sqrt(3)];
const sky=(frame,u)=>{const q=frame[0].map((_,j)=>dot(frame.map(r=>r[j]),u));return q.slice(1).map(x=>x/-q[0]);};
for(const [i,v] of sky(f,U).entries())assert.ok(Math.abs(v-[0,0,-1][i])<1e-12);
const folded=advance(identity(),0,f,data,U);
for(const [i,v] of sky(folded.frame,folded.ideal).entries())assert.ok(Math.abs(v-[0,0,-1][i])<1e-10);
console.log('Continuous nonzero motion through reading poses, monotone scroll transitions, and exactly rearward ideal endpoint verified before and after face identifications.');
