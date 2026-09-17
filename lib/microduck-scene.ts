import { isSoftwareRenderer, renderPixelRatio } from "./render-quality";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { World } from "../types/microduck";

const colors = [0x67e8f9, 0xff92cf, 0xfbbf60, 0xa5b4fc];
/** Rendering only: positions, cargo and outcomes always come from the simulator. */
export function createDuckScene(
  host: HTMLElement,
  initial: World,
  onSelect: (id: string) => void,
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const software = isSoftwareRenderer(renderer.getContext());
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.setAttribute(
    "aria-label",
    "3D MicroDuck arena. Drag to orbit, scroll to zoom. Select robots using the buttons below.",
  );
  canvas.setAttribute("role", "img");
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080e1b);
  scene.fog = new THREE.FogExp2(0x080e1b, 0.022);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2.35;
  controls.minDistance = 5;
  controls.maxDistance = 42;
  controls.target.set(initial.width / 2, 0, initial.height / 2);
  const hemi = new THREE.HemisphereLight(0xb8d7ff, 0x172439, 2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xf5f4ff, 4);
  sun.position.set(-4, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -18,
    right: 18,
    top: 18,
    bottom: -18,
  });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x49cfff, 2);
  fill.position.set(14, 4, -7);
  scene.add(fill);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  function material(
    color: number,
    metalness = 0.6,
    roughness = 0.3,
    glow = false,
  ) {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      ...(glow ? { emissive: color, emissiveIntensity: 2.1 } : {}),
    });
    materials.add(m);
    return m;
  }
  const floor = material(0x263449, 0.75, 0.32);
  const surface = document.createElement("canvas");
  surface.width = surface.height = 128;
  const paint = surface.getContext("2d")!;
  paint.fillStyle = "#999";
  paint.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i++) {
    paint.fillStyle = `rgb(${135 + ((i * 17) % 35)},${135 + ((i * 17) % 35)},${135 + ((i * 17) % 35)})`;
    paint.fillRect(0, i, 128, 1);
  }
  paint.strokeStyle = "#555";
  paint.lineWidth = 2;
  paint.strokeRect(7, 7, 114, 114);
  const texture = new THREE.CanvasTexture(surface);
  floor.roughnessMap = texture;
  floor.bumpMap = texture;
  floor.bumpScale = 0.015;
  const wall = material(0x526077, 0.8, 0.25);
  const black = material(0x101722, 0.4, 0.35);
  const white = material(0xd8e4eb, 0.65, 0.24);
  const rubber = material(0x101319, 0, 0.85);
  const amber = material(0xffb547, 0.4, 0.3);
  const glow = colors.map((c) => material(c, 0.25, 0.2, true));
  const shell = colors.map((c) => material(c, 0.7, 0.23));
  function mesh(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    geometries.add(geo);
    const object = new THREE.Mesh(geo, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(
    parent: THREE.Object3D,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) {
    return mesh(
      parent,
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, h / 5, w / 5, d / 5)),
      mat,
      x,
      y,
      z,
    );
  }
  const arena = new THREE.Group();
  scene.add(arena);
  const robots = new Map<
    string,
    { root: THREE.Group; ring: THREE.Mesh; cargo: THREE.Mesh }
  >();
  const packages = new Map<string, THREE.Mesh>();
  let world = initial,
    selected = initial.ducks[0].id;
  let layout = "",
    disposed = false;
  function clearArena() {
    arena.clear();
    robots.clear();
    packages.clear();
    geometries.forEach((g) => g.dispose());
    geometries.clear();
  }
  let renderUntil = performance.now() + 350;
  let needsRender = true;
  function home() {
    needsRender = true;
    renderUntil = performance.now() + 350;
    const radius = Math.hypot(world.width + 1, world.height + 1) / 2;
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.08;
    controls.target.set(world.width / 2, 0.25, world.height / 2);
    camera.position
      .copy(controls.target)
      .add(
        new THREE.Vector3(0.65, 0.9, 1).normalize().multiplyScalar(distance),
      );
    controls.maxDistance = Math.max(42, distance * 2);
    controls.update();
  }
  function build() {
    clearArena();
    box(
      arena,
      black,
      world.width / 2,
      -0.25,
      world.height / 2,
      world.width + 0.7,
      0.4,
      world.height + 0.7,
    );
    for (let y = 0; y < world.height; y++)
      for (let x = 0; x < world.width; x++) {
        box(arena, floor, x + 0.5, -0.03, y + 0.5, 0.965, 0.12, 0.965);
        if (world.walls.includes(`${x},${y}`)) {
          box(arena, wall, x + 0.5, 0.4, y + 0.5, 0.9, 0.8, 0.9);
          box(arena, black, x + 0.5, 0.81, y + 0.5, 0.8, 0.025, 0.8);
          box(arena, glow[0], x + 0.5, 0.64, y + 0.037, 0.55, 0.025, 0.018);
        }
      }
    for (const z of [-0.2, world.height + 0.2])
      box(
        arena,
        glow[0],
        world.width / 2,
        0,
        z,
        world.width + 0.5,
        0.035,
        0.035,
      );
    for (const x of [-0.2, world.width + 0.2])
      box(
        arena,
        glow[1],
        x,
        0,
        world.height / 2,
        0.035,
        0.035,
        world.height + 0.5,
      );
    world.ducks.forEach((duck, i) => {
      const mission = world.missions[duck.id];
      const dock = mesh(
        arena,
        new THREE.CylinderGeometry(0.43, 0.46, 0.06, 32),
        black,
        mission.nest.x + 0.5,
        0.07,
        mission.nest.y + 0.5,
      );
      const halo = mesh(
        dock,
        new THREE.TorusGeometry(0.35, 0.022, 8, 48),
        glow[i],
        0,
        0.04,
        0,
      );
      halo.rotation.x = Math.PI / 2;
      for (const x of [-0.13, 0.13])
        box(dock, glow[i], x, 0.035, 0, 0.035, 0.02, 0.3);
      const cargo = box(arena, amber, 0, 0.22, 0, 0.3, 0.32, 0.3);
      box(cargo, black, 0, 0.005, 0, 0.315, 0.07, 0.315);
      packages.set(duck.id, cargo);
      const root = new THREE.Group();
      arena.add(root);
      root.userData.duckId = duck.id;
      const body = mesh(
        root,
        new THREE.SphereGeometry(0.3, 24, 16),
        white,
        0,
        0.33,
        0,
      );
      body.scale.set(1, 0.8, 1.25);
      box(root, shell[i], 0, 0.19, 0, 0.53, 0.11, 0.54);
      for (const x of [-0.3, 0.3]) {
        const wheel = mesh(
          root,
          new THREE.CylinderGeometry(0.16, 0.16, 0.11, 24),
          rubber,
          x,
          0.18,
          0.07,
        );
        wheel.rotation.z = Math.PI / 2;
        const hub = mesh(
          root,
          new THREE.CylinderGeometry(0.085, 0.085, 0.115, 20),
          shell[i],
          x,
          0.18,
          0.07,
        );
        hub.rotation.z = Math.PI / 2;
      }
      const head = mesh(
        root,
        new THREE.SphereGeometry(0.23, 24, 16),
        shell[i],
        0,
        0.67,
        -0.17,
      );
      head.scale.set(1, 0.92, 0.9);
      const visor = mesh(
        root,
        new THREE.SphereGeometry(0.19, 24, 16),
        black,
        0,
        0.69,
        -0.265,
      );
      visor.scale.set(1, 0.48, 0.56);
      for (const x of [-0.077, 0.077])
        mesh(
          root,
          new THREE.SphereGeometry(0.031, 12, 8),
          glow[i],
          x,
          0.7,
          -0.36,
        );
      box(root, amber, 0, 0.59, -0.38, 0.2, 0.065, 0.19);
      box(root, black, 0, 0.93, -0.14, 0.022, 0.2, 0.022);
      mesh(
        root,
        new THREE.SphereGeometry(0.045, 12, 8),
        glow[i],
        0,
        1.035,
        -0.14,
      );
      const carried = box(root, amber, 0, 0.57, 0.22, 0.26, 0.26, 0.26);
      const ring = mesh(
        root,
        new THREE.TorusGeometry(0.46, 0.016, 8, 48),
        glow[i],
        0,
        0.08,
        0,
      );
      ring.rotation.x = Math.PI / 2;
      root.position.set(duck.x + 0.5, 0, duck.y + 0.5);
      root.rotation.y = (-duck.heading * Math.PI) / 2;
      robots.set(duck.id, { root, ring, cargo: carried });
    });
    home();
  }
  function update(next: World, id: string) {
    needsRender = true;
    renderUntil = performance.now() + 350;
    world = next;
    selected = id;
    const key = JSON.stringify([
      world.width,
      world.height,
      world.seed,
      world.walls,
      world.ducks.map((d) => d.id),
    ]);
    if (key !== layout) {
      layout = key;
      build();
    }
    canvas.dataset.tick = String(world.tick);
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0,
    previous = performance.now();
  function render(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(render);
    const delta = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    if (document.hidden) return;
    const settled = now >= renderUntil;
    const blend = reduced.matches || settled ? 1 : 1 - Math.exp(-delta * 12);
    world.ducks.forEach((duck) => {
      const robot = robots.get(duck.id)!;
      robot.root.position.x += (duck.x + 0.5 - robot.root.position.x) * blend;
      robot.root.position.z += (duck.y + 0.5 - robot.root.position.z) * blend;
      const angle = (-duck.heading * Math.PI) / 2;
      robot.root.rotation.y +=
        Math.atan2(
          Math.sin(angle - robot.root.rotation.y),
          Math.cos(angle - robot.root.rotation.y),
        ) * blend;
      robot.ring.visible = selected === duck.id;
      robot.cargo.visible = duck.carrying;
      const cargo = packages.get(duck.id)!;
      const position = world.missions[duck.id].cargo;
      cargo.visible = !!position;
      if (position)
        cargo.position.set(position.x + 0.5, 0.22, position.y + 0.5);
    });
    controls.enableDamping = !reduced.matches;
    const cameraChanged = controls.update();
    if (!cameraChanged && !needsRender && settled) return;
    needsRender = !settled;
    renderer.render(scene, camera);
    canvas.dataset.rendered = "true";
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      renderPixelRatio(width, height, window.devicePixelRatio, software),
    );
    renderer.setSize(width, height, false);
    home();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  function pointerDown(e: PointerEvent) {
    down = { x: e.clientX, y: e.clientY };
  }
  function pointerUp(e: PointerEvent) {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(
      [...robots.values()].map((r) => r.root),
      true,
    )[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.duckId) object = object.parent;
    if (object) onSelect(object.userData.duckId);
  }
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  update(initial, selected);
  resize();
  raf = requestAnimationFrame(render);
  return {
    update,
    home,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      clearArena();
      materials.forEach((m) => m.dispose());
      texture.dispose();
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
