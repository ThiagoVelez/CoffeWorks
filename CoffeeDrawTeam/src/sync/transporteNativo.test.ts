import { test } from "node:test";
import assert from "node:assert/strict";
import { crearTransporteNativo, type ApiTauri } from "./transporteNativo";

function apiFalsa() {
  const oyentes = new Map<string, ((e: { payload: unknown }) => void)[]>();
  const llamadas: { cmd: string; args: Record<string, unknown> }[] = [];
  const api: ApiTauri = {
    invoke: async (cmd, args = {}) => { llamadas.push({ cmd, args }); return null as never; },
    listen: async (ev, f) => {
      oyentes.set(ev, [...(oyentes.get(ev) ?? []), f as (e: { payload: unknown }) => void]);
      return () => undefined;
    },
  };
  const emitir = (ev: string, payload: unknown) => (oyentes.get(ev) ?? []).forEach((f) => f({ payload }));
  return { api, emitir, llamadas };
}

const esperar = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test("ignora eventos de una conexión anterior", async () => {
  const { api, emitir, llamadas } = apiFalsa();
  const t = await crearTransporteNativo("invitado", "s", "k", undefined, api);
  const nodo = llamadas[0].args.nodo as string;
  assert.ok(nodo);
  const salidas: string[] = [];
  t.alSalir((p) => salidas.push(p));
  await esperar();
  emitir("red:sale", { nodo: "viejo", peer: "X" });
  emitir("red:sale", { nodo, peer: "Y" });
  await esperar();
  assert.deepEqual(salidas, ["Y"]);
});

test("pasa la llave del anfitrión al unirse", async () => {
  const { api, llamadas } = apiFalsa();
  await crearTransporteNativo("invitado", "s", "k", "LLAVE", api);
  assert.equal(llamadas[0].cmd, "red_unirse");
  assert.equal(llamadas[0].args.llave, "LLAVE");
});
