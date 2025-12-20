const assert = require("assert");
const path = require("path");

const trends = require(path.join(
  __dirname,
  "..",
  "app",
  "static",
  "js",
  "dashboard_trends_utils.js"
));

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("normalizes range keys and ignores invalid values", () => {
  assert.strictEqual(trends.normalizeRangeKey("Weekly"), "weekly");
  assert.strictEqual(trends.normalizeRangeKey("MONTHLY"), "monthly");
  assert.strictEqual(trends.normalizeRangeKey(""), "weekly");
  assert.strictEqual(trends.normalizeRangeKey("invalid"), "weekly");
});

test("builds macro and sleep datasets", () => {
  const macroSets = trends.buildMacroDatasets({
    protein: [1, 2],
    carbs: [3, 4],
    fat: [5, 6],
  });
  assert.strictEqual(macroSets.length, 3);
  assert.deepStrictEqual(macroSets[0].data, [1, 2]);

  const sleepSets = trends.buildSleepDatasets(["good", "fair"], {
    good: [7, 7.5],
    fair: [1, 0.5],
  });
  assert.strictEqual(sleepSets.length, 2);
  assert.deepStrictEqual(sleepSets[1].data, [1, 0.5]);
});

test("computes workout totals and falls back to counts", () => {
  const totals = trends.computeWorkoutTotals({
    strength: [30, 20],
    cardio: [15, 10],
  });
  assert.deepStrictEqual(totals, { strength: 50, cardio: 25 });

  const doughnutData = trends.buildWorkoutChartData(
    {},
    { yoga: [1, 0, 2], mobility: [0, 1, 0] }
  );
  assert.deepStrictEqual(doughnutData.labels.sort(), ["mobility", "yoga"]);
  assert.deepStrictEqual(
    doughnutData.data.sort((a, b) => a - b),
    [1, 3]
  );
});

test("updates subscribers when the range changes", () => {
  const store = trends.createRangeStore("daily");
  const states = [];
  store.subscribe((value) => states.push(value));
  store.set("monthly");
  store.set("monthly"); // no duplicate entry
  assert.deepStrictEqual(states, ["monthly"]);
  assert.strictEqual(store.get(), "monthly");
});

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = { test };
