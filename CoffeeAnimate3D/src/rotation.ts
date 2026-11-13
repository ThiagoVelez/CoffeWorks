// Giros con cuaterniones, sin three.js, con el mismo orden de Euler que el visor (XYZ):
// para componer giros de varias piezas sin los errores de sumar ángulos.

import type { Vec3 } from "./types";

export type Quat = [number, number, number, number]; // x, y, z, w

const DEG = Math.PI / 180;

export function quatFromAxisAngle(axis: Vec3, deg: number): Quat {
  const len = Math.hypot(...axis) || 1;
  const h = (deg * DEG) / 2;
  const s = Math.sin(h) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}

/** Euler XYZ en grados → cuaternión (como THREE.Quaternion.setFromEuler con orden XYZ). */
export function quatFromEuler(e: Vec3): Quat {
  const [c1, c2, c3] = e.map((v) => Math.cos((v * DEG) / 2));
  const [s1, s2, s3] = e.map((v) => Math.sin((v * DEG) / 2));
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz];
}

function matrix(q: Quat): number[] {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}

/** Cuaternión → Euler XYZ en grados (como THREE.Euler.setFromRotationMatrix con orden XYZ). */
export function eulerFromQuat(q: Quat): Vec3 {
  const [m11, m12, m13, , m22, m23, , m32, m33] = matrix(q);
  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  const [x, z] = Math.abs(m13) < 0.9999999 ? [Math.atan2(-m23, m33), Math.atan2(-m12, m11)] : [Math.atan2(m32, m22), 0];
  return [x / DEG, y / DEG, z / DEG];
}

export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const m = matrix(q);
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** Aplica un giro Euler XYZ (grados) a un vector. */
export function applyEuler(e: Vec3, v: Vec3): Vec3 {
  return rotateVec(quatFromEuler(e), v);
}
