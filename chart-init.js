// chart-init.js — initialize placeholder charts if canvases are present
document.addEventListener("DOMContentLoaded", () => {
  if (typeof Chart === "undefined") return;
  function makeDoughnut(id, labels, data, colors) {
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      return new Chart(el.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }],
        },
        options: {
          plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
          maintainAspectRatio: false,
        },
      });
    } catch (e) {
      console.warn("chart init failed", e);
    }
  }

  makeDoughnut(
    "summaryChart",
    ["درج", "مصروف", "مبيعات", "أرباح", "تسليم"],
    [5, 2, 8, 3, 4],
    ["#3b82f6", "#6b7280", "#10b981", "#f59e0b", "#06b6d4"],
  );
  makeDoughnut(
    "categoriesSummaryChart",
    ["درج", "ماكينات", "مصروف"],
    [4, 6, 2],
    ["#3b82f6", "#ef4444", "#6b7280"],
  );
  makeDoughnut(
    "configSummaryChart",
    ["ثوابت", "شعارات", "طباعات"],
    [3, 1, 2],
    ["#3b82f6", "#a78bfa", "#60a5fa"],
  );
  makeDoughnut(
    "reportChart",
    ["شراء", "بيع", "مصروف"],
    [10, 8, 2],
    ["#10b981", "#3b82f6", "#ef4444"],
  );
});
