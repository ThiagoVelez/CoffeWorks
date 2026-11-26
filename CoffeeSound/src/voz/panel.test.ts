import { test } from "node:test";
import assert from "node:assert/strict";
import { quedan } from "./tiempo";

test("quedan estima el tiempo restante", () => {
  assert.equal(quedan(0.01, 5000), "");
  assert.equal(quedan(0.5, 1000), "");
  assert.equal(quedan(0.5, 30000), " · menos de 1 min");
  assert.equal(quedan(0.25, 60000), " · quedan ~3 min");
});
