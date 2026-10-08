import * as THREE from "three";
import { RUINS, STATIONS, TREES } from "../shared/level";
const material = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
export function addScenery(scene: THREE.Scene, wind: { value: number }) {
  const stone = material("#a6a48b"),
    moss = material("#778851");
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // Weathered gateways create landmarks without signposts.
  for (const p of RUINS) {
    for (const dx of [-1.7, 1.7]) {
      add(new THREE.BoxGeometry(0.9, 3.4, 1), stone, p.x + dx, 1.7, p.z);
      for (let i = 0; i < 6; i++)
        add(
          new THREE.BoxGeometry(0.93, 0.035, 1.03),
          moss,
          p.x + dx,
          0.45 + i * 0.52,
          p.z,
        );
    }
    add(new THREE.BoxGeometry(4.4, 0.6, 1.2), stone, p.x, 3.5, p.z);
    add(new THREE.BoxGeometry(4.3, 0.12, 1.15), moss, p.x, 3.84, p.z);
  }
  // Distant silhouettes, outside the playable forest, frame the valley.
  const mountains = [
    material("#97b7b2"),
    material("#adc5bd"),
    material("#bfd0c4"),
  ];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2,
      r = 91 + (i % 3) * 10,
      h = 12 + (i % 7) * 4;
    const mountain = add(
      mountainGeometry(17 + (i % 3) * 5, h, i),
      mountains[i % 3],
      Math.cos(a) * r,
      h * 0.22 - 3,
      Math.sin(a) * r,
      1,
      1,
      0.8,
    );
    mountain.rotation.y = i * 0.7;
    mountain.castShadow = false;
  }
  // Ferns: leaf-shaped geometry, instanced, rather than rows of cones.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.22, 0.28, 0, 0.68);
  leafShape.quadraticCurveTo(-0.22, 0.28, 0, 0);
  const geo = new THREE.ShapeGeometry(leafShape);
  const leafMat = material("#6c9656");
  leafMat.side = THREE.DoubleSide;
  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = "uniform float uWind;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed.x += sin(uWind*1.1+position.y*4.)*.055*position.y;",
    );
  };
  const leaves = new THREE.InstancedMesh(geo, leafMat, 1500),
    dummy = new THREE.Object3D();
  let index = 0;
  for (let i = 0; i < 180; i++) {
    const x = Math.sin(i * 71.29) * 47,
      z = Math.cos(i * 47.13) * 45;
    if (
      Math.abs(x) < 5 ||
      (z < -34 && z > -44) ||
      Object.values(STATIONS).some((p) => Math.hypot(p.x - x, p.z - z) < 5) ||
      (x > 10 && x < 25 && z > -6 && z < 13)
    )
      continue;
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(-0.55, a, Math.sin(j) * 0.25);
      dummy.scale.setScalar(0.75 + (i % 4) * 0.25);
      dummy.updateMatrix();
      leaves.setMatrixAt(index, dummy.matrix);
      leaves.setColorAt(index, new THREE.Color(i % 3 ? "#a7bd71" : "#87a869"));
      index++;
    }
  }
  leaves.count = index;
  leaves.receiveShadow = true;
  scene.add(leaves);
  // White birch bark and clusters of broad crowns break up the pine silhouettes.
  const bark = material("#d7d2b7"),
    stripe = material("#777c64");
  TREES.forEach((t, i) => {
    if (t.pine || i % 2) return;
    add(
      new THREE.CylinderGeometry(0.21 * t.s, 0.43 * t.s, 7 * t.s, 9),
      bark,
      t.x,
      3.5 * t.s,
      t.z,
    );
    for (let j = 0; j < 7; j++) {
      const band = add(
        new THREE.CylinderGeometry(
          (0.43 - 0.03 * j) * t.s,
          (0.44 - 0.03 * j) * t.s,
          0.06,
          8,
          1,
          true,
          0,
          Math.PI * 1.2,
        ),
        stripe,
        t.x,
        (0.7 + j * 0.74) * t.s,
        t.z,
      );
      band.rotation.y = j * 1.9;
    }
  });
  // Small flowers are deliberately soft foliage, not rigid obstacles.
  const petals = [
    material("#eabbb7"),
    material("#d4d2ed"),
    material("#f4dda1"),
  ];
  for (let k = 0; k < 3; k++) {
    const flowers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.1, 6, 4),
      petals[k],
      250,
    );
    let count = 0;
    for (let i = 0; i < 250; i++) {
      const x = Math.sin((i + k * 251) * 19.7) * 45,
        z = Math.cos((i + k * 251) * 11.8) * 44;
      if (
        Math.abs(x) < 4 ||
        (z < -35 && z > -44) ||
        Object.values(STATIONS).some((p) => Math.hypot(p.x - x, p.z - z) < 4)
      )
        continue;
      dummy.position.set(x, 0.18 + (i % 3) * 0.035, z);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(1, 0.45, 1);
      dummy.updateMatrix();
      flowers.setMatrixAt(count++, dummy.matrix);
    }
    flowers.count = count;
    scene.add(flowers);
  }
}
export function groundMaterial() {
  const m = material("#8fa66d");
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vGround;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGround=(modelMatrix*vec4(position,1.)).xyz;",
    );
    shader.fragmentShader = "varying vec3 vGround;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
    float groundPatch=sin(vGround.x*.22+sin(vGround.z*.18)*2.)*cos(vGround.z*.21);
    float grain=fract(sin(dot(floor(vGround.xz*32.),vec2(127.1,311.7)))*43758.5453);
    diffuseColor.rgb*= .91+groundPatch*.10+grain*.055;
  `,
    );
  };
  return m;
}
export function addSky(scene: THREE.Scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(165, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color("#8ebbd2") },
        horizon: { value: new THREE.Color("#e7dfbf") },
      },
      vertexShader:
        "varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec3 vSky;uniform vec3 top;uniform vec3 horizon;
    void main(){vec3 d=normalize(vSky);float t=pow(max(d.y,0.),.65);vec3 col=mix(horizon,top,t);
    float sun=dot(d,normalize(vec3(24.,34.,-20.)));col+=vec3(1.,.78,.40)*pow(max(sun,0.),64.)*.4;
    float cloud=sin(d.x*24.+sin(d.z*16.))*sin(d.z*25.+d.x*7.);float veil=smoothstep(.28,.64,cloud)*smoothstep(.08,.3,d.y)*(1.-smoothstep(.6,.95,d.y));col=mix(col,vec3(.88,.9,.83),veil*.32);
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
}

function mountainGeometry(radius: number, height: number, seed: number) {
  const geometry = new THREE.ConeGeometry(radius, height, 16, 7);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      a = Math.atan2(z, x),
      t = (y + height / 2) / height;
    const ridge =
      1 + Math.sin(a * 3 + seed) * 0.2 + Math.sin(a * 7 + t * 4 + seed) * 0.1;
    p.setXYZ(
      i,
      x * ridge + Math.sin(t * 3 + seed) * height * 0.15,
      y + Math.sin(a * 5 + seed) * Math.sin(t * Math.PI) * height * 0.07,
      z * ridge,
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
