'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The Murshid star as a real 3D object (three.js): the eight-point mark extruded and bevelled, in a
 * satin finish lit like a studio product shot, with a cool rim light. It sways slowly and leans toward
 * the pointer; it pauses when off-screen and renders a single still frame for reduced motion.
 * It only runs on real graphics hardware: without it (software rendering), or if frames come too slowly,
 * it shows the flat mark instead, so the page never stalls. Setup waits until the browser is idle.
 */
const POINTS: [number, number][] = [
  [12, 1.8], [13.76, 7.75], [19.21, 4.79], [16.25, 10.24], [22.2, 12], [16.25, 13.76], [19.21, 19.21], [13.76, 16.25],
  [12, 22.2], [10.24, 16.25], [4.79, 19.21], [7.75, 13.76], [1.8, 12], [7.75, 10.24], [4.79, 4.79], [10.24, 7.75],
];

/** Software rendering (no GPU): SwiftShader, llvmpipe, Microsoft Basic Render and the like take seconds per frame here. */
function softwareGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(name);
  } catch { return true; }
}

export function Star3D({
  className = '', color = '#eef3ff', rim = '#5790e6', speed = 0.22, tilt = 0.32, still = false,
}: { className?: string; color?: string; rim?: string; speed?: number; tilt?: number; still?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    const start = async () => {
      if (softwareGL()) { setFallback(true); return; }
      const THREE = await import('three');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      const el = host.current;
      if (disposed || !el) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        // failIfMajorPerformanceCaveat: no context on software GL, where this scene takes seconds per frame
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
      } catch {
        setFallback(true);
        return;
      }
      if (disposed) { renderer.dispose(); return; }
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
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
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.16, bevelSegments: 5, curveSegments: 1 });
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
      // if the first second runs below ~20 fps, settle on a still frame instead of dragging the page down
      let probeFrames = 0; let probeTime = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (!visible) { last = now; return; }
        const gap = now - last;
        if (probeFrames < 30) {
          probeFrames++; if (probeFrames > 3) probeTime += gap;
          if (probeFrames === 30 && probeTime / 27 > 50) { cancelAnimationFrame(raf); raf = 0; renderer.render(scene, camera); return; }
        }
        const dt = Math.min(0.05, gap / 1000);
        last = now;
        t += dt;
        lean.x += (aim.y * tilt - lean.x) * Math.min(1, dt * 3);
        lean.y += (aim.x * tilt - lean.y) * Math.min(1, dt * 3);
        star.rotation.y = 0.45 + Math.sin(t * speed * 1.6) * 0.62 + lean.y;
        star.rotation.x = -0.18 + lean.x;
        star.position.y = Math.sin(now / 1400) * 0.08;
        renderer.render(scene, camera);
      };
      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener('pointermove', onMove);
        geo.dispose(); mat.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };

      // compile the shaders off the main thread where the browser allows it, then draw
      try { await renderer.compileAsync(scene, camera); } catch { /* older drivers: compile on first draw */ }
      if (disposed) return;
      if (reduce) renderer.render(scene, camera);
      else raf = requestAnimationFrame(frame);
    };
    // let the page paint and settle first
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const run = () => { if (!disposed) void start(); };
    const handle = hasIdle ? window.requestIdleCallback(run, { timeout: 1200 }) : setTimeout(run, 300);
    return () => {
      disposed = true;
      if (hasIdle) window.cancelIdleCallback(handle as number); else clearTimeout(handle as ReturnType<typeof setTimeout>);
      cleanup();
    };
  }, [color, rim, speed, tilt, still]);

  return (
    <div ref={host} aria-hidden className={className}>
      {fallback && (
        <svg viewBox="0 0 24 24" className="size-full p-[12%]" strokeLinejoin="round">
          <defs>
            <linearGradient id="star-flat" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor={color} />
              <stop offset="1" stopColor={rim} />
            </linearGradient>
          </defs>
          <path d={`M${POINTS.map(([x, y]) => `${x} ${y}`).join(' L')}Z`} fill="url(#star-flat)" stroke={rim} strokeOpacity={0.5} strokeWidth={0.4} />
        </svg>
      )}
    </div>
  );
}
