'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The Murshid star as a real 3D object (three.js): the eight-point mark extruded and bevelled, in a
 * satin finish lit like a studio product shot, with a cool rim light. It sways slowly and leans toward
 * the pointer; it pauses when off-screen and renders a single still frame for reduced motion.
 * If WebGL is unavailable it falls back to the flat mark.
 */
const POINTS: [number, number][] = [
  [12, 1.8], [13.76, 7.75], [19.21, 4.79], [16.25, 10.24], [22.2, 12], [16.25, 13.76], [19.21, 19.21], [13.76, 16.25],
  [12, 22.2], [10.24, 16.25], [4.79, 19.21], [7.75, 13.76], [1.8, 12], [7.75, 10.24], [4.79, 4.79], [10.24, 7.75],
];

export function Star3D({
  className = '', color = '#eef3ff', rim = '#5790e6', speed = 0.22, tilt = 0.32, still = false,
}: { className?: string; color?: string; rim?: string; speed?: number; tilt?: number; still?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const el = host.current;
      if (disposed || !el) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
      } catch {
        setFallback(true);
        return;
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;

      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
      camera.position.set(0, 0, 10);

      const shape = new THREE.Shape();
      POINTS.forEach(([x, y], i) => {
        const X = (x - 12) / 5;
        const Y = -(y - 12) / 5;
        if (i === 0) shape.moveTo(X, Y); else shape.lineTo(X, Y);
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.16, bevelSegments: 12, curveSegments: 6 });
      geo.center();
      geo.computeVertexNormals();
      const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5, sheen: 0.4, sheenColor: new THREE.Color(rim) });
      const star = new THREE.Mesh(geo, mat);
      star.rotation.set(-0.18, 0.5, 0.12);
      scene.add(star);

      const key = new THREE.DirectionalLight('#ffffff', 1.3);
      key.position.set(4, 6, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(rim, 1.8);
      fill.position.set(-5, -4, 3);
      scene.add(fill);
      const back = new THREE.DirectionalLight(rim, 2.4);
      back.position.set(-6, -3, -4);
      scene.add(back);
      scene.add(new THREE.AmbientLight('#cfdcf5', 0.2));

      const size = () => {
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(el);

      const reduce = still || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const aim = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        aim.x = (e.clientX / window.innerWidth - 0.5) * 2;
        aim.y = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onMove, { passive: true });

      let visible = true;
      const io = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; }, { threshold: 0 });
      io.observe(el);

      let raf = 0;
      let last = performance.now();
      let t = 0;
      const lean = { x: 0, y: 0 };
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (!visible) { last = now; return; }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        lean.x += (aim.y * tilt - lean.x) * Math.min(1, dt * 3);
        lean.y += (aim.x * tilt - lean.y) * Math.min(1, dt * 3);
        star.rotation.y = 0.45 + Math.sin(t * speed * 1.6) * 0.62 + lean.y;
        star.rotation.x = -0.18 + lean.x;
        star.position.y = Math.sin(now / 1400) * 0.08;
        renderer.render(scene, camera);
      };
      if (reduce) renderer.render(scene, camera);
      else raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onMove);
        geo.dispose(); mat.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => { disposed = true; cleanup(); };
  }, [color, rim, speed, tilt, still]);

  return (
    <div ref={host} aria-hidden className={className}>
      {fallback && (
        <svg viewBox="0 0 24 24" className="size-full p-[12%]" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round">
          <path d={`M${POINTS.map(([x, y]) => `${x} ${y}`).join(' L')}Z`} />
        </svg>
      )}
    </div>
  );
}
