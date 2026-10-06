import * as THREE from "three";
import { avatar } from "./avatar";
import {
  TREES,
  WALLS,
  STATIONS,
  SIGN_SEQUENCE,
  LIGHT_COUNTS,
  basketX,
  solved,
  type Snapshot,
} from "../shared/game";
const mat = (color: string, roughness = 1) =>
  new THREE.MeshStandardMaterial({ color, roughness });
export class Forest {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
  renderer: THREE.WebGLRenderer;
  heldOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 12),
    new THREE.MeshStandardMaterial({
      color: "#f7d792",
      emissive: "#bf8a34",
      emissiveIntensity: 0.4,
    }),
  );
  lobbyAvatar = avatar("#f3bf70");
  companion = avatar("#a6c7a1");
  basket = new THREE.Group();
  bridge = new THREE.Group();
  lampMeshes: THREE.Mesh[] = [];
  signTiles: THREE.Mesh[] = [];
  balls = new Map<number, THREE.Mesh>();
  others = new Map<string, THREE.Group>();
  pointLines = new Map<string, THREE.Line>();
  water: THREE.ShaderMaterial;
  wind = { value: 0 };
  sun: THREE.DirectionalLight;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.scene.add(this.camera);
    this.heldOrb.position.set(0.4, -0.32, -0.75);
    this.heldOrb.visible = false;
    this.camera.add(this.heldOrb);
    this.scene.background = new THREE.Color("#bdc9ad");
    this.scene.fog = new THREE.FogExp2("#b7c7ac", 0.016);
    this.scene.add(new THREE.HemisphereLight("#e4e9cb", "#5b7250", 2.2));
    this.sun = new THREE.DirectionalLight("#ffe0a0", 3.2);
    this.sun.position.set(32, 38, -28);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -50,
      right: 50,
      top: 50,
      bottom: -50,
      near: 1,
      far: 130,
    });
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const ground = this.mesh(
      new THREE.PlaneGeometry(130, 130, 1, 1),
      mat("#7b9560"),
      0,
      -0.03,
      0,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    // Winding sand paths: overlapping soft-edged circles, with varied stone edging.
    const pathmat = mat("#b9b18a");
    const path = (points: THREE.Vector3[], width: number) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const vertices: number[] = [],
        indices: number[] = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80,
          p = curve.getPoint(t),
          tangent = curve.getTangent(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        for (const sign of [-1, 1])
          vertices.push(
            p.x + normal.x * width * sign,
            0.008,
            p.z + normal.z * width * sign,
          );
        if (i < 80) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      const m = this.mesh(g, pathmat, 0, 0, 0);
      m.receiveShadow = true;
    };
    path(
      [
        new THREE.Vector3(2, 0, 29),
        new THREE.Vector3(-1, 0, 15),
        new THREE.Vector3(1, 0, 4),
        new THREE.Vector3(-4, 0, -12),
        new THREE.Vector3(0, 0, -35),
      ],
      2.1,
    );
    path(
      [
        new THREE.Vector3(0, 0, 5),
        new THREE.Vector3(-10, 0, 1),
        new THREE.Vector3(-20, 0, -4),
      ],
      1.5,
    );
    path(
      [
        new THREE.Vector3(1, 0, 10),
        new THREE.Vector3(9, 0, 9),
        new THREE.Vector3(20, 0, 6),
      ],
      1.6,
    );
    path(
      [
        new THREE.Vector3(-2, 0, -17),
        new THREE.Vector3(2, 0, -23),
        new THREE.Vector3(-6, 0, -25),
      ],
      1.3,
    );
    this.trees();
    this.groundDetails();
    this.water = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new THREE.Color("#3d817c") },
        shallow: { value: new THREE.Color("#91c4a5") },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vWorld; uniform float time; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.8+time)*.035+cos(p.y*1.4+time*.7)*.025;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec2 vUv;varying vec3 vWorld;uniform float time;uniform vec3 deep;uniform vec3 shallow;void main(){float rip=sin(vWorld.x*2.4+vWorld.z*5.+time*1.8)*sin(vWorld.x*.7-vWorld.z*2.+time);float gleam=pow(max(0.,rip),14.);vec3 col=mix(deep,shallow,.35+.2*sin(vWorld.x*.15+vWorld.z));col+=vec3(1.,.93,.68)*gleam*.45;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
      side: THREE.DoubleSide,
    });
    const water = this.mesh(
      new THREE.PlaneGeometry(128, 7, 120, 16),
      this.water,
      0,
      -0.1,
      -39.5,
    );
    water.rotation.x = -Math.PI / 2;
    for (const z of [-35.9, -43.1])
      for (let i = 0; i < 40; i++) {
        const x = -59 + i * 3;
        if (Math.abs(x) < 3) continue;
        const rock = this.mesh(
          new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.22, 0),
          mat(i % 2 ? "#849684" : "#9aa58d"),
          x,
          0.05,
          z + Math.sin(i) * 0.4,
        );
        rock.scale.set(1.6, 0.65, 1);
      }
    this.cabin();
    this.throwStation();
    this.lightStation();
    this.makeBridge();
    this.camp();
    this.directionSigns();
    this.lobbyAvatar.position.set(7, 0.02, 16);
    this.lobbyAvatar.rotation.y = -2.65;
    this.lobbyAvatar.scale.setScalar(1.7);
    this.scene.add(this.lobbyAvatar);
    this.companion.position.set(10, 0.02, 14);
    this.companion.rotation.y = -2.8;
    this.companion.scale.setScalar(1.6);
    this.scene.add(this.companion);
    this.camera.position.set(25, 9, 32);
    this.camera.lookAt(3, 1, 6);
    const points = [];
    for (let i = 0; i < 80; i++)
      points.push(
        Math.sin(i * 37.7) * 35,
        1 + (i % 11) * 0.32,
        Math.cos(i * 17.1) * 35,
      );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: "#fff0ac",
        size: 0.055,
        transparent: true,
        opacity: 0.7,
      }),
    );
    dust.name = "dust";
    this.scene.add(dust);
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.querySelector("#fatal")?.removeAttribute("hidden");
    });
    canvas.addEventListener("webglcontextrestored", () => location.reload());
  }
  mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }
  box(
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) {
    const m = this.mesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  board(
    text: string,
    x: number,
    y: number,
    z: number,
    width = 3,
    height = 1.3,
    color = "#e9e4ca",
  ) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = 320;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 768, 320);
    ctx.strokeStyle = "#536449";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 744, 296);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#354d3e";
    const lines = text.split("\n");
    ctx.font = `${lines.length > 2 ? 33 : 46}px Georgia`;
    lines.forEach((line, i) =>
      ctx.fillText(line, 384, 160 + (i - (lines.length - 1) / 2) * 65),
    );
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = this.mesh(
      new THREE.BoxGeometry(width, height, 0.1),
      mat("#705c40"),
      x,
      y,
      z,
    );
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.97, height * 0.94),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }),
    );
    face.position.z = 0.056;
    board.add(face);
    return board;
  }
  trees() {
    const trunkMat = mat("#766c51");
    const leafMat = mat("#526f47");
    leafMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = this.wind;
      shader.vertexShader = "uniform float uWind;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n transformed.x += sin(uWind*.7 + position.y*1.4)*.045*max(position.y,0.);",
      );
    };
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.2, 0.43, 1, 7),
      trunkMat,
      TREES.length,
    );
    const leaves = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 8),
      leafMat,
      TREES.filter((t) => t.pine).length * 3,
    );
    const round = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      leafMat,
      TREES.filter((t) => !t.pine).length * 3,
    );
    const dummy = new THREE.Object3D();
    let pi = 0,
      ri = 0;
    TREES.forEach((t, i) => {
      dummy.position.set(t.x, 3.5 * t.s, t.z);
      dummy.scale.set(t.s, 7 * t.s, t.s);
      dummy.rotation.set(0, i, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 3; j++) {
        dummy.position.set(
          t.x + (t.pine ? 0 : Math.sin(j * 2) * 0.8),
          (t.pine ? 4.3 + j * 1.7 : 6.8 + j * 0.8) * t.s,
          t.z + (t.pine ? 0 : Math.cos(j * 2) * 0.8),
        );
        dummy.scale.set(
          (t.pine ? 3.2 - j * 0.7 : 2.3) * t.s,
          (t.pine ? 5 - j * 0.6 : 2.5) * t.s,
          (t.pine ? 3.2 - j * 0.7 : 2.3) * t.s,
        );
        dummy.updateMatrix();
        const target = t.pine ? leaves : round;
        const idx = t.pine ? pi++ : ri++;
        target.setMatrixAt(idx, dummy.matrix);
        target.setColorAt(
          idx,
          new THREE.Color().setHSL(
            0.23 + (i % 6) * 0.008,
            0.22 + (i % 3) * 0.04,
            0.25 + (i % 7) * 0.018,
          ),
        );
      }
    });
    for (const mesh of [trunks, leaves, round]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }
  groundDetails() {
    const dummy = new THREE.Object3D();
    const geo = new THREE.ConeGeometry(0.16, 0.55, 3);
    const grass = new THREE.InstancedMesh(geo, mat("#809258"), 2400);
    let index = 0;
    for (let i = 0; i < 4000 && index < 2400; i++) {
      const x = Math.sin(i * 127.1) * 52,
        z = Math.cos(i * 311.7) * 49;
      if (
        Math.abs(x) < 4 ||
        (z < -35 && z > -44) ||
        Object.values(STATIONS).some((p) => Math.hypot(x - p.x, z - p.z) < 4) ||
        (x > 10 && x < 25 && z > -6 && z < 13)
      )
        continue;
      dummy.position.set(x, 0.15, z);
      dummy.scale.set(1, 0.5 + (i % 7) * 0.14, 1);
      dummy.rotation.set(0, i, Math.sin(i) * 0.15);
      dummy.updateMatrix();
      grass.setMatrixAt(index, dummy.matrix);
      grass.setColorAt(
        index,
        new THREE.Color(
          i % 5 === 0 ? "#aaa770" : i % 3 === 0 ? "#72884f" : "#859b61",
        ),
      );
      index++;
    }
    grass.count = index;
    this.scene.add(grass);
    const rockMat = mat("#8f9980");
    for (let i = 0; i < 65; i++) {
      const x = Math.sin(i * 21.73) * 44,
        z = Math.cos(i * 8.17) * 37;
      if (
        Math.abs(x) < 5 ||
        Object.values(STATIONS).some((p) => Math.hypot(x - p.x, z - p.z) < 5)
      )
        continue;
      const rock = this.mesh(
        new THREE.DodecahedronGeometry(0.3 + (i % 4) * 0.15, 0),
        rockMat,
        x,
        0.1,
        z,
      );
      rock.scale.set(1.3, 0.7, 1);
      rock.rotation.set(i, 0, i);
      rock.castShadow = true;
    }
    const flowerMat = mat("#e1d5a0"),
      stemMat = mat("#657b46");
    for (let i = 0; i < 85; i++) {
      const x = 5 + Math.sin(i * 8.13) * 16,
        z = 14 + Math.cos(i * 12.1) * 12;
      if (Math.abs(x) < 3) continue;
      this.mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.34, 4),
        stemMat,
        x,
        0.15,
        z,
      );
      const flower = this.mesh(
        new THREE.IcosahedronGeometry(0.1, 0),
        flowerMat,
        x,
        0.34,
        z,
      );
      flower.scale.y = 0.4;
    }
    for (const [x, z] of [
      [-8, 15],
      [13, 18],
      [-25, -1],
      [7, -16],
    ]) {
      const log = this.mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 3.5, 9),
        mat("#78674c"),
        x,
        0.37,
        z,
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = 0.3;
      log.castShadow = true;
    }
  }
  plate(x: number, z: number) {
    const plate = this.mesh(
      new THREE.CylinderGeometry(1.3, 1.45, 0.12, 32),
      mat("#aeb7a1"),
      x,
      0.06,
      z,
    );
    const ring = this.mesh(
      new THREE.TorusGeometry(1.04, 0.035, 6, 32),
      new THREE.MeshStandardMaterial({
        color: "#ddc580",
        emissive: "#8c6728",
        emissiveIntensity: 0.25,
      }),
      x,
      0.13,
      z,
    );
    ring.rotation.x = -Math.PI / 2;
    return plate;
  }
  cabin() {
    for (const w of WALLS.slice(0, 5))
      this.box(w.w, w.h, w.d, "#8e8b68", w.x, w.h / 2, w.z);
    // Horizontal timber seams and roof beams.
    for (let j = 1; j < 8; j++)
      for (const x of [-23.26, -16.74])
        this.box(0.06, 0.035, 9, "#5f6b51", x, j * 0.5, -8);
    const roof = this.mesh(
      new THREE.ConeGeometry(5.4, 2, 4),
      mat("#526753"),
      -20,
      4.9,
      -8,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 1.25;
    roof.castShadow = true;
    this.board(
      "01  /  ЛЕСНЫЕ ЗНАКИ\nОдин видит. Другой собирает.",
      -20,
      2.8,
      -3.16,
      4.5,
      0.85,
    );
    this.plate(-20, -8);
    this.board(
      "Встань на круг\nи поделись рисунками",
      -20,
      2,
      -12.15,
      3.9,
      1.2,
    );
    const icons = ["◒", "☾", "☀", "≈"];
    for (let i = 0; i < 4; i++) {
      const b = this.board(
        `${i + 1}    ${icons[i]}`,
        -16.5 + i * 1.05,
        1.2,
        -4,
        1,
        0.85,
      );
      this.box(0.13, 1, 0.13, "#776c4b", b.position.x, 0.5, -4);
      this.signTiles.push(b);
    }
    this.board("Друг внутри → нажимай 1–4", -15, 2.2, -4, 4.3, 0.55);
    const lantern = new THREE.PointLight("#ffd48b", 6, 9, 2);
    lantern.position.set(-20, 3, -8);
    this.scene.add(lantern);
  }
  throwStation() {
    this.board(
      "02  /  ПО ТУ СТОРОНУ\nТри шара. Две пары рук.",
      17,
      3,
      -4,
      5,
      1,
    );
    for (const x of [14, 20]) this.box(0.15, 3, 0.15, "#75684c", x, 1.5, -4);
    this.box(9, 0.15, 0.2, "#91896b", 17, 0.55, -2);
    this.scene.add(this.basket);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.075, 8, 32),
      mat("#d0b27c"),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.45;
    this.basket.add(rim);
    for (let i = 0; i < 14; i++) {
      const a = (i * Math.PI) / 7;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.75, 5),
        mat("#ad9870"),
      );
      pole.position.set(Math.cos(a) * 0.91, 1.04, Math.sin(a) * 0.91);
      this.basket.add(pole);
    }
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.8, 0.1, 24),
      mat("#958768"),
    );
    bottom.position.y = 0.67;
    this.basket.add(bottom);
    this.basket.position.set(17, 0, -2);
    this.box(0.7, 1, 0.7, "#8b987b", 22, 0.5, 5);
    const lever = this.mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.65, 8),
      mat("#67563e"),
      22,
      1.2,
      5,
    );
    lever.rotation.z = -0.5;
    this.mesh(
      new THREE.SphereGeometry(0.15, 12, 8),
      mat("#cdab75"),
      22.15,
      1.5,
      5,
    );
    this.board("E — держать рычаг\n← → двигать корзину", 22, 2.35, 4.8, 3, 1);
    this.board("Возьми шар: E\nПрицелься чуть выше • ЛКМ", 15, 1.8, 9, 3.4, 1);
    this.box(3, 0.2, 1, "#8d7d5d", 15, 0.15, 8);
    const ring = this.mesh(
      new THREE.TorusGeometry(0.7, 0.05, 5, 24),
      mat("#eee2b3"),
      17,
      0.035,
      6,
    );
    ring.rotation.x = -Math.PI / 2;
  }
  lightStation() {
    const w = WALLS[5];
    this.box(w.w, w.h, w.d, "#8d9273", w.x, w.h / 2, w.z);
    this.plate(-6, -27);
    this.board(
      "03  /  СВЕТЛЯЧКИ\nСосчитай огни. Передай число.",
      -6,
      3,
      -30,
      5,
      1,
    );
    for (let i = 0; i < 5; i++) {
      const x = -8 + i;
      this.box(0.08, 1.8, 0.08, "#746c51", x, 0.9, -29);
      const bulb = this.mesh(
        new THREE.SphereGeometry(0.21, 16, 12),
        new THREE.MeshStandardMaterial({
          color: "#aca986",
          emissive: "#ffc96d",
          emissiveIntensity: 0,
        }),
        x,
        1.95,
        -29,
      );
      this.lampMeshes.push(bulb);
    }
    this.board(
      "ОГНИ  →  КОД\n1 → 4    2 → 7    3 → 2\n4 → 9    5 → 5",
      2,
      2.1,
      -25,
      4,
      1.8,
    );
    this.box(4, 1.15, 1, "#8c9778", 2, 0.57, -24.8);
    this.board("Введи код клавишей 1–9", 2, 0.95, -24.21, 3.7, 0.5);
  }
  makeBridge() {
    this.scene.add(this.bridge);
    for (let i = 0; i < 18; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.2, 0.38),
        mat(i % 2 ? "#a69b72" : "#b5a980"),
      );
      plank.position.set(0, 0.04, -36 - i * 0.42);
      plank.castShadow = true;
      plank.receiveShadow = true;
      this.bridge.add(plank);
    }
    for (const x of [-2, 2]) {
      for (let i = 0; i < 5; i++) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 1.1, 0.14),
          mat("#8f8561"),
        );
        post.position.set(x, 0.55, -36 - i * 1.8);
        this.bridge.add(post);
      }
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.1, 7.6),
        mat("#aa9b71"),
      );
      rail.position.set(x, 1, -39.5);
      this.bridge.add(rail);
    }
    this.bridge.visible = false;
    this.board(
      "За ручьём — наш вечер\nЗажгите все три огонька",
      0,
      2,
      -35.4,
      4,
      1,
    );
    this.box(0.15, 1.7, 0.15, "#7a7657", 0, 0.85, -35.5);
  }
  camp() {
    this.box(3.5, 0.25, 0.8, "#93876b", -1, 0.6, -48);
    for (const x of [-2.2, 0.2])
      this.box(0.15, 0.55, 0.6, "#6c7355", x, 0.27, -48);
    this.box(3.5, 0.75, 0.15, "#93876b", -1, 1.05, -48.4);
    const fire = this.mesh(
      new THREE.IcosahedronGeometry(0.45, 1),
      new THREE.MeshStandardMaterial({
        color: "#f2c171",
        emissive: "#ffac3a",
        emissiveIntensity: 2,
      }),
      1,
      0.4,
      -47,
    );
    fire.scale.y = 1.6;
    const glow = new THREE.PointLight("#ffbf61", 6, 10);
    glow.position.set(1, 1, -47);
    this.scene.add(glow);
    this.board("Хорошо, когда вы рядом.", 0, 2.4, -51, 5, 0.9);
  }
  directionSigns() {
    this.box(0.17, 2.8, 0.17, "#766f50", -3, 1.4, 11);
    this.board("←  Лесные знаки", -3, 2.6, 11.15, 3.4, 0.55);
    this.board("Броски  →", -2.7, 1.9, 11.15, 2.8, 0.55);
    this.board("↑  Светлячки", -3, 1.2, 11.15, 3, 0.55);
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
  quality(high: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.6 : 1));
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.resize();
  }
  apply(s: Snapshot, myId: string) {
    this.heldOrb.visible = s.balls.some((b) => b.heldBy === myId);
    this.bridge.visible = solved(s.progress);
    this.basket.position.x = THREE.MathUtils.lerp(
      this.basket.position.x,
      basketX(s.progress.basketLane),
      0.18,
    );
    this.lampMeshes.forEach((m, i) => {
      const on =
        s.lightObserver !== null &&
        i < LIGHT_COUNTS[Math.min(s.progress.lightRound, 2)];
      const material = m.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = s.progress.lights ? 2 : on ? 2.5 : 0;
      material.color.set(on ? "#ffe4a3" : "#a29b78");
    });
    for (const b of s.balls) {
      let mesh = this.balls.get(b.id);
      if (!mesh) {
        mesh = this.mesh(
          new THREE.SphereGeometry(0.23, 20, 12),
          new THREE.MeshStandardMaterial({
            color: "#f7d792",
            emissive: "#d69839",
            emissiveIntensity: 0.3,
          }),
          b.pos.x,
          b.pos.y,
          b.pos.z,
        );
        mesh.castShadow = true;
        this.balls.set(b.id, mesh);
      }
      mesh.position.lerp(new THREE.Vector3(b.pos.x, b.pos.y, b.pos.z), 0.5);
      mesh.visible = b.heldBy !== myId;
    }
    for (const p of s.players) {
      if (p.id === myId) continue;
      let other = this.others.get(p.id);
      if (!other) {
        other = avatar(p.color);
        other.position.set(p.pos.x, p.pos.y - 1.65, p.pos.z);
        this.scene.add(other);
        this.others.set(p.id, other);
      }
      other.visible = p.online;
      const old = other.position.clone();
      other.position.lerp(
        new THREE.Vector3(p.pos.x, p.pos.y - 1.65, p.pos.z),
        0.22,
      );
      other.rotation.y = p.yaw;
      const moving = old.distanceTo(other.position) > 0.005;
      const time = performance.now() / 1000;
      other.userData.feet.forEach(
        (f: THREE.Mesh, i: number) =>
          (f.position.y =
            0.12 + (moving ? Math.sin(time * 10 + i * Math.PI) * 0.08 : 0)),
      );
      other.userData.hands[0].position.set(
        -0.65,
        p.point ? 1.1 : 0.65,
        p.point ? -0.8 : -0.08,
      );
      let line = this.pointLines.get(p.id);
      if (!line) {
        line = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: "#f4d08b",
            transparent: true,
            opacity: 0.55,
          }),
        );
        this.scene.add(line);
        this.pointLines.set(p.id, line);
      }
      line.visible = p.online && p.point;
      if (line.visible) {
        const start = new THREE.Vector3(p.pos.x, p.pos.y - 0.2, p.pos.z);
        const dir = new THREE.Vector3(
          -Math.sin(p.yaw) * Math.cos(p.pitch),
          Math.sin(p.pitch),
          -Math.cos(p.yaw) * Math.cos(p.pitch),
        );
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints([
          start,
          start.clone().addScaledVector(dir, 10),
        ]);
      }
    }
  }
  render(time: number, lobby: boolean) {
    this.wind.value = time;
    this.water.uniforms.time.value = time;
    const dust = this.scene.getObjectByName("dust");
    if (dust) dust.rotation.y = time * 0.01;
    if (lobby) {
      this.camera.position.set(19 + Math.sin(time * 0.08) * 0.3, 5.2, 29);
      this.camera.lookAt(0, 1.8, 10);
      this.lobbyAvatar.userData.body.position.y =
        0.88 + Math.sin(time * 1.5) * 0.035;
      this.companion.userData.body.position.y =
        0.88 + Math.sin(time * 1.7 + 1) * 0.035;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
