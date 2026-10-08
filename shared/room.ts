import { SOLIDS, clearSegment } from "./level.ts";
import { CHARGE_SECONDS, handTarget } from "./holding.ts";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  COLORS,
  SPAWN,
  STATIONS,
  SIGN_SEQUENCE,
  LIGHT_COUNTS,
  LIGHT_CODES,
  distance,
  initialProgress,
  basketX,
  canOccupy,
  solved,
  type Player,
  type Ball,
  type Snapshot,
  type V3,
} from "./game.ts";
type Seat = {
  player: Player;
  token: string;
  lastMove: number;
  lastAction: number;
  charging: boolean;
};
type PhysicsBall = Ball & {
  body: RAPIER.RigidBody;
  thrownBy: string | null;
  age: number;
  previousY: number;
};
export class Room {
  seats: Seat[] = [];
  progress = initialProgress();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  balls: PhysicsBall[] = [];
  lastActive = Date.now();
  basketBody: RAPIER.RigidBody;
  bridgeCollider: RAPIER.Collider;
  playerBodies = new Map<string, RAPIER.RigidBody>();
  soloNotes = { signs: false, lightRound: -1, lightCount: 0 };
  constructor(
    public code: string,
    public readonly solo = false,
  ) {
    this.world.timestep = 1 / 30;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(65, 0.1, 50.5).setTranslation(0, -0.1, 14.5),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(65, 0.1, 11).setTranslation(0, -0.1, -54),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(65, 0.1, 3.5).setTranslation(0, -1.2, -39.5),
    );
    this.bridgeCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2.2, 0.1, 3.8).setTranslation(0, 0.04, -39.5),
    );
    this.bridgeCollider.setEnabled(false);
    for (const s of SOLIDS) {
      const desc =
        s.kind === "cylinder"
          ? RAPIER.ColliderDesc.cylinder(s.h / 2, Math.max(s.w, s.d) / 2)
          : RAPIER.ColliderDesc.cuboid(s.w / 2, s.h / 2, s.d / 2);
      desc.setTranslation(s.x, s.y, s.z).setFriction(0.72).setRestitution(0.22);
      if (s.rotation)
        desc.setRotation({
          x: 0,
          y: Math.sin(s.rotation / 2),
          z: 0,
          w: Math.cos(s.rotation / 2),
        });
      this.world.createCollider(desc);
    }
    this.basketBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(17, 0, -2),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.05, 0.85).setTranslation(0, 0.67, 0),
      this.basketBody,
    );
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(0.075)
          .setTranslation(Math.cos(a), 1.45, Math.sin(a))
          .setRestitution(0.4),
        this.basketBody,
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.035, 0.375, 0.035).setTranslation(
          Math.cos(a) * 0.91,
          1.04,
          Math.sin(a) * 0.91,
        ),
        this.basketBody,
      );
    }
    for (let id = 0; id < 3; id++) {
      const pos = { x: 14 + id * 0.8, y: 0.49, z: 8 };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(pos.x, pos.y, pos.z)
          .setCcdEnabled(true)
          .setLinearDamping(0.08)
          .setAngularDamping(0.35),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.ball(0.23).setRestitution(0.45).setFriction(0.7),
        body,
      );
      this.balls.push({
        id,
        pos,
        body,
        heldBy: null,
        thrownBy: null,
        age: 0,
        previousY: 0.49,
      });
    }
  }
  join(name: string, color: string, token?: string) {
    let seat = token ? this.seats.find((x) => x.token === token) : undefined;
    if (token && !seat)
      throw Error(
        "Приглашение сохранено, но место восстановить не удалось. Войдите заново.",
      );
    if (!seat) {
      if (this.seats.length >= 2)
        throw Error("В этой комнате уже двое. Создайте новую прогулку.");
      seat = {
        player: {
          id: crypto.randomUUID(),
          name:
            String(name || "Путник")
              .trim()
              .slice(0, 20) || "Путник",
          color: COLORS.includes(color) ? color : COLORS[0],
          pos: { ...SPAWN, x: this.seats.length * 2 },
          yaw: 0,
          pitch: 0,
          point: false,
          online: true,
          charge: 0,
        },
        token: Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        lastMove: Date.now(),
        lastAction: 0,
        charging: false,
      };
      this.seats.push(seat);
      const p = seat.player.pos;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          p.x,
          p.y - 0.83,
          p.z,
        ),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.capsule(0.48, 0.31).setFriction(0.6),
        body,
      );
      this.playerBodies.set(seat.player.id, body);
    }
    seat.player.online = true;
    seat.lastMove = Date.now();
    this.lastActive = Date.now();
    return seat;
  }
  disconnect(id: string) {
    const s = this.seats.find((x) => x.player.id === id);
    if (s) {
      s.player.online = false;
      s.charging = false;
      s.player.charge = 0;
    }
    if (this.progress.operator === id) this.progress.operator = null;
    for (const ball of this.balls) if (ball.heldBy === id) this.resetBall(ball);
    this.lastActive = Date.now();
  }
  observer(which: "signPlate" | "lightPlate") {
    return (
      this.seats.find(
        (s) => s.player.online && distance(s.player.pos, STATIONS[which]) < 1.6,
      )?.player.id ?? null
    );
  }
  move(id: string, data: any) {
    const seat = this.seats.find((s) => s.player.id === id);
    if (!seat) return false;
    const { pos, yaw, pitch } = data;
    if (!pos || ![pos.x, pos.y, pos.z, yaw, pitch].every(Number.isFinite))
      return false;
    const elapsed = Math.min((Date.now() - seat.lastMove) / 1000, 0.5);
    const prev = seat.player.pos;
    const d = distance(prev, pos);
    if (d > 8 * elapsed + 0.8 || pos.y < 1.5 || pos.y > 4) return false;
    const steps = Math.max(1, Math.ceil(d / 0.2));
    for (let i = 1; i <= steps; i++) {
      if (
        !canOccupy(
          prev.x + ((pos.x - prev.x) * i) / steps,
          prev.z,
          this.progress,
          prev.y + ((pos.y - prev.y) * i) / steps,
        )
      )
        return false;
      if (
        !canOccupy(
          pos.x,
          prev.z + ((pos.z - prev.z) * i) / steps,
          this.progress,
          prev.y + ((pos.y - prev.y) * i) / steps,
        )
      )
        return false;
    }
    seat.player.pos = { x: pos.x, y: pos.y, z: pos.z };
    seat.player.yaw = yaw;
    seat.player.pitch = Math.max(-1.4, Math.min(1.4, pitch));
    seat.player.point = data.point === true;
    seat.lastMove = Date.now();
    return true;
  }
  action(id: string, a: any) {
    const s = this.seats.find((s) => s.player.id === id && s.player.online);
    if (!s || !a) return;
    const p = s.player;
    const near = (name: keyof typeof STATIONS) =>
      distance(p.pos, STATIONS[name]) < 3.7;
    if (a.kind === "symbol" && near("signPanel") && !this.progress.signs) {
      const ob = this.observer("signPlate");
      if (this.solo ? !this.soloNotes.signs : !ob || ob === id) {
        this.progress.notice = this.solo
          ? "Сначала встаньте на круг внутри домика: рисунки сохранятся в заметке."
          : "Попросите друга встать на плиту внутри домика.";
        return;
      }
      if (!Number.isInteger(a.value) || a.value < 0 || a.value > 3) return;
      if (a.value === SIGN_SEQUENCE[this.progress.signIndex])
        this.progress.signIndex++;
      else {
        this.progress.signIndex = 0;
        this.progress.notice =
          "Другой узор. Попробуйте снова, начиная с первого знака.";
      }
      if (this.progress.signIndex === 3) {
        this.progress.signs = true;
        this.progress.notice = "Лесные знаки разгаданы. Первый огонёк ваш!";
      }
    }
    if (a.kind === "number" && near("lightPanel") && !this.progress.lights) {
      const ob = this.observer("lightPlate");
      if (
        this.solo
          ? this.soloNotes.lightRound !== this.progress.lightRound
          : !ob || ob === id
      ) {
        this.progress.notice = this.solo
          ? "Сначала посмотрите на фонари с круга: число сохранится в заметке."
          : "Друг должен стоять на плите у фонарей.";
        return;
      }
      if (a.value === LIGHT_CODES[LIGHT_COUNTS[this.progress.lightRound]]) {
        this.progress.lightRound++;
        this.progress.notice = "Верно! Посмотрите на новую группу огней.";
      } else
        this.progress.notice =
          "Не тот код. Сосчитайте горящие огни и сверьтесь с таблицей.";
      if (this.progress.lightRound === 3) {
        this.progress.lights = true;
        this.progress.notice = "Все светлячки проснулись. Ещё один огонёк!";
      }
    }
    if (a.kind === "lever" && near("lever")) {
      if (this.progress.operator === id) {
        this.progress.operator = null;
        this.progress.notice = "Корзина отпущена.";
      } else if (!this.progress.operator) {
        this.progress.operator = id;
        this.progress.notice = this.solo
          ? "Корзина зафиксирована. Выберите положение стрелками, затем возьмите шар."
          : "Управляйте корзиной: ← →. Друг может бросать шары.";
      }
    }
    if (
      a.kind === "lane" &&
      this.progress.operator === id &&
      near("lever") &&
      [-1, 1].includes(a.value)
    )
      this.progress.basketLane = Math.max(
        0,
        Math.min(2, this.progress.basketLane + a.value),
      );
    if (a.kind === "pickup" && !this.balls.some((b) => b.heldBy === id)) {
      const ball = this.balls.find(
        (b) =>
          !b.heldBy &&
          distance(b.pos, p.pos) < 3 &&
          Math.abs(b.pos.y - p.pos.y) < 3 &&
          (a.id === undefined || b.id === a.id) &&
          clearSegment(p.pos, b.pos, 0.06),
      );
      if (ball) {
        ball.heldBy = id;
        ball.thrownBy = null;
        s.charging = false;
        p.charge = 0;
        ball.body.collider(0).setSensor(true);
        ball.body.setBodyType(
          RAPIER.RigidBodyType.KinematicPositionBased,
          true,
        );
      }
    }
    if (
      a.kind === "charge" &&
      this.balls.some((b) => b.heldBy === id) &&
      !s.charging
    ) {
      s.charging = true;
      p.charge = 0;
    }
    if (a.kind === "cancelThrow") {
      s.charging = false;
      p.charge = 0;
    }
    if (a.kind === "throw" || a.kind === "drop") {
      const ball = this.balls.find((b) => b.heldBy === id),
        dir = a.direction;
      const drop = a.kind === "drop";
      if (!ball) return;
      if (!drop && (!dir || ![dir.x, dir.y, dir.z].every(Number.isFinite)))
        return;
      const len = drop ? 1 : Math.hypot(dir.x, dir.y, dir.z);
      if (len < 0.1 || len > 2) return;
      const direction = drop
        ? { x: 0, y: 0, z: 0 }
        : { x: dir.x / len, y: dir.y / len, z: dir.z / len };
      const speed = drop ? 0 : s.charging ? 4 + 10 * p.charge : 10;
      // Legacy clients still release with their old calibrated speed.
      const origin =
        s.charging || drop
          ? handTarget(p)
          : {
              x: p.pos.x + direction.x * 0.7,
              y: p.pos.y - 0.15,
              z: p.pos.z + direction.z * 0.7,
            };
      if (!clearSegment(p.pos, origin, 0.24)) return;
      ball.heldBy = null;
      ball.thrownBy = drop ? null : id;
      ball.age = 0;
      ball.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      ball.body.collider(0).setSensor(false);
      ball.body.setTranslation(origin, true);
      ball.body.setLinvel(
        {
          x: direction.x * speed,
          y: drop
            ? -0.25
            : direction.y * speed + (s.charging ? 0.7 + 2 * p.charge : 2.8),
          z: direction.z * speed,
        },
        true,
      );
      ball.body.setAngvel(
        { x: -direction.z * speed * 0.35, y: 0, z: direction.x * speed * 0.35 },
        true,
      );
      ball.previousY = origin.y;
      ball.pos = { ...origin };
      s.charging = false;
      p.charge = 0;
    }
  }

  resetBall(b: PhysicsBall) {
    b.heldBy = null;
    b.thrownBy = null;
    b.age = 0;
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.body.collider(0).setSensor(false);
    b.body.setTranslation({ x: 14 + b.id * 0.8, y: 0.49, z: 8 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.pos = { ...b.body.translation() };
  }
  tick() {
    if (this.solo) {
      if (this.observer("signPlate")) this.soloNotes.signs = true;
      if (this.observer("lightPlate") && !this.progress.lights) {
        this.soloNotes.lightRound = this.progress.lightRound;
        this.soloNotes.lightCount = LIGHT_COUNTS[this.progress.lightRound];
      }
    }
    if (this.progress.operator) {
      const op = this.seats.find(
        (s) => s.player.id === this.progress.operator && s.player.online,
      );
      if (!op || (!this.solo && distance(op.player.pos, STATIONS.lever) > 3.7))
        this.progress.operator = null;
    }
    for (const s of this.seats)
      if (s.charging)
        s.player.charge = Math.min(
          1,
          s.player.charge + 1 / (30 * CHARGE_SECONDS),
        );
    for (const s of this.seats) {
      const body = this.playerBodies.get(s.player.id)!;
      body.setEnabled(s.player.online);
      if (s.player.online)
        body.setNextKinematicTranslation({
          x: s.player.pos.x,
          y: s.player.pos.y - 0.83,
          z: s.player.pos.z,
        });
    }
    this.bridgeCollider.setEnabled(solved(this.progress));
    this.basketBody.setNextKinematicTranslation({
      x: basketX(this.progress.basketLane),
      y: 0,
      z: -2,
    });
    for (const b of this.balls)
      if (b.heldBy) {
        const p = this.seats.find((s) => s.player.id === b.heldBy)!.player;
        const target = handTarget(p),
          old = b.body.translation();
        const next = {
          x: old.x + (target.x - old.x) * 0.38,
          y: old.y + (target.y - old.y) * 0.38,
          z: old.z + (target.z - old.z) * 0.38,
        };
        if (!clearSegment(old, target, 0.23)) {
          b.heldBy = null;
          b.thrownBy = null;
          b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
          b.body.collider(0).setSensor(false);
          b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          const seat = this.seats.find((s) => s.player.id === p.id)!;
          seat.charging = false;
          p.charge = 0;
        } else b.body.setNextKinematicTranslation(next);
      }
    this.world.step();
    for (const b of this.balls) {
      b.pos = { ...b.body.translation() };
      if (b.thrownBy) {
        b.age += 1 / 30;
        const caught =
          b.previousY >= 1.45 &&
          b.pos.y < 1.45 &&
          Math.abs(b.pos.x - basketX(this.progress.basketLane)) < 0.95 &&
          Math.abs(b.pos.z + 2) < 0.95;
        if (
          caught &&
          this.progress.operator &&
          (this.solo || this.progress.operator !== b.thrownBy) &&
          !this.progress.throwDone
        ) {
          this.progress.throws++;
          this.progress.notice = `В корзине! ${this.progress.throws} из 3`;
          if (this.progress.throws >= 3) {
            this.progress.throwDone = true;
            this.progress.notice = "Три точных броска — огонёк ваш!";
          }
          this.resetBall(b);
        } else if (
          b.age > 45 ||
          b.pos.y < -3 ||
          Math.abs(b.pos.x) > 56 ||
          Math.abs(b.pos.z) > 55
        )
          this.resetBall(b);
      }
      if (!b.heldBy && b.pos.y < -0.5 && b.pos.z < -36 && b.pos.z > -43)
        this.resetBall(b);
      b.previousY = b.pos.y;
    }
  }
  snapshot(): Snapshot {
    return {
      code: this.code,
      players: this.seats.map((s) => s.player),
      balls: this.balls.map(({ id, pos, heldBy, body }) => ({
        id,
        pos,
        heldBy,
        rotation: { ...body.rotation() },
      })),
      progress: this.progress,
      signObserver: this.observer("signPlate"),
      lightObserver: this.observer("lightPlate"),
      time: Date.now(),
    };
  }
  dispose() {
    this.world.free();
  }
}
