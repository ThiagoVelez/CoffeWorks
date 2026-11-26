import { test } from "node:test";
import assert from "node:assert/strict";
import { crearCola } from "./cola";

test("la cola ejecuta en orden aunque cada tarea tarde distinto", async () => {
  const hechos: number[] = [];
  const cola = crearCola();
  const tardanzas = [30, 1, 15, 0];
  await Promise.all(tardanzas.map((ms, i) => cola(() => new Promise<void>((r) => setTimeout(() => { hechos.push(i); r(); }, ms)))));
  assert.deepEqual(hechos, [0, 1, 2, 3]);
});

test("un error no detiene la cola", async () => {
  const hechos: string[] = [];
  const cola = crearCola();
  const p1 = cola(async () => { throw new Error("x"); });
  const p2 = cola(async () => { hechos.push("sigue"); });
  await assert.rejects(p1);
  await p2;
  assert.deepEqual(hechos, ["sigue"]);
});
