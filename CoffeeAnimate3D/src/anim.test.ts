import { test } from "node:test";
import assert from "node:assert/strict";
import { addAnimation, addPart, copyPose, findAnimation, moveKeyframe, newModel, parseModel, pastePose, samplePose, serializeModel, setKeyframe } from "./model";
import type { Ease, Model3D } from "./types";

function oneTrack(ease: Ease): [Model3D, string, string] {
  let m = newModel(); let p: string, a: string;
  [m, p] = addPart(m, { name: "A", box: { from: [0, 0, 0], size: [1, 1, 1] } });
  [m, a] = addAnimation(m, "X", 1, false);
  m = setKeyframe(m, a, p, 0, { pos: [0, 0, 0], ease });
  m = setKeyframe(m, a, p, 1, { pos: [10, 0, 0] });
  return [m, a, p];
}

test("ease-in empieza lento y ease-out termina lento", () => {
  const [mi, ai, pi] = oneTrack("ease-in");
  const [mo, ao, po] = oneTrack("ease-out");
  assert.ok(samplePose(mi, ai, 0.5).get(pi)!.pos[0] < 5);
  assert.ok(samplePose(mo, ao, 0.5).get(po)!.pos[0] > 5);
  const back = parseModel(serializeModel(mi));
  assert.equal(findAnimation(back, ai).tracks[pi][0].ease, "ease-in");
});

test("moveKeyframe cambia el tiempo y un valor", () => {
  const [m, a, p] = oneTrack("linear");
  let n = moveKeyframe(m, a, p, 1, { t: 0.75 });
  assert.deepEqual(findAnimation(n, a).tracks[p].map((k) => k.t), [0, 0.75]);
  n = moveKeyframe(n, a, p, 0.75, { channel: { kind: "pos", axis: 1, value: 4 } });
  assert.deepEqual(findAnimation(n, a).tracks[p][1].pos, [10, 4, 0]);
  n = moveKeyframe(n, a, p, 0.75, { t: 5 });
  assert.equal(findAnimation(n, a).tracks[p][1].t, 1, "limitado a la duración");
});

test("moveKeyframe sobre otra clave las fusiona", () => {
  const [m, a, p] = oneTrack("linear");
  const n = moveKeyframe(m, a, p, 1, { t: 0 });
  const keys = findAnimation(n, a).tracks[p];
  assert.equal(keys.length, 1);
  assert.deepEqual(keys[0].pos, [10, 0, 0], "gana la clave movida");
});

test("copiar y pegar una pose en otro instante", () => {
  let m = newModel(); let p: string, a: string;
  [m, p] = addPart(m, { name: "brazo izquierdo" });
  [m, a] = addAnimation(m, "X", 1);
  m = setKeyframe(m, a, p, 0, { rot: [30, 5, 10] });
  const clip = copyPose(m, a, 0, [p]);
  const r = pastePose(m, a, 0.5, clip, false, "smooth");
  assert.equal(r.pasted, 1);
  assert.deepEqual(samplePose(r.model, a, 0.5).get(p)!.rot, [30, 5, 10]);
});

test("pegar reflejada va a la pareja con ejes negados y salta lo que no tiene pareja", () => {
  let m = newModel(); let l: string, r: string, c: string, a: string;
  [m, l] = addPart(m, { name: "brazo izquierdo" });
  [m, r] = addPart(m, { name: "brazo derecho" });
  [m, c] = addPart(m, { name: "ala izquierda" });
  [m, a] = addAnimation(m, "X", 1);
  m = setKeyframe(m, a, l, 0, { pos: [2, 1, 3], rot: [30, 5, 10] });
  m = setKeyframe(m, a, c, 0, { rot: [0, 0, 45] });
  const res = pastePose(m, a, 0.5, copyPose(m, a, 0, [l, c]), true, "linear");
  assert.equal(res.pasted, 1);
  assert.deepEqual(res.skipped, ["ala izquierda"]);
  const pose = samplePose(res.model, a, 0.5).get(r)!;
  assert.deepEqual(pose.pos, [-2, 1, 3]);
  assert.deepEqual(pose.rot, [30, -5, -10]);
});
