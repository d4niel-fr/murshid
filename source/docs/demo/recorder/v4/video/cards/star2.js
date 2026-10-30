// The Murshid star in 3D for the video cards (same model and lighting as components/brand/star-3d.tsx).
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
const P = [[12,1.8],[13.76,7.75],[19.21,4.79],[16.25,10.24],[22.2,12],[16.25,13.76],[19.21,19.21],[13.76,16.25],[12,22.2],[10.24,16.25],[4.79,19.21],[7.75,13.76],[1.8,12],[7.75,10.24],[4.79,4.79],[10.24,7.75]];
export function mountStar(el, { speed = 0.22, start = 0.5, manual = false } = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(window.devicePixelRatio || 1); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
  el.appendChild(r.domElement); r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100); cam.position.set(0, 0, 10);
  const sh = new THREE.Shape(); P.forEach(([x, y], i) => { const X = (x - 12) / 5, Y = -(y - 12) / 5; i ? sh.lineTo(X, Y) : sh.moveTo(X, Y); }); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.16, bevelSegments: 12, curveSegments: 6 }); g.center();
  const m = new THREE.MeshPhysicalMaterial({ color: '#eef3ff', roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5, sheen: 0.4, sheenColor: new THREE.Color('#5790e6') });
  const star = new THREE.Mesh(g, m); star.rotation.set(-0.18, start, 0.12); scene.add(star);
  const k = new THREE.DirectionalLight('#ffffff', 1.3); k.position.set(4, 6, 5); scene.add(k);
  const f = new THREE.DirectionalLight('#5790e6', 1.8); f.position.set(-5, -4, 3); scene.add(f);
  const b = new THREE.DirectionalLight('#5790e6', 2.4); b.position.set(-6, -3, -4); scene.add(b);
  scene.add(new THREE.AmbientLight('#cfdcf5', 0.2));
  const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }; size();
  const renderAt = (t, extra = 0) => { star.rotation.y = start + Math.sin(t * speed * 1.6) * 0.62 + extra; star.rotation.x = -0.18 + Math.sin(t * 0.6) * 0.08; star.position.y = Math.sin(t * 0.7) * 0.08; r.render(scene, cam); };
  if (!manual) { const t0 = performance.now(); const loop = (now) => { renderAt((now - t0) / 1000); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  return { renderAt };
}
