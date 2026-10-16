import {projectText, initTextSprites, setTextProjection} from './text-sprites.js';
import {initSectionNavigation} from './section-navigation.js';
import {phaseAtScroll} from './scroll-choreography.js';
import {readingPose, readingPhase} from './projection.js';
import {identity,advance,fragment,beamData} from './rhombic.js';
const canvas=document.querySelector('#space');
const play=document.querySelector('#play'),detail=document.querySelector('#detail');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let running=!reduced.matches, phase=0, targetPhase=0, dirty=true, renderer=null, navigation=null;

async function createRenderer(){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});
 if(!gl)throw Error('WebGL 2 unavailable');
 const response=await fetch('./rhombic-data.json');if(!response.ok)throw Error('Manifold data could not be loaded.');
 const data=await response.json();
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,`#version 300 es
 void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const beams=beamData(data),texels=new Float32Array(24*9*4);
 for(let i=0;i<12;i++){
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)texels[(i*9+col)*4+row]=data.transforms[i][row][col];
  texels.set(data.planes[i],(i*9+4)*4);
  texels[(i*9+7)*4]=data.otherFaces[i];
 }
 for(let i=0;i<24;i++){
  texels.set(beams[i].a,(i*9+5)*4);texels.set(beams[i].t,(i*9+6)*4);
  texels[(i*9+7)*4+1]=beams[i].cusp;
 }
 data.vertices.filter((_,i)=>!data.ideal[i]).forEach((v,i)=>texels.set(v.map(x=>x*2),(i*9+8)*4));
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,9,24,0,gl.RGBA,gl.FLOAT,texels);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const uniform=name=>gl.getUniformLocation(program,name),uCamera=uniform('camera'),uColors=uniform('cuspColors'),uRes=uniform('resolution'),uSteps=uniform('maxSteps');gl.uniform1i(uniform('manifold'),0);
 return angle=>{
  const {frame}=advance(identity(),0,readingPose(angle),data);
  const rect=canvas.getBoundingClientRect(),quality=Number(detail.value),ratio=Math.min(quality,1600/rect.width,1000/rect.height);
  const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  gl.uniformMatrix4fv(uCamera,false,new Float32Array(frame[0].flatMap((_,i)=>frame.map(row=>row[i]))));
  gl.uniform1i(uColors,0);
  gl.uniform2f(uRes,w,h);gl.uniform1i(uSteps,quality<1?48:quality<1.5?96:160);gl.drawArrays(gl.TRIANGLES,0,3);
 };
}

function updateScroll(){
 const landmarks=['#background','.current','.elsewhere'].map((selector,i)=>{
  const rect=document.querySelector(selector).getBoundingClientRect();
  return {y:scrollY+rect.top+rect.height/2-innerHeight/2,phase:readingPhase(i+1)};
 });
 const atStop=[{y:0,phase:0},...landmarks].find(mark=>Math.abs(scrollY-mark.y)<.75);
 targetPhase=atStop?atStop.phase:phaseAtScroll(scrollY,landmarks);
}
function updateText(){
 projectText(running?phase:readingPhase(navigation?.active??0));
}
function state(){
 play.textContent=running?'Pause background':'Resume background';play.setAttribute('aria-pressed',String(running));
}
function resize(){
 // Keep large text and short landscape viewports readable using ordinary flow.
 const fit=[...document.querySelectorAll('.reading-copy')].every(copy=>copy.offsetHeight<=innerHeight-160);
 setTextProjection(fit);
 navigation?.refresh();updateScroll();updateText();dirty=true;
}
function draw(){
 requestAnimationFrame(draw);
 if(document.hidden)return;
 // Navigation already eases its progress. Use that exact pose for both layers.
 if(running&&phase!==targetPhase){phase=targetPhase;updateText();dirty=true;}
 if(renderer&&dirty){dirty=false;renderer(phase);}
}
async function main(){
 await document.fonts.ready;
 initTextSprites();
 navigation=initSectionNavigation({isEnabled:()=>document.documentElement.classList.contains('projected-text'),onChange:()=>updateText()});
 resize();updateScroll();phase=targetPhase;updateText();state();
 window.addEventListener('scroll',updateScroll,{passive:true});
 window.addEventListener('resize',resize);
 play.addEventListener('click',()=>{running=!running;state();if(running)phase=targetPhase;updateText();dirty=true;});
 detail.addEventListener('change',()=>dirty=true);
 reduced.addEventListener('change',()=>{running=!reduced.matches;state();updateText();dirty=true;});
 document.addEventListener('visibilitychange',()=>{updateScroll();dirty=true;});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer=null;console.warn('Background graphics context lost. Text navigation remains available.');});
 canvas.addEventListener('webglcontextrestored',()=>{createRenderer().then(value=>{renderer=value;dirty=true;}).catch(console.warn);});
 requestAnimationFrame(draw);
 try{renderer=await createRenderer();dirty=true;}catch(error){console.warn('Background unavailable:',error.message);play.disabled=true;detail.disabled=true;}
}
main().catch(error=>{console.error(error);setTextProjection(false);});
