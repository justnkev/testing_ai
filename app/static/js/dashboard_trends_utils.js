/* global module */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FVTrends = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const colors = {
    protein: "#8c7bff",
    carbs: "#3dd6d0",
    fat: "#ffc773",
    sleep: ["#8c7bff", "#3dd6d0", "#ffc773", "#6dd07f", "#f472b6"],
    workouts: ["#3dd6d0", "#8c7bff", "#ffc773", "#6dd07f", "#f472b6"],
  };

  const normalizeRangeKey = (value) => {
    const normalized = (value || "").toString().toLowerCase();
    return ["daily", "weekly", "monthly"].includes(normalized) ? normalized : "weekly";
  };

  const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

  const buildMacroDatasets = (macros = {}) => [
    {
      label: "Protein",
      data: macros.protein || [],
      backgroundColor: "rgba(140, 123, 255, 0.8)",
      borderColor: colors.protein,
      borderWidth: 1,
      stack: "macros",
    },
    {
      label: "Carbs",
      data: macros.carbs || [],
      backgroundColor: "rgba(61, 214, 208, 0.7)",
      borderColor: colors.carbs,
      borderWidth: 1,
      stack: "macros",
    },
    {
      label: "Fat",
      data: macros.fat || [],
      backgroundColor: "rgba(255, 199, 115, 0.8)",
      borderColor: colors.fat,
      borderWidth: 1,
      stack: "macros",
    },
  ];

  const buildSleepDatasets = (qualities = [], series = {}) =>
    qualities.map((quality, index) => ({
      label: quality,
      data: series[quality] || [],
      backgroundColor: colors.sleep[index % colors.sleep.length],
      borderRadius: 8,
    }));

  const computeWorkoutTotals = (durationSeries = {}) => {
    const totals = {};
    Object.entries(durationSeries).forEach(([type, values]) => {
      totals[type] = round((values || []).reduce((sum, value) => sum + (Number(value) || 0), 0));
    });
    return totals;
  };

  const buildWorkoutChartData = (durationSeries = {}, countSeries = {}) => {
    const totals = computeWorkoutTotals(durationSeries);
    const labels = Object.keys(totals).filter((label) => totals[label] > 0);

    if (labels.length === 0) {
      // Fall back to counts if durations are unavailable
      Object.entries(countSeries || {}).forEach(([type, values]) => {
        const countSum = (values || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
        if (countSum > 0) {
          totals[type] = round(countSum);
          labels.push(type);
        }
      });
    }

    const data = labels.map((label) => totals[label] || 0);
    const backgroundColor = labels.map(
      (_label, index) => colors.workouts[index % colors.workouts.length]
    );

    return { labels, data, backgroundColor };
  };

  const createRangeStore = (initialRange = "weekly") => {
    let value = normalizeRangeKey(initialRange);
    const listeners = new Set();

    const set = (next) => {
      const normalized = normalizeRangeKey(next);
      if (normalized === value) return;
      value = normalized;
      listeners.forEach((fn) => {
        try {
          fn(value);
        } catch (_error) {
          // ignore listener failures
        }
      });
    };

    const subscribe = (fn) => {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    };

    return {
      get: () => value,
      set,
      subscribe,
    };
  };

  return {
    colors,
    normalizeRangeKey,
    buildMacroDatasets,
    buildSleepDatasets,
    computeWorkoutTotals,
    buildWorkoutChartData,
    createRangeStore,
  };
});
