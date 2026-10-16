import {identity,advance,translation,rotation,multiply,fragment,beamData,cuspOrbit} from './rhombic.js';
const canvas=document.querySelector('#space'),fallback=document.querySelector('#fallback');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false});
async function main(){
 if(!gl)throw Error('WebGL 2 is needed for the intrinsic ray tracer.');
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
 const play=document.querySelector('#play'),speed=document.querySelector('#travel'),detail=document.querySelector('#detail');const reduced=matchMedia('(prefers-reduced-motion: reduce)');let running=!reduced.matches,phase=0,frame=cuspOrbit(0),tet=0,ideal=[1,0,0,1],drag=null,dirty=true,last=0,visible=true;const keys=new Set();
 function state(){play.textContent=running?'Pause orbit':'Resume orbit';play.setAttribute('aria-pressed',String(running));}state();
 function move(step){running=false;state();({frame,tet,ideal}=advance(frame,tet,step,data,ideal));dirty=true;}
 function draw(time){requestAnimationFrame(draw);const dt=Math.min((time-last)/1000,.04);last=time;if(document.hidden||!visible)return;
 if(running&&!drag){phase=(phase+dt*Number(speed.value))%(2*Math.PI);frame=cuspOrbit(phase);tet=0;ideal=[1,0,0,1];dirty=true;}
 if(keys.has('w')||keys.has('s'))move(translation(dt*(keys.has('w')?1:-1)*.7));
 if(keys.has('ArrowLeft')||keys.has('ArrowRight'))move(rotation(1,3,dt*(keys.has('ArrowLeft')?1:-1)));
 if(keys.has('ArrowUp')||keys.has('ArrowDown'))move(rotation(2,3,dt*(keys.has('ArrowDown')?1:-1)));
 if(!dirty)return;dirty=false;
 const rect=canvas.getBoundingClientRect(),quality=Number(detail.value),ratio=quality;const w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
 gl.uniformMatrix4fv(uCamera,false,new Float32Array(frame[0].flatMap((_,i)=>frame.map(row=>row[i]))));gl.uniform1i(uColors,document.querySelector('#cusp-colors').checked?1:0);gl.uniform2f(uRes,w,h);gl.uniform1i(uSteps,quality<1?48:quality<1.5?96:160);gl.drawArrays(gl.TRIANGLES,0,3);
 }
 canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});canvas.addEventListener('pointermove',e=>{if(!drag)return;move(multiply(rotation(1,3,(e.clientX-drag[0])*.004),rotation(2,3,(e.clientY-drag[1])*.004)));drag=[e.clientX,e.clientY];});for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();move(translation(Math.max(-.2,Math.min(.2,e.deltaY*.001))));},{passive:false});
 canvas.addEventListener('keydown',e=>{if(['w','s','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();keys.add(e.key);}});canvas.addEventListener('keyup',e=>keys.delete(e.key));canvas.addEventListener('blur',()=>keys.clear());
 play.addEventListener('click',()=>{running=!running;if(running){frame=cuspOrbit(phase);tet=0;ideal=[1,0,0,1];dirty=true;}state();});detail.addEventListener('change',()=>dirty=true);document.querySelector('#cusp-colors').addEventListener('change',()=>dirty=true);document.querySelector('#reset').addEventListener('click',()=>{phase=0;frame=cuspOrbit(0);tet=0;ideal=[1,0,0,1];dirty=true;});new ResizeObserver(()=>dirty=true).observe(canvas);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;dirty=true;}).observe(canvas);reduced.addEventListener('change',()=>{running=!reduced.matches;state();});document.addEventListener('visibilitychange',()=>{keys.clear();dirty=true;});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback.textContent='The graphics context was lost. Reload to resume the ray tracer.';fallback.hidden=false;});
 requestAnimationFrame(draw);
}
main().catch(error=>{console.error(error);fallback.textContent=error.message;fallback.hidden=false;});
