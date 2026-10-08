import { addScenery, addSky, groundMaterial } from "./scenery";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { LOGS, ROCKS, RUINS, clearSegment } from "../shared/level";
import { panelTexture, drawSymbol } from "./pictograms";
import * as THREE from "three";
import { avatar, animateAvatar, paintAvatar } from "./avatar";
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
  composer: EffectComposer;
  lobbyAvatar = avatar("#f3bf70");
  companion = avatar("#a6c7a1");
  selfAvatar = avatar("#f3bf70", true);
  clueTiles: THREE.Mesh[] = [];
  interactables: THREE.Object3D[] = [];
  raycaster = new THREE.Raycaster();
  lastSelfPosition = new THREE.Vector3();
  moveBlend = 0;
  highQuality = true;
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
    this.renderer.toneMappingExposure = 1.02;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        0.16,
        0.45,
        1.12,
      ),
    );
    this.composer.addPass(new OutputPass());
    this.scene.add(this.camera, this.selfAvatar);
    this.selfAvatar.visible = false;

    this.scene.background = new THREE.Color("#c9d8c7");
    this.scene.fog = new THREE.FogExp2("#c9d8c7", 0.009);
    this.scene.add(new THREE.HemisphereLight("#cce7f1", "#777453", 1.2));
    this.sun = new THREE.DirectionalLight("#fff0cb", 2.6);
    this.sun.position.set(32, 38, -28);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -28,
      right: 28,
      top: 28,
      bottom: -28,
      near: 1,
      far: 130,
    });
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    addSky(this.scene);
    const groundMat = groundMaterial();
    for (const [z, depth] of [
      [14.5, 101],
      [-54, 22],
    ]) {
      const ground = this.mesh(
        new THREE.PlaneGeometry(130, depth),
        groundMat,
        0,
        -0.03,
        z,
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
    }
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
    addScenery(this.scene, this.wind);
    this.water = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new THREE.Color("#3d817c") },
        shallow: { value: new THREE.Color("#91c4a5") },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vWorld; uniform float time; void main(){vUv=uv;vec3 p=position;p.z+=sin(p.x*.8+time)*.035+cos(p.y*1.4+time*.7)*.025;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec2 vUv;varying vec3 vWorld;uniform float time;uniform vec3 deep;uniform vec3 shallow;
      void main(){
        vec2 p=vWorld.xz;float wave=sin(p.x*1.7+p.y*3.+time*1.2)*.5+sin(p.x*.7-p.y*2.1+time*.8)*.5;
        vec3 normal=normalize(vec3(cos(p.x*1.7+p.y*3.+time*1.2)*.10,1.,sin(p.y*2.1-p.x*.7-time*.8)*.10));
        vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(view,normal),0.),3.);
        vec3 reflected=reflect(-view,normal);float sparkle=pow(max(dot(reflected,normalize(vec3(24.,34.,-20.))),0.),130.);
        float bank=smoothstep(2.6,3.48,abs(p.y+39.5)+wave*.08);
        vec3 col=mix(deep,shallow,.38+bank*.48+wave*.045);
        col=mix(col,vec3(.60,.76,.77),fresnel*.65);col+=vec3(1.,.88,.63)*sparkle*.8;
        col=mix(col,vec3(.82,.88,.72),bank*.28*max(0.,wave));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
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
  panel(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    action?: unknown,
  ) {
    const board = this.box(width, height, 0.14, "#75654e", x, y, z);
    const texture = panelTexture(width, height, draw);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.04, height - 0.04),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.86,
        emissiveMap: texture,
        emissive: "#ffffff",
        emissiveIntensity: 0.1,
      }),
    );
    face.position.z = 0.076;
    board.add(face);
    board.userData.puzzle = true;
    if (action) {
      board.userData.action = action;
      this.interactables.push(board);
    }
    return board;
  }
  symbolPanel(
    id: number,
    x: number,
    y: number,
    z: number,
    size: number,
    action?: unknown,
  ) {
    return this.panel(
      x,
      y,
      z,
      size,
      size,
      (ctx, w, h) => drawSymbol(ctx, id, w / 2, h / 2, w * 0.72),
      action,
    );
  }
  targetInteraction() {
    this.raycaster.setFromCamera(new THREE.Vector2(), this.camera);
    this.raycaster.far = 4;
    const hits = this.raycaster.intersectObjects(this.interactables, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.action) object = object.parent;
      if (!object || !object.visible) continue;
      const end = hit.point.clone().lerp(this.camera.position, 0.035);
      if (clearSegment(this.camera.position, end, 0.005))
        return object.userData.action;
    }
    return null;
  }
  pineGeometry() {
    const g = new THREE.ConeGeometry(1, 1, 16, 5);
    const positions = g.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i),
        angle = Math.atan2(z, x);
      const ripple =
        1 + Math.sin(angle * 5 + y * 5) * 0.08 + Math.cos(angle * 9) * 0.045;
      positions.setXYZ(
        i,
        x * ripple,
        y - Math.sin(angle * 5) * 0.025 * (0.5 - y),
        z * ripple,
      );
    }
    g.computeVertexNormals();
    return g;
  }
  trees() {
    const trunkMat = mat("#766c51");
    const leafMat = mat("#d2dfb9");
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
      this.pineGeometry(),
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
            0.22 + (i % 6) * 0.008,
            0.22 + (i % 3) * 0.04,
            0.34 + (i % 7) * 0.025,
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
    const grassMat = mat("#9fb875");
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = this.wind;
      shader.vertexShader = "uniform float uWind;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed.x += sin(uWind*1.2+position.y*3.)*.09*max(position.y,0.);",
      );
    };
    const grass = new THREE.InstancedMesh(geo, grassMat, 2400);
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
    for (const [i, p] of ROCKS.entries()) {
      const rock = this.mesh(
        new THREE.DodecahedronGeometry(p.r, 1),
        rockMat,
        p.x,
        p.r * 0.32,
        p.z,
      );
      rock.scale.set(1.3, 0.7, 1);
      rock.rotation.y = i;
      rock.castShadow = true;
      rock.receiveShadow = true;
      const moss = this.mesh(
        new THREE.SphereGeometry(
          p.r * 0.8,
          10,
          5,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        ),
        mat("#617b49"),
        p.x,
        p.r * 0.53,
        p.z,
      );
      moss.scale.set(1.1, 0.22, 0.8);
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
    for (const { x, z } of LOGS) {
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

    this.plate(-20, -8);

    for (let i = 0; i < 3; i++) {
      const b = this.symbolPanel(
        SIGN_SEQUENCE[i],
        -21.2 + i * 1.2,
        1.9,
        -12.15,
        1.02,
      );
      this.clueTiles.push(b);
    }
    for (let i = 0; i < 4; i++) {
      const b = this.symbolPanel(i, -16.5 + i * 1.05, 1.2, -4, 0.92, {
        kind: "symbol",
        value: i,
      });
      this.box(0.13, 1, 0.13, "#776c4b", b.position.x, 0.5, -4);
      this.signTiles.push(b);
    }
    const lantern = new THREE.PointLight("#ffd48b", 6, 9, 2);
    lantern.position.set(-20, 3, -8);
    this.scene.add(lantern);
  }
  throwStation() {
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
    lever.userData.action = { kind: "lever" };
    this.interactables.push(lever);
    this.mesh(
      new THREE.SphereGeometry(0.15, 12, 8),
      mat("#cdab75"),
      22.15,
      1.5,
      5,
    );

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

    this.panel(2, 2.1, -25, 3.6, 2.1, (ctx, w, h) => {
      ctx.fillStyle = "#314d45";
      ctx.strokeStyle = "#314d45";
      [4, 7, 2, 9, 5].forEach((code, row) => {
        const y = (h * (row + 0.5)) / 5;
        for (let i = 0; i <= row; i++) {
          ctx.beginPath();
          ctx.arc(w * 0.12 + i * w * 0.09, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.font = `${h * 0.12}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("→", w * 0.7, y);
        ctx.fillText(String(code), w * 0.86, y);
      });
    });
    this.box(4, 1.15, 1, "#8c9778", 2, 0.57, -24.8);
    for (let i = 1; i <= 9; i++)
      this.panel(
        0.35 + (i - 1) * 0.41,
        0.85,
        -24.22,
        0.37,
        0.42,
        (ctx, w, h) => {
          ctx.font = `${h * 0.68}px sans-serif`;
          ctx.fillStyle = "#314d45";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(i), w / 2, h / 2);
        },
        { kind: "number", value: i },
      );
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
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }
  quality(high: boolean) {
    this.highQuality = high;
    this.composer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.6 : 1));
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.6 : 1));
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.resize();
  }
  apply(s: Snapshot, myId: string) {
    this.selfAvatar.visible = true;
    const me = s.players.find((p) => p.id === myId);
    if (me) {
      paintAvatar(this.selfAvatar, me.color);
      const current = this.camera.position.clone();
      const moving = Math.min(
        1,
        current.distanceTo(this.lastSelfPosition) * 18,
      );
      this.moveBlend = THREE.MathUtils.lerp(this.moveBlend, moving, 0.15);
      this.lastSelfPosition.copy(current);
      this.selfAvatar.position
        .copy(current)
        .add(new THREE.Vector3(0, -1.65, 0));
      this.selfAvatar.rotation.y = me.yaw;
      this.selfAvatar.updateMatrixWorld(true);
      const held = s.balls.find((b) => b.heldBy === myId);
      const target = held
        ? this.selfAvatar.worldToLocal(
            new THREE.Vector3(held.pos.x, held.pos.y, held.pos.z),
          )
        : undefined;
      animateAvatar(
        this.selfAvatar,
        performance.now() / 1000,
        this.moveBlend,
        target,
        me.point,
        me.pitch,
      );
    }
    this.clueTiles.forEach((m) => (m.visible = s.signObserver !== null));
    this.signTiles.forEach((m, i) => {
      (m.material as THREE.MeshStandardMaterial).color.set(
        s.progress.signs
          ? "#a6bc70"
          : i === s.progress.signIndex
            ? "#bda477"
            : "#75654e",
      );
    });
    this.bridge.visible = solved(s.progress);
    this.basket.position.x = basketX(s.progress.basketLane);
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
            color: "#fff1cc",
            emissive: "#f7b947",
            emissiveIntensity: 0.55,
          }),
          b.pos.x,
          b.pos.y,
          b.pos.z,
        );
        mesh.castShadow = true;
        const seamMat = mat("#ab7e3e");
        for (let i = 0; i < 3; i++) {
          const seam = new THREE.Mesh(
            new THREE.TorusGeometry(0.231, 0.006, 4, 32),
            seamMat,
          );
          seam.rotation.set(
            i === 1 ? Math.PI / 2 : 0,
            i === 2 ? Math.PI / 2 : 0,
            0,
          );
          mesh.add(seam);
        }
        this.balls.set(b.id, mesh);
        mesh.userData.action = { kind: "pickup", id: b.id };
        this.interactables.push(mesh);
      }
      mesh.position.lerp(new THREE.Vector3(b.pos.x, b.pos.y, b.pos.z), 0.5);
      if (b.rotation)
        mesh.quaternion.slerp(
          new THREE.Quaternion(
            b.rotation.x,
            b.rotation.y,
            b.rotation.z,
            b.rotation.w,
          ),
          0.5,
        );
      mesh.visible = true;
      if (b.heldBy === myId) mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
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
      const held = s.balls.find((b) => b.heldBy === p.id);
      other.updateMatrixWorld(true);
      const target = held
        ? other.worldToLocal(
            new THREE.Vector3(held.pos.x, held.pos.y, held.pos.z),
          )
        : undefined;
      animateAvatar(other, time, moving ? 1 : 0, target, p.point, p.pitch);
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
    const center = this.camera.position;
    const x = Math.round(center.x * 16) / 16,
      z = Math.round(center.z * 16) / 16;
    this.sun.position.set(x + 24, 34, z - 20);
    this.sun.target.position.set(x, 0, z);
    if (this.highQuality) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
