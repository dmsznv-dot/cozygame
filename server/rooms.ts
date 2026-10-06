import { randomBytes, randomUUID } from "node:crypto";
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
  type Player,
  type Ball,
  type Snapshot,
  type V3,
} from "../shared/game.ts";
type Seat = {
  player: Player;
  token: string;
  lastMove: number;
  lastAction: number;
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
  constructor(public code: string) {
    this.world.timestep = 1 / 30;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(60, 0.1, 60).setTranslation(0, -0.1, 0),
    );
    for (let id = 0; id < 3; id++) {
      const pos = { x: 14 + id * 0.8, y: 0.4, z: 8 };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(pos.x, pos.y, pos.z)
          .setCcdEnabled(true),
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
        previousY: 0.4,
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
          id: randomUUID(),
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
        },
        token: randomBytes(24).toString("hex"),
        lastMove: Date.now(),
        lastAction: 0,
      };
      this.seats.push(seat);
    }
    seat.player.online = true;
    seat.lastMove = Date.now();
    this.lastActive = Date.now();
    return seat;
  }
  disconnect(id: string) {
    const s = this.seats.find((x) => x.player.id === id);
    if (s) s.player.online = false;
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
        )
      )
        return false;
      if (
        !canOccupy(
          pos.x,
          prev.z + ((pos.z - prev.z) * i) / steps,
          this.progress,
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
      if (!ob || ob === id) {
        this.progress.notice = "Попросите друга встать на плиту внутри домика.";
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
      if (!ob || ob === id) {
        this.progress.notice = "Друг должен стоять на плите у фонарей.";
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
        this.progress.notice =
          "Управляйте корзиной: ← →. Друг может бросать шары.";
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
          Math.abs(b.pos.y - p.pos.y) < 3,
      );
      if (ball) {
        ball.heldBy = id;
        ball.thrownBy = null;
        ball.body.setBodyType(
          RAPIER.RigidBodyType.KinematicPositionBased,
          true,
        );
      }
    }
    if (a.kind === "throw") {
      const ball = this.balls.find((b) => b.heldBy === id),
        dir = a.direction;
      if (!ball || !dir || ![dir.x, dir.y, dir.z].every(Number.isFinite))
        return;
      const len = Math.hypot(dir.x, dir.y, dir.z);
      if (len < 0.1 || len > 2) return;
      const direction = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
      ball.heldBy = null;
      ball.thrownBy = id;
      ball.age = 0;
      ball.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      ball.body.setTranslation(
        {
          x: p.pos.x + direction.x * 0.7,
          y: p.pos.y - 0.15,
          z: p.pos.z + direction.z * 0.7,
        },
        true,
      );
      ball.body.setLinvel(
        { x: direction.x * 10, y: direction.y * 10 + 2.8, z: direction.z * 10 },
        true,
      );
      ball.previousY = p.pos.y - 0.15;
    }
  }
  resetBall(b: PhysicsBall) {
    b.heldBy = null;
    b.thrownBy = null;
    b.age = 0;
    b.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    b.body.setTranslation({ x: 14 + b.id * 0.8, y: 0.4, z: 8 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.pos = { ...b.body.translation() };
  }
  tick() {
    if (this.progress.operator) {
      const op = this.seats.find(
        (s) => s.player.id === this.progress.operator && s.player.online,
      );
      if (!op || distance(op.player.pos, STATIONS.lever) > 3.7)
        this.progress.operator = null;
    }
    for (const b of this.balls)
      if (b.heldBy) {
        const p = this.seats.find((s) => s.player.id === b.heldBy)!.player;
        b.body.setNextKinematicTranslation({
          x: p.pos.x - Math.sin(p.yaw) * 0.8,
          y: p.pos.y - 0.4,
          z: p.pos.z - Math.cos(p.yaw) * 0.8,
        });
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
          this.progress.operator !== b.thrownBy &&
          !this.progress.throwDone
        ) {
          this.progress.throws++;
          this.progress.notice = `В корзине! ${this.progress.throws} из 3`;
          if (this.progress.throws >= 3) {
            this.progress.throwDone = true;
            this.progress.notice = "Три точных броска — огонёк ваш!";
          }
          this.resetBall(b);
        } else if (b.age > 9 || b.pos.y < -3) this.resetBall(b);
      }
      b.previousY = b.pos.y;
    }
  }
  snapshot(): Snapshot {
    return {
      code: this.code,
      players: this.seats.map((s) => s.player),
      balls: this.balls.map(({ id, pos, heldBy }) => ({ id, pos, heldBy })),
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
