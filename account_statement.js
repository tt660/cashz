// account_statement.js
(function () {
  let summaryChart = null;
  function initSummaryChart() {
    const ctx = document.getElementById("summaryChart").getContext("2d");
    summaryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["الدرج", "المصروف", "المبيعات", "الأرباح", "التسليم"],
        datasets: [
          {
            data: [0, 0, 0, 0, 0],
            backgroundColor: [
              "#3b82f6",
              "#6b7280",
              "#10b981",
              "#f59e0b",
              "#06b6d4",
            ],
            hoverOffset: 6,
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
        maintainAspectRatio: false,
      },
    });
  }

  function updateSummaryChart(stats) {
    if (!summaryChart) return;
    summaryChart.data.datasets[0].data = [
      Number(stats.drawers || 0),
      Number(stats.expenses || 0),
      Number(stats.sales || 0),
      Math.max(0, Number(stats.profit || 0)),
      Number(stats.delivery || 0),
    ];
    summaryChart.update();
  }
  const DAILY_CAT_KEY = "daily_categories_v1";
  const INVOICES_KEY = "daily_invoices_v1";

  function q(id) {
    return document.getElementById(id);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function loadDailyCategories() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_CAT_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function loadInvoices() {
    try {
      return JSON.parse(localStorage.getItem(INVOICES_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveInvoices(list) {
    try {
      localStorage.setItem(INVOICES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function populateMain() {
    const cats = loadDailyCategories();
    const sel = q("asMainSelect");
    if (!sel) return;
    sel.innerHTML =
      '<option value="">اختر...</option>' +
      cats.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  function populateSub(mainId) {
    const cats = loadDailyCategories();
    const main = cats.find((c) => c.id === mainId);
    const sel = q("asSubSelect");
    if (!sel) return;
    sel.innerHTML =
      '<option value="">اختر...</option>' +
      (main && main.children
        ? main.children
            .map((ch) => `<option value="${ch.name}">${ch.name}</option>`)
            .join("")
        : "");
  }

  function renderDynamicFields() {
    const sub = q("asSubSelect").value;
    const container = q("dynamicFields");
    container.innerHTML = "";
    if (!sub) return;
    // heuristics: if sub matches common machine types show machine fields
    const machineTypes = ["فوري", "امان", "بساطة", "فوري-امان", "فوري-بساطة"];
    if (machineTypes.includes(sub) || /ماكينة|فوري|امان|بساطة/i.test(sub)) {
      container.innerHTML = `
				<div class="mb-2"><label class="form-label">رقم الهاتف</label><input id="fldPhone" class="form-control" /></div>
				<div class="mb-2"><label class="form-label">رقم البطاقة</label><input id="fldCard" class="form-control" /></div>
				<div class="mb-2"><label class="form-label">الرصيد المشحون</label><input id="fldAmount" type="number" step="0.01" class="form-control" /></div>
				<div class="mb-2"><label class="form-label">المبلغ المدفوع</label><input id="fldPaid" type="number" step="0.01" class="form-control" /></div>
			`;
      return;
    }

    // if sub suggests goods
    if (/بضاعة|موبايل|اكسسوار|بضاعة/i.test(sub)) {
      container.innerHTML = `
				<div class="mb-2"><label class="form-label">اسم المنتج</label><input id="fldProduct" class="form-control" /></div>
				<div class="mb-2"><label class="form-label">جملة المنتج</label><input id="fldProductWholesale" class="form-control" /></div>
				<div class="mb-2"><label class="form-label">المبلغ المدفوع</label><input id="fldPaid" type="number" step="0.01" class="form-control" /></div>
			`;
      return;
    }

    // expenses
    if (/مصروف|مصروفات/i.test(sub)) {
      container.innerHTML = `
				<div class="mb-2"><label class="form-label">اسم المصروف</label><input id="fldExpenseName" class="form-control" /></div>
				<div class="mb-2"><label class="form-label">المبلغ المصروف</label><input id="fldAmount" type="number" step="0.01" class="form-control" /></div>
			`;
      return;
    }

    // default generic fields
    container.innerHTML = `
			<div class="mb-2"><label class="form-label">الكمية/المبلغ</label><input id="fldAmount" type="number" step="0.01" class="form-control" /></div>
			<div class="mb-2"><label class="form-label">المبلغ المدفوع</label><input id="fldPaid" type="number" step="0.01" class="form-control" /></div>
		`;
  }

  function createInvoice(manual = false) {
    const mainSel = q("asMainSelect");
    const subSel = q("asSubSelect");
    if (!mainSel || !subSel) return;
    if (!mainSel.value) return alert("اختر تصنيف رئيسي");
    if (!subSel.value) return alert("اختر تصنيف فرعي");
    const sub = subSel.value;
    const notes = q("asNotes").value || "";
    const inv = {
      id: uid(),
      mainId: mainSel.value,
      subName: sub,
      notes,
      manual: !!manual,
      createdAt: new Date().toISOString(),
    };
    // collect fields depending on dynamic inputs
    const phoneEl = q("fldPhone");
    if (phoneEl) inv.phone = phoneEl.value || "";
    const cardEl = q("fldCard");
    if (cardEl) inv.card = cardEl.value || "";
    const prodEl = q("fldProduct");
    if (prodEl) inv.product = prodEl.value || "";
    const wholesaleEl = q("fldProductWholesale");
    if (wholesaleEl) inv.wholesale = wholesaleEl.value || "";
    const amountEl = q("fldAmount");
    if (amountEl) inv.amount = Number(amountEl.value) || 0;
    const paidEl = q("fldPaid");
    if (paidEl) inv.paid = Number(paidEl.value) || 0;
    const expenseName = q("fldExpenseName");
    if (expenseName) inv.expenseName = expenseName.value || "";

    const list = loadInvoices();
    list.unshift(inv);
    saveInvoices(list);
    renderInvoices();
    // clear some fields
    [
      "fldPhone",
      "fldCard",
      "fldProduct",
      "fldProductWholesale",
      "fldAmount",
      "fldPaid",
      "fldExpenseName",
      "asNotes",
    ].forEach((id) => {
      const e = q(id);
      if (e) e.value = "";
    });
    alert("تم حفظ الفاتورة");
  }

  function renderInvoices() {
    const list = loadInvoices();
    const container = q("invoicesList");
    if (!container) return;
    container.innerHTML = "";
    if (list.length === 0) {
      container.innerHTML = '<div class="muted">لا توجد فواتير</div>';
      return;
    }
    list.forEach((inv) => {
      const el = document.createElement("div");
      el.className = "card mb-2 p-2";
      const mainName =
        (loadDailyCategories().find((d) => d.id === inv.mainId) || {}).name ||
        "";
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <strong>${mainName} • ${inv.subName}</strong>
            <div class="muted small">${inv.createdAt.replace("T", " ").slice(0, 19)}</div>
          </div>
          <div>
            <button class="btn btn-sm btn-outline-danger del">حذف</button>
          </div>
        </div>
        <div class="invoice-details mt-2">
          <div><strong>المبلغ:</strong> ${inv.amount !== undefined ? Number(inv.amount).toFixed(2) : "-"}</div>
          <div><strong>المدفوع:</strong> ${inv.paid !== undefined ? Number(inv.paid).toFixed(2) : "-"}</div>
          ${inv.phone ? `<div><strong>الهاتف:</strong> ${inv.phone}</div>` : ""}
          ${inv.card ? `<div><strong>رقم البطاقة:</strong> ${inv.card}</div>` : ""}
          ${inv.product ? `<div><strong>المنتج:</strong> ${inv.product}${inv.wholesale ? " — " + inv.wholesale : ""}</div>` : ""}
          ${inv.expenseName ? `<div><strong>المصروف:</strong> ${inv.expenseName}</div>` : ""}
          ${inv.notes ? `<div class="muted small">ملاحظات: ${inv.notes}</div>` : ""}
        </div>
      `;
      const del = el.querySelector(".del");
      del.addEventListener("click", async () => {
        if (!(await swalConfirm("حذف الفاتورة؟"))) return;
        const arr = loadInvoices().filter((x) => x.id !== inv.id);
        saveInvoices(arr);
        renderInvoices();
      });
      container.appendChild(el);
    });
  }

  function renderDashboard() {
    const area = q("dashboardArea");
    if (!area) return;
    area.innerHTML = "";
    // compute simple stats: drawers, expenses, sales, profit, delivery from invoices
    const inv = loadInvoices();
    const stats = { drawers: 0, expenses: 0, sales: 0, profit: 0, delivery: 0 };
    inv.forEach((i) => {
      const sub = (i.subName || "").toLowerCase();
      if (/درج|درج/i.test(sub)) stats.drawers += Number(i.amount || 0);
      else if (/مصروف|مصروفات|مصروف/i.test(sub))
        stats.expenses += Number(i.amount || 0);
      else if (/بضاعة|موبايل|اكسسوار|بضاعة/i.test(sub))
        stats.sales += Number(i.amount || 0);
      else stats.delivery += Number(i.paid || 0);
      stats.profit += Number(i.paid || 0) - Number(i.amount || 0);
    });
    const items = [
      { k: "drawers", title: "الدرج", class: "primary" },
      { k: "expenses", title: "المصروف", class: "secondary" },
      { k: "sales", title: "المبيعات", class: "success" },
      { k: "profit", title: "الأرباح", class: "warning" },
      { k: "delivery", title: "التسليم", class: "info" },
    ];
    items.forEach((it) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";
      col.innerHTML = `<div class="card p-2 text-end"><div class="muted small">${it.title}</div><div class="h5 fw-bold text-${it.class}">${Number(stats[it.k] || 0).toFixed(2)}</div></div>`;
      area.appendChild(col);
    });
    // update summary chart
    try {
      updateSummaryChart(stats);
    } catch (e) {}
  }

  function exportInvoicesCsv() {
    const list = loadInvoices();
    if (!list.length) return alert("لا توجد فواتير للتصدير");
    const rows = [["id", "date", "main", "sub", "amount", "paid", "notes"]];
    const cats = loadDailyCategories();
    list.forEach((i) => {
      const main = (cats.find((c) => c.id === i.mainId) || {}).name || "";
      rows.push([
        i.id,
        i.createdAt,
        main,
        i.subName,
        i.amount || 0,
        i.paid || 0,
        i.notes || "",
      ]);
    });
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // wire events
  document.addEventListener("DOMContentLoaded", () => {
    populateMain();
    renderInvoices();
    renderDashboard();
    // init chart after DOM ready
    try {
      initSummaryChart();
      renderDashboard();
    } catch (e) {}
    q("asMainSelect")?.addEventListener("change", (e) =>
      populateSub(e.target.value),
    );
    q("asSubSelect")?.addEventListener("change", renderDynamicFields);
    q("createInvoiceBtn")?.addEventListener("click", () =>
      createInvoice(false),
    );
    q("createManualInvoiceBtn")?.addEventListener("click", () =>
      createInvoice(true),
    );
    q("exportInvoices")?.addEventListener("click", exportInvoicesCsv);
    q("clearInvoices")?.addEventListener("click", async () => {
      if (await swalConfirm("مسح كل الفواتير؟")) {
        saveInvoices([]);
        renderInvoices();
        renderDashboard();
      }
    });
    // dashboard switches
    q("viewDrawerBtn")?.addEventListener("click", () => {
      alert("عرض الدرج — يمكنك استبدال هذه العملية بعرض مفصل");
    });
    q("viewExpensesBtn")?.addEventListener("click", () => {
      alert("عرض المصروف — يمكنك استبدال هذه العملية بعرض مفصل");
    });
    q("viewSalesBtn")?.addEventListener("click", () => {
      alert("عرض المبيعات — يمكنك استبدال هذه العملية بعرض مفصل");
    });
    q("viewProfitBtn")?.addEventListener("click", () => {
      alert("عرض الأرباح — يمكنك استبدال هذه العملية بعرض مفصل");
    });
    q("viewDeliveryBtn")?.addEventListener("click", () => {
      alert("عرض التسليم — يمكنك استبدال هذه العملية بعرض مفصل");
    });
    // refresh periodically
    setInterval(() => {
      renderInvoices();
      renderDashboard();
    }, 5000);

    // dark-mode removed: no theme toggle
  });
})();
