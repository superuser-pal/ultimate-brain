import assert from "node:assert/strict";
import { test } from "node:test";

import { generateId, ID_ALPHABET } from "../src/lib/ids.ts";

test("generateId emits a prefixed eight-character Crockford ID", () => {
  const id = generateId("dec", new Set());
  assert.match(id, /^dec-[0-9abcdefghjkmnpqrstvwxyz]{8}$/);
  assert.equal(id.length, 12);
  assert.equal([...id.slice(4)].every((character) => ID_ALPHABET.includes(character)), true);
});

test("generateId re-rolls a collision against the provided set", () => {
  const draws = [new Uint8Array(8), new Uint8Array(8).fill(1)];
  let calls = 0;
  const id = generateId(
    "prj",
    new Set(["prj-00000000"]),
    () => draws[calls++]!,
  );

  assert.equal(id, "prj-11111111");
  assert.equal(calls, 2);
});

test("generateId rejects a random source with the wrong byte count", () => {
  assert.throws(
    () => generateId("src", new Set(), () => new Uint8Array(7)),
    /expected 8/,
  );
});
