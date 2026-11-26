import { test } from "node:test";
import assert from "node:assert/strict";
import { agregar, actualizar, crearTablero, listar, type Elemento } from "../board/model";
import { entradas } from "../board/history";
import { PALETA } from "../board/personas";
import { crearRedMemoria } from "./transporteMemoria";
import { SesionAnfitrion, SesionInvitado } from "./sesion";
import { codificar, TIPO } from "./protocolo";

const esperar = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const nota = (id: string, texto = ""): Elemento => ({ id, kind: "nota", x: 0, y: 0, w: 100, h: 100, z: 1, autor: "?", color: "amarillo", texto });
const SALA = { sala: "s".repeat(22), clave: "k".repeat(22) };

function montar(n: number) {
  const red = crearRedMemoria("A");
  const docA = crearTablero();
  const anfitrion = new SesionAnfitrion(docA, red.transporte("A"), { id: "A", nombre: "Ana", color: PALETA[0] }, SALA);
  const invitados = Array.from({ length: n }, (_, i) => {
    const doc = crearTablero();
    const id = `I${i}`;
    const s = new SesionInvitado(doc, red.transporte(id), { nombre: `Inv${i}`, color: PALETA[1] });
    return { id, doc, s };
  });
  return { red, docA, anfitrion, invitados };
}

test("invitado recibe el tablero al entrar", async () => {
  const red = crearRedMemoria("A");
  const docA = crearTablero();
  for (const id of ["n1", "n2", "n3"]) agregar(docA, nota(id), "A");
  const anfitrion = new SesionAnfitrion(docA, red.transporte("A"), { id: "A", nombre: "Ana", color: PALETA[0] }, SALA);
  const docB = crearTablero();
  const b = new SesionInvitado(docB, red.transporte("B"), { nombre: "Beto", color: PALETA[2] });
  await esperar();
  assert.equal(listar(docB).length, 3);
  assert.deepEqual(b.personas().map((p) => p.nombre).sort(), ["Ana", "Beto"]);
  anfitrion.cerrar();
});

test("ediciones simultáneas", async () => {
  const { docA, anfitrion, invitados: [b, c] } = montar(2);
  agregar(docA, nota("x", "hola"), "A");
  await esperar();
  actualizar(b.doc, "x", { texto: "Ideas" }, "local");
  actualizar(c.doc, "x", { x: 300 }, "local");
  agregar(b.doc, nota("b1"), "local");
  agregar(c.doc, nota("c1"), "local");
  await esperar(40);
  for (const d of [docA, b.doc, c.doc]) {
    const els = listar(d);
    assert.deepEqual(els.map((e) => e.id).sort(), ["b1", "c1", "x"]);
    const x = els.find((e) => e.id === "x")!;
    assert.equal(x.kind === "nota" && x.texto, "Ideas");
    assert.equal(x.x, 300);
  }
  anfitrion.cerrar();
});

test("nombre lo pone el anfitrión", async () => {
  const { docA, anfitrion, invitados: [b] } = montar(1);
  await esperar();
  agregar(b.doc, { ...nota("n", "Ideas"), autor: "A" }, "local");
  await esperar();
  const e = entradas(docA).find((x) => x.accion === "agrego");
  assert.ok(e);
  assert.equal(e.personaId, b.id);
  assert.equal(e.detalle, "Ideas");
  anfitrion.cerrar();
});

test("colores sin repetir", async () => {
  const { anfitrion } = montar(2);
  await esperar();
  const colores = anfitrion.personas().map((p) => p.color);
  assert.equal(new Set(colores).size, colores.length);
  anfitrion.cerrar();
});

test("lleno a los 10", async () => {
  const { anfitrion, invitados } = montar(10);
  const fines: string[] = [];
  invitados.forEach((i) => i.s.alFin((m) => fines.push(`${i.id}:${m}`)));
  await esperar(60);
  assert.equal(anfitrion.personas().length, 10);
  assert.deepEqual(fines, ["I9:lleno"]);
  anfitrion.cerrar();
});

test("expulsar rota el link", async () => {
  const { red, anfitrion, invitados: [b, c] } = montar(2);
  const finB: string[] = [];
  b.s.alFin((m) => finB.push(m));
  await esperar();
  const nueva = await anfitrion.expulsar(b.id);
  await esperar();
  assert.deepEqual(finB, ["expulsado"]);
  assert.notEqual(nueva.sala, SALA.sala);
  assert.deepEqual(red.salasDe("A").at(-1), nueva);
  assert.deepEqual(c.s.link(), nueva);
  assert.ok(entradas(anfitrion.doc).some((e) => e.accion === "expulsado" && e.personaId === b.id));
  agregar(anfitrion.doc, nota("despues"), "A");
  await esperar();
  assert.ok(listar(c.doc).some((e) => e.id === "despues"));
  assert.ok(!listar(b.doc).some((e) => e.id === "despues"));
  anfitrion.cerrar();
});

test("anfitrión se va", async () => {
  const { anfitrion, invitados: [b] } = montar(1);
  const fin: string[] = [];
  b.s.alFin((m) => fin.push(m));
  await esperar();
  anfitrion.cerrar();
  await esperar();
  assert.deepEqual(fin, ["cerrado"]);
  assert.equal(b.s.activa, false);
});

test("invitado ignora a otros invitados", async () => {
  const { red, anfitrion, invitados: [b, c] } = montar(2);
  await esperar();
  const intruso = crearTablero();
  agregar(intruso, nota("falso"), "x");
  const Y = await import("yjs");
  const update = Y.encodeStateAsUpdate(intruso);
  const enc = await import("lib0/encoding");
  const sync = await import("y-protocols/sync");
  const e = enc.createEncoder();
  sync.writeUpdate(e, update);
  red.enviarComo(b.id, c.id, codificar(TIPO.SYNC, enc.toUint8Array(e)));
  await esperar();
  assert.ok(!listar(c.doc).some((x) => x.id === "falso"));
  anfitrion.cerrar();
});

test("bytes basura no rompen", async () => {
  const { red, anfitrion, invitados: [b] } = montar(1);
  await esperar();
  red.enviarComo(b.id, "A", new Uint8Array([255, 1, 2]));
  red.enviarComo(b.id, "A", new Uint8Array([TIPO.SYNC, 9, 9, 9]));
  red.enviarComo("A", b.id, new Uint8Array([TIPO.ROSTER, 123]));
  await esperar();
  assert.equal(anfitrion.personas().length, 2);
  anfitrion.cerrar();
});

test("presencia limitada a 20 por segundo", async () => {
  let ahora = 0;
  const red = crearRedMemoria("A");
  const docA = crearTablero();
  const anfitrion = new SesionAnfitrion(docA, red.transporte("A"), { id: "A", nombre: "Ana", color: PALETA[0] }, SALA, { ahora: () => ahora });
  new SesionInvitado(crearTablero(), red.transporte("B"), { nombre: "Beto", color: PALETA[2] });
  await esperar();
  const antes = red.enviados("A", TIPO.PRESENCIA);
  for (let i = 0; i < 100; i++) {
    ahora = i * 10;
    anfitrion.presencia({ x: i, y: i, seleccion: [] });
  }
  assert.ok(red.enviados("A", TIPO.PRESENCIA) - antes <= 20);
  anfitrion.cerrar();
});

test("el invitado ve el cursor del anfitrión", async () => {
  const { anfitrion, invitados: [b] } = montar(1);
  await esperar();
  anfitrion.presencia({ x: 5, y: 7, seleccion: ["n"] });
  await esperar(80);
  assert.deepEqual(b.s.presenciaDe("A"), { x: 5, y: 7, seleccion: ["n"] });
  anfitrion.cerrar();
});

import { historialDe, metaDe } from "../board/model";
import { registrar } from "../board/history";

test("un invitado no puede escribir el historial ni cambiar nombres", async () => {
  const { docA, anfitrion, invitados: [b, c] } = montar(2);
  await esperar();
  const antes = historialDe(docA).length;
  // Cliente modificado: escribe historial falso y renombra al anfitrión
  registrar(b.doc, { personaId: "A", accion: "borro", kind: "nota", t: 1 });
  metaDe(b.doc).set("personas", { A: { nombre: "Tramposo", color: "#000000" } });
  metaDe(b.doc).set("nombre", "Hackeado");
  await esperar(60);
  assert.equal(historialDe(docA).length, antes);
  assert.equal((metaDe(docA).get("personas") as Record<string, { nombre: string }>).A.nombre, "Ana");
  assert.notEqual(metaDe(docA).get("nombre"), "Hackeado");
  assert.ok(!entradas(c.doc).some((e) => e.accion === "borro"));
  anfitrion.cerrar();
});

test("el invitado edita texto y el historial lo registra como edición", async () => {
  const { docA, anfitrion, invitados: [b] } = montar(1);
  agregar(docA, nota("x", "hola"), "A");
  await esperar();
  actualizar(b.doc, "x", { texto: "hola Sofía" }, "local");
  await esperar();
  const e = entradas(docA).find((x) => x.elementoId === "x" && x.personaId === b.id);
  assert.equal(e?.accion, "edito");
  assert.equal(e?.detalle, "hola Sofía");
  anfitrion.cerrar();
});

test("un expulsado no vuelve a entrar con un HOLA nuevo", async () => {
  const { red, anfitrion, invitados: [b] } = montar(1);
  await esperar();
  await anfitrion.expulsar(b.id);
  red.enviarComo(b.id, "A", codificar(TIPO.HOLA, { nombre: "Otra vez", color: PALETA[3] }));
  await esperar();
  assert.equal(anfitrion.personas().length, 1);
  anfitrion.cerrar();
});

test("si no se puede cambiar el link, expulsar avisa con un error", async () => {
  const { red, anfitrion, invitados: [b] } = montar(1);
  await esperar();
  red.fallarCambioDeSala("A");
  await assert.rejects(anfitrion.expulsar(b.id), /link/);
  assert.equal(anfitrion.personas().length, 1);
  anfitrion.cerrar();
});
