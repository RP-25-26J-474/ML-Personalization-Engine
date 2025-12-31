import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FaXmark } from "react-icons/fa6";

function normalizePoints(points) {
  if (!points?.length) return [];
  const coords = points.map((p) => p.coords);
  const xs = coords.map((p) => p[0]);
  const ys = coords.map((p) => p[1]);
  const zs = coords.map((p) => p[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const spanZ = maxZ - minZ || 1;

  return coords.map(([x, y, z]) => [
    (x - minX) / spanX - 0.5,
    (y - minY) / spanY - 0.5,
    (z - minZ) / spanZ - 0.5,
  ]);
}

export default function CategoryModelVectorSpace({ points = [] }) {
  const containerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const normalized = useMemo(() => normalizePoints(points), [points]);

  useEffect(() => {
    if (!containerRef.current || !normalized.length) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101318);

    const width = container.clientWidth;
    const height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0.8, 0.8, 1.3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.7;

    const grid = new THREE.GridHelper(1.5, 10, 0x2a3342, 0x1f2735);
    grid.position.y = -0.45;
    scene.add(grid);

    const axes = new THREE.AxesHelper(0.6);
    scene.add(axes);

    const positions = new Float32Array(normalized.flatMap((p) => p));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.02,
      color: 0x22c55e,
      opacity: 0.9,
      transparent: true,
    });

    const cloud = new THREE.Points(geometry, material);
    scene.add(cloud);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.03;
    const mouse = new THREE.Vector2();

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      cloud.rotation.y += 0.001;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handlePointerDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(cloud);
      if (hits.length) {
        const hitIndex = hits[0].index ?? -1;
        if (hitIndex >= 0 && points[hitIndex]) {
          setSelected(points[hitIndex]);
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      resizeObserver.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [normalized, points]);

  if (!normalized.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm opacity-70">
        No vector space data yet.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-3 bottom-3 right-3 rounded-md bg-base-200/90 border border-primary/20 p-3 text-xs">
        {selected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              className="bbtn-circ absolute p-0 top-1 right-1 text-white rounded-full disabled:opacity-60"
              onClick={() => setSelected(null)}
              disabled={!selected}
            >
              <FaXmark className="text-xs" onClick={() => setSelected(null)}
              disabled={!selected}/>
            </button>
            <div>
              <div className="text-[11px] text-base-content/60">
                Selected point #{selected.id}
              </div>
              <div className="mt-1 font-semibold">Impairment Probabilities</div>
              <div className="mt-1 text-[11px] text-base-content/70">
                {Object.entries(selected.features || {})
                  .map(([key, value]) => `${key}: ${Number(value).toFixed(2)}`)
                  .join(" · ")}
              </div>
            </div>
            <div>
              <div className="font-semibold">Profile Snapshot</div>
              <div className="mt-1 text-[11px] text-base-content/70">
                {Object.entries(selected.profile || {})
                  .slice(0, 6)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(" · ")}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-base-content/70">
            Click a point to inspect its impairment vector and profile.
          </div>
        )}
      </div>
    </div>
  );
}
