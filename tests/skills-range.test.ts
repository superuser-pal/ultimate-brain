import assert from "node:assert/strict";
import { test } from "node:test";

import { comparePrecedence, isNewerThanRange, isOlderThanRange, parseRange, parseVersion, satisfies } from "../src/lib/skills-range.ts";

// spec/skills-delivery.md §1 (precedence) and §2.1 (CLI range), §12.1 test 1.

test("versions parse as SemVer 2.0.0 without build metadata", () => {
  assert.deepEqual(parseVersion("0.9.0-rc.1"), { major: 0, minor: 9, patch: 0, prerelease: ["rc", "1"] });
  for (const bad of ["0.9", "v0.9.0", "01.0.0", "0.9.0+build", "0.9.0-", "0.9.0-01", "0.9.0-a..b"]) assert.equal(parseVersion(bad), undefined, bad);
});

test("precedence orders prereleases below their release and compares identifiers per SemVer", () => {
  const ordered = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.0.1", "1.1.0", "2.0.0"];
  for (let i = 0; i + 1 < ordered.length; i += 1) {
    assert.ok(comparePrecedence(ordered[i]!, ordered[i + 1]!) < 0, `${ordered[i]} < ${ordered[i + 1]}`);
    assert.ok(comparePrecedence(ordered[i + 1]!, ordered[i]!) > 0);
  }
  assert.equal(comparePrecedence("0.9.0", "0.9.0"), 0);
});

test("a range is space-separated comparators; anything else is rejected", () => {
  assert.deepEqual(parseRange(">=0.9.0 <0.10.0"), [{ operator: ">=", version: "0.9.0" }, { operator: "<", version: "0.10.0" }]);
  for (const bad of ["^0.9.0", ">=0.9.0  <0.10.0", ">=0.9.0 || <1.0.0", "0.9.0", ">= 0.9.0", ""]) assert.equal(parseRange(bad), undefined, bad);
});

test("satisfaction is every comparator under precedence, not npm's prerelease rule", () => {
  assert.equal(satisfies("0.9.0", ">=0.9.0 <0.10.0"), true);
  assert.equal(satisfies("0.9.5", ">=0.9.0 <0.10.0"), true);
  assert.equal(satisfies("0.10.0", ">=0.9.0 <0.10.0"), false);
  assert.equal(satisfies("0.9.0-rc.1", ">=0.9.0"), false);
  assert.equal(satisfies("0.9.0-rc.1", "<0.10.0"), true);
  assert.equal(satisfies("0.9.0-rc.1", ">=0.9.0-0 <0.10.0"), true);
  assert.equal(satisfies("0.10.0-rc.1", ">=0.9.0 <0.10.0"), true);
  assert.equal(satisfies("1.2.3", "=1.2.3"), true);
  assert.equal(satisfies("1.2.4", "=1.2.3"), false);
  assert.equal(satisfies("1.0.0", ">0.9.0 <=1.0.0"), true);
});

test("newer and older than the range follow the failed comparator", () => {
  assert.equal(isNewerThanRange("0.10.0", ">=0.9.0 <0.10.0"), true);
  assert.equal(isOlderThanRange("0.10.0", ">=0.9.0 <0.10.0"), false);
  assert.equal(isOlderThanRange("0.8.9", ">=0.9.0 <0.10.0"), true);
  assert.equal(isNewerThanRange("0.8.9", ">=0.9.0 <0.10.0"), false);
  assert.equal(isNewerThanRange("1.2.4", "=1.2.3"), true);
  assert.equal(isOlderThanRange("1.2.2", "=1.2.3"), true);
  assert.equal(isNewerThanRange("2.0.0", "<=1.0.0"), true);
  assert.equal(isOlderThanRange("0.9.0", ">0.9.0"), true);
  // A range no version satisfies: a version can be both, and callers give the newer message.
  assert.equal(isNewerThanRange("1.5.0", ">=2.0.0 <1.0.0"), true);
  assert.equal(isOlderThanRange("1.5.0", ">=2.0.0 <1.0.0"), true);
});
