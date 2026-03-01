import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { generateSvg } from "../dist/svg.js";

function makeData() {
  const start = new Date("2025-01-06");
  const contributionDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      date: date.toISOString().slice(0, 10),
      contributionCount: i,
      color: "#000000",
    };
  });

  return {
    totalContributions: contributionDays.reduce((sum, day) => sum + day.contributionCount, 0),
    weeks: [{ contributionDays }],
  };
}

test("generateSvg renders valid SVG and escapes username", () => {
  const svg = generateSvg(makeData(), { username: "a<b", showLabels: false });
  assert.match(svg, /^<svg /);
  assert.match(svg, /a&lt;b/);
  assert.match(svg, /contributions in the last year/);
});

test("generateSvg rejects invalid cellSize", () => {
  assert.throws(() => generateSvg(makeData(), { cellSize: 0 }), /Invalid cellSize/);
});

test("generateSvg rejects invalid cellGap", () => {
  assert.throws(() => generateSvg(makeData(), { cellGap: -1 }), /Invalid cellGap/);
});

test("CLI rejects invalid --width before running", () => {
  const cliPath = resolve(process.cwd(), "dist/index.js");
  const result = spawnSync(process.execPath, [cliPath, "octocat", "--width", "-1"], {
    encoding: "utf-8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--width must be a positive integer/);
});
