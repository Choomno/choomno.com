import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {masterAspect,portraitAspect,videoFramesPerSecond} from '../media-settings.js';
import {transitionDuration} from '../transition-timing.js';
import {readingPhase} from '../camera-path.js';
import {fieldScale} from '../projection.js';
const base=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('media/manifest.json',base),'utf8'));
assert.equal(manifest.aspectRatio,masterAspect);
assert.equal(manifest.fps,videoFramesPerSecond);
assert.equal(manifest.timelineDuration,transitionDuration/1000);
assert.equal(manifest.frameCount,1+manifest.timelineDuration*manifest.fps);
assert.equal(manifest.videoDuration,manifest.frameCount/manifest.fps);
assert.equal(manifest.maxSteps,160);assert.ok(manifest.supersampling>=1.5);
assert.equal(manifest.fieldScale,fieldScale);assert.equal(manifest.beamRadius,.025);
for(const [path,hash] of Object.entries(manifest.sourceHashes)){
 const bytes=await readFile(new URL(path,base));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,`Rendered geometry or timing is stale: ${path}`);
}
let checked=0;
for(let index=0;index<4;index++){
 assert.equal(manifest.stations[index].phase,readingPhase(index));
 for(const portrait of [false,true]){
  const name=`station-${index}${portrait?'-portrait':''}.webp`;
  await verify(name);
 }
}
for(let leg=0;leg<3;leg++)for(const direction of ['forward','reverse'])for(const portrait of [false,true])for(const format of ['mp4','webm']){
 const name=`transition-${leg}-${direction}${portrait?'-portrait':''}.${format}`;
 await verify(name);
 const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames:format=duration','-of','json',fileURLToPath(new URL('media/'+name,base))],{encoding:'utf8'});
 assert.equal(probe.status,0,probe.stderr);
 const info=JSON.parse(probe.stdout),stream=info.streams[0];
 assert.equal(stream.height,manifest.height);assert.equal(stream.width,portrait?manifest.height*portraitAspect:manifest.width);
 assert.equal(stream.r_frame_rate,`${manifest.fps}/1`);
 if(stream.nb_frames)assert.equal(Number(stream.nb_frames),manifest.frameCount);
 assert.ok(Math.abs(Number(info.format.duration)-manifest.videoDuration)<.002,`Incorrect duration: ${name}`);
}
async function verify(name){
 const path=new URL('media/'+name,base),entry=manifest.files[name];
 assert.ok(entry,`Missing asset in manifest: ${name}`);
 assert.equal((await stat(path)).size,entry.bytes);
 assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),entry.sha256,`Corrupted asset: ${name}`);
 checked++;
}
console.log(`Verified ${checked} media assets: source hashes, exact camera timing, portrait crops, frame rates, dimensions, durations and checksums.`);
