import * as THREE from "three";
export function avatar(color: string) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 20), mat);
  body.scale.set(1, 1.05, 0.85);
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
  group.userData = { body, mat, hands, feet };
  return group;
}
export function paintAvatar(group: THREE.Group, color: string) {
  (group.userData.mat as THREE.MeshStandardMaterial).color.set(color);
}
