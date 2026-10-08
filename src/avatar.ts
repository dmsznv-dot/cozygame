import * as THREE from "three";
export function avatar(color: string, firstPerson = false) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 20), mat);
  body.scale.set(0.86, 0.98, 0.72);
  body.position.z = firstPerson ? 0.3 : 0;
  if (firstPerson) body.scale.set(0.75, 0.8, 0.52);
  body.position.y = 0.88;
  body.castShadow = true;
  group.add(body);
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 24, 16),
    new THREE.MeshStandardMaterial({ color: "#f7ead0", roughness: 1 }),
  );
  face.scale.set(1, 0.76, 0.3);
  face.position.set(0, 0.99, -0.46);
  group.add(face);
  const ink = new THREE.MeshStandardMaterial({ color: "#354b3b" });
  for (const x of [-0.145, 0.145]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.037, 10, 8), ink);
    eye.scale.y = 1.35;
    eye.position.set(x, 1.025, -0.593);
    group.add(eye);
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.069, 12, 8),
      new THREE.MeshStandardMaterial({ color: "#dda597" }),
    );
    cheek.scale.set(1, 0.55, 0.2);
    cheek.position.set(x * 1.5, 0.935, -0.582);
    group.add(cheek);
  }
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.1, 0.93, -0.6),
    new THREE.Vector3(0, 0.825, -0.62),
    new THREE.Vector3(0.1, 0.93, -0.6),
  );
  group.add(
    new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 5, false), ink),
  );
  const feet = [];
  for (const x of [-0.25, 0.25]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat);
    foot.scale.set(1, 0.58, 1.5);
    foot.position.set(x, 0.12, -0.1);
    foot.castShadow = true;
    group.add(foot);
    feet.push(foot);
  }
  const hands = [];
  for (const x of [-0.65, 0.65]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat);
    hand.position.set(x, 0.65, -0.08);
    hand.castShadow = true;
    group.add(hand);
    hands.push(hand);
  }
  if (firstPerson)
    for (const part of [...group.children])
      if (
        part !== body &&
        !hands.some((h) => h === part) &&
        !feet.some((f) => f === part)
      )
        part.visible = false;
  const arms = [limb(mat, 0.1), limb(mat, 0.1)],
    legs = [limb(mat, 0.11), limb(mat, 0.11)];
  group.add(...arms, ...legs);
  group.userData = { body, mat, hands, feet, arms, legs, firstPerson };
  animateAvatar(group, 0, 0);
  return group;
}
export function paintAvatar(group: THREE.Group, color: string) {
  (group.userData.mat as THREE.MeshStandardMaterial).color.set(color);
}

function limb(mat: THREE.Material, r: number) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 4, 8), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function connect(
  mesh: THREE.Mesh,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
) {
  const direction = b.clone().sub(a);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(0.01, direction.length()) / (1 + r * 2), 1);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
}
export function animateAvatar(
  group: THREE.Group,
  time: number,
  moving: number,
  heldTarget?: THREE.Vector3,
  point = false,
  pitch = 0,
) {
  const { hands, feet, arms, legs, firstPerson } = group.userData;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1,
      wave = Math.sin(time * 8 + i * Math.PI) * moving;
    const hand = hands[i] as THREE.Mesh;
    if (heldTarget)
      hand.position
        .copy(heldTarget)
        .add(new THREE.Vector3(side * 0.17, -0.08, 0.06));
    else if (point && i === 0)
      hand.position.set(
        -0.4,
        1.25 + Math.sin(pitch) * 0.7,
        -0.65 * Math.cos(pitch),
      );
    else if (firstPerson) {
      const down = Math.max(0, Math.min(1, (-pitch - 0.3) / 0.6));
      hand.position.set(
        side * (0.42 + down * 0.09),
        1.2 - down * 0.4 + wave * 0.025,
        -0.8 + down * 0.65 + wave * 0.08,
      );
    } else
      hand.position.set(side * 0.57, 0.79 + wave * 0.07, -0.12 + wave * 0.2);
    const foot = feet[i] as THREE.Mesh;
    foot.position.set(
      side * 0.24,
      0.12 + Math.max(0, wave) * 0.13,
      (firstPerson ? -0.28 : -0.07) - wave * 0.2,
    );
    connect(
      arms[i],
      new THREE.Vector3(side * 0.43, 1.05, 0.02),
      hand.position,
      0.1,
    );
    connect(
      legs[i],
      new THREE.Vector3(side * 0.23, 0.57, 0.02),
      foot.position,
      0.11,
    );
  }
}
