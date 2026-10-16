// Export exactly the shader, quotient data and timed camera poses used by the site.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {packScene,advance,identity} from '../polyhedral.js';
import {readingPose,readingPhase} from '../camera-path.js';
import {transitionProgress,transitionDuration} from '../transition-timing.js';
import {videoFramesPerSecond} from '../media-settings.js';
import {doublePrecisionFragment} from './prerender-double.mjs';
const output=resolve(process.argv[2]||'work/prerender');
await mkdir(output,{recursive:true});
const data=JSON.parse(await readFile(new URL('../dodecahedral-data.json',import.meta.url),'utf8'));
const scene=packScene(data,Float64Array),fps=videoFramesPerSecond,intervals=Math.round(transitionDuration*fps/1000);
const pose=phase=>{
 const {frame,cell}=advance(identity(),0,readingPose(phase),data);
 return {cell,camera:frame[0].flatMap((_,i)=>frame.map(row=>row[i])),phase};
};
const stations=Array.from({length:4},(_,index)=>pose(readingPhase(index)));
const legs=Array.from({length:3},(_,leg)=>Array.from({length:intervals+1},(_,frame)=>{
 const elapsed=transitionDuration*frame/intervals;
 return {time:elapsed/1000,...pose(readingPhase(leg+transitionProgress(elapsed,leg)))};
}));
scene.fragment=doublePrecisionFragment({faces:data.cells[0].planes.length,edges:data.cells[0].edges.length,stride:scene.height/data.cells.length,texelCount:scene.texels.length/4});
const sources=['media-settings.js','tools/prerender-double.mjs','tools/prerender-egl.py','polyhedral.js','intrinsic.js','dodecahedral-data.json','camera-path.js','transition-timing.js'];
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
const content={precision:'float64',width:scene.width,height:scene.height,texels:Array.from(scene.texels),fragment:scene.fragment,stations,legs,fps,intervals,timelineDuration:transitionDuration/1000,sourceHashes};
await writeFile(resolve(output,'scene.json'),JSON.stringify(content));
console.log(`Exported ${stations.length} stills and ${legs.length} × ${intervals+1} timed frames to ${output}/scene.json`);
