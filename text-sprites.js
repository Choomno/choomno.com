import {projectReadingPlane, readingPhase} from './projection.js';
const copies = [...document.querySelectorAll('main > section .reading-copy')];
let lastPhase = 0, sizes = [], enabled = false;

function measure() {
 sizes = copies.map(copy => {
  const css = getComputedStyle(copy);
  return {width: parseFloat(css.width), height: parseFloat(css.height)};
 });
}
export function projectText(phase) {
 lastPhase = phase;
 if (!enabled) return;
 copies.forEach((copy, i) => {
  const separation = Math.abs(phase - readingPhase(i));
  const opacity = Math.max(0, 1 - (separation / (Math.PI / 4)) ** 4);
  const {width, height} = sizes[i];
  const matrix = opacity > .002 && projectReadingPlane(phase, readingPhase(i), width, height, innerWidth, innerHeight);
  copy.style.visibility = matrix ? 'visible' : 'hidden';
  copy.style.opacity = String(opacity);
  copy.inert = !matrix || separation > Math.PI / 8;
  if (matrix) copy.style.transform = `matrix3d(${matrix.join(',')})`;
 });
}
export function setTextProjection(value) {
 enabled = value;
 document.documentElement.classList.toggle('projected-text', value);
 if (value) {measure(); projectText(lastPhase);}
 else copies.forEach(copy => {copy.style.transform='';copy.style.visibility='';copy.style.opacity='';copy.inert=false;});
}
export function initTextSprites() {
 document.documentElement.classList.add('projected-text');
 enabled = true;
 measure();
 const observer = new ResizeObserver(() => {measure(); projectText(lastPhase);});
 copies.forEach(copy => observer.observe(copy));
 window.addEventListener('resize', () => {measure(); projectText(lastPhase);});
 projectText(0);
}
