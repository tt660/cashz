// =====================
// البيانات الأساسية
// =====================

(() => {
  const STORAGE_KEY = "wallet_categories_v1";

  let categories = [];

  const mainForm = document.getElementById("mainForm");
  const subForm = document.getElementById("subForm");
  const mainName = document.getElementById("mainName");
  const subName = document.getElementById("subName");
  const parentSelect = document.getElementById("parentSelect");
  const listContainer = document.getElementById("listContainer");
  const DAILY_STORAGE_KEY = "daily_categories_v1";
  let dailyCategories = [];
  const dailyMainForm = document.getElementById("dailyMainForm");
  const dailySubForm = document.getElementById("dailySubForm");
  const dailyMainName = document.getElementById("dailyMainName");
  const dailySubName = document.getElementById("dailySubName");
  const dailyParentSelect = document.getElementById("dailyParentSelect");
  const dailyListContainer = document.getElementById("dailyListContainer");
  // Treasuries (خزن)
  const TREASURY_KEY = "daily_treasuries_v1";
  let treasuries = [];
  const treasuryForm = document.getElementById("treasuryForm");
  const treasuryMainSelect = document.getElementById("treasuryMainSelect");
  const treasurySubSelect = document.getElementById("treasurySubSelect");
  const treasuryName = document.getElementById("treasuryName");
  const treasuryOpenBalance = document.getElementById("treasuryOpenBalance");
  const treasuryListContainer = document.getElementById(
    "treasuryListContainer",
  );
  const themeToggle = document.getElementById("themeToggle");

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(dailyCategories));
    localStorage.setItem(TREASURY_KEY, JSON.stringify(treasuries));
  }
  function load() {
    try {
      categories = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      dailyCategories =
        JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY)) || [];
      treasuries = JSON.parse(localStorage.getItem(TREASURY_KEY)) || [];
    } catch (e) {
      categories = [];
      dailyCategories = [];
      treasuries = [];
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function render() {
    listContainer.innerHTML = "";
    parentSelect.innerHTML = '<option value="">اختر تصنيف رئيسي أولا</option>';

    categories.forEach((cat) => {
      const box = document.createElement("div");
      box.className = "category";
      const h = document.createElement("h3");
      h.innerHTML = `<span>${cat.name}</span>`;

      const tools = document.createElement("div");
      tools.style.display = "flex";
      tools.style.gap = "8px";

      const del = document.createElement("button");
      del.className = "btn small";
      del.textContent = "حذف";
      del.onclick = async () => {
        if (!(await swalConfirm("حذف التصنيف سيحذف فرعيه. موافق؟"))) return;
        categories = categories.filter((c) => c.id !== cat.id);
        save();
        render();
      };

      tools.appendChild(del);
      h.appendChild(tools);
      box.appendChild(h);

      const childrenWrap = document.createElement("div");
      childrenWrap.className = "children";
      if ((cat.children || []).length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "لا يوجد تصنيفات فرعية بعد";
        childrenWrap.appendChild(empty);
      } else {
        cat.children.forEach((ch) => {
          const row = document.createElement("div");
          row.className = "child";
          const name = document.createElement("div");
          name.textContent = ch.name;
          const delc = document.createElement("button");
          delc.className = "btn small";
          delc.textContent = "حذف";
          delc.onclick = () => {
            cat.children = cat.children.filter((x) => x.id !== ch.id);
            save();
            render();
          };
          row.appendChild(name);
          row.appendChild(delc);
          childrenWrap.appendChild(row);
        });
      }

      box.appendChild(childrenWrap);
      listContainer.appendChild(box);

      // option
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      parentSelect.appendChild(opt);
    });
  }

  mainForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = mainName.value.trim();
    if (!name) return;
    if (categories.some((c) => c.name === name)) {
      alert("هذا التصنيف موجود بالفعل");
      return;
    }
    categories.push({ id: uid(), name, children: [] });
    mainName.value = "";
    save();
    render();
  });

  subForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pid = parentSelect.value;
    const name = subName.value.trim();
    if (!pid || !name) return;
    const parent = categories.find((c) => c.id === pid);
    if (!parent) return;
    if ((parent.children || []).some((x) => x.name === name)) {
      alert("اسم فرعي موجود بالفعل تحت نفس التصنيف");
      return;
    }
    parent.children.push({ id: uid(), name });
    subName.value = "";
    save();
    render();
  });

  // Daily categories management
  function renderDaily() {
    if (!dailyListContainer || !dailyParentSelect) return;
    dailyListContainer.innerHTML = "";
    dailyParentSelect.innerHTML =
      '<option value="">اختر التصنيف الرئيسي أولا</option>';
    dailyCategories.forEach((cat) => {
      const box = document.createElement("div");
      box.className = "category";
      const h = document.createElement("h3");
      h.innerHTML = `<span>${cat.name}</span>`;

      const tools = document.createElement("div");
      tools.style.display = "flex";
      tools.style.gap = "8px";
      const del = document.createElement("button");
      del.className = "btn small";
      del.textContent = "حذف";
      del.onclick = async () => {
        if (!(await swalConfirm("حذف التصنيف سيحذف فرعيه. موافق؟"))) return;
        dailyCategories = dailyCategories.filter((c) => c.id !== cat.id);
        save();
        renderDaily();
      };
      tools.appendChild(del);
      h.appendChild(tools);
      box.appendChild(h);

      const childrenWrap = document.createElement("div");
      childrenWrap.className = "children";
      if ((cat.children || []).length === 0) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "لا يوجد تصنيفات فرعية بعد";
        childrenWrap.appendChild(empty);
      } else {
        cat.children.forEach((ch) => {
          const row = document.createElement("div");
          row.className = "child";
          const name = document.createElement("div");
          name.textContent = ch.name;
          const delc = document.createElement("button");
          delc.className = "btn small";
          delc.textContent = "حذف";
          delc.onclick = () => {
            cat.children = cat.children.filter((x) => x.id !== ch.id);
            save();
            renderDaily();
          };
          row.appendChild(name);
          row.appendChild(delc);
          childrenWrap.appendChild(row);
        });
      }
      box.appendChild(childrenWrap);
      dailyListContainer.appendChild(box);

      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      dailyParentSelect.appendChild(opt);
    });
  }

  dailyMainForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = dailyMainName.value.trim();
    if (!name) return;
    if (dailyCategories.some((c) => c.name === name)) {
      alert("هذا التصنيف موجود بالفعل");
      return;
    }
    dailyCategories.push({ id: uid(), name, children: [] });
    dailyMainName.value = "";
    save();
    renderDaily();
  });

  dailySubForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const pid = dailyParentSelect.value;
    const name = dailySubName.value.trim();
    if (!pid || !name) return;
    const parent = dailyCategories.find((c) => c.id === pid);
    if (!parent) return;
    if ((parent.children || []).some((x) => x.name === name)) {
      alert("اسم فرعي موجود بالفعل تحت نفس التصنيف");
      return;
    }
    parent.children.push({ id: uid(), name });
    dailySubName.value = "";
    save();
    renderDaily();
  });

  // treasury helpers
  function populateTreasuryMainOptions() {
    if (!treasuryMainSelect) return;
    treasuryMainSelect.innerHTML =
      '<option value="">اختر التصنيف الرئيسي اليومي</option>';
    dailyCategories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      treasuryMainSelect.appendChild(opt);
    });
    if (treasurySubSelect)
      treasurySubSelect.innerHTML =
        '<option value="">اختر التصنيف الفرعي</option>';
  }

  function renderTreasuries() {
    if (!treasuryListContainer) return;
    treasuryListContainer.innerHTML = "";
    treasuries.forEach((t) => {
      const box = document.createElement("div");
      box.className = "category";
      const h = document.createElement("h3");
      const mainName =
        (dailyCategories.find((d) => d.id === t.mainId) || {}).name || "";
      h.innerHTML = `<span>${t.name} <small class=\"muted\">${mainName}${t.subName ? " • " + t.subName : ""}</small></span>`;

      const tools = document.createElement("div");
      tools.style.display = "flex";
      tools.style.gap = "8px";
      const addTx = document.createElement("button");
      addTx.className = "btn small";
      addTx.textContent = "سجل حركة";
      addTx.onclick = () => addTreasuryTransaction(t.id);
      const closeBtn = document.createElement("button");
      closeBtn.className = "btn small";
      closeBtn.textContent = t.closed ? "مغلقة" : "تسليم نهاية اليوم";
      closeBtn.disabled = !!t.closed;
      closeBtn.onclick = () => closeTreasury(t.id);
      const del = document.createElement("button");
      del.className = "btn small";
      del.textContent = "حذف";
      del.onclick = async () => {
        if (!(await swalConfirm("حذف الخزنة سيحذف تاريخها. موافق؟"))) return;
        treasuries = treasuries.filter((x) => x.id !== t.id);
        save();
        renderTreasuries();
      };
      tools.appendChild(addTx);
      tools.appendChild(closeBtn);
      tools.appendChild(del);
      h.appendChild(tools);
      box.appendChild(h);

      const body = document.createElement("div");
      body.className = "children";
      const open = document.createElement("div");
      open.className = "child";
      open.innerHTML = `<div>بداية اليوم: ${Number(t.openBalance).toFixed(2)}</div><div>الحالة: ${t.closed ? "مغلقة" : "مفتوحة"}</div><div>الرصيد الحالي: ${Number(calcTreasuryBalance(t)).toFixed(2)}</div>`;
      body.appendChild(open);

      const txList = document.createElement("div");
      txList.className = "children";
      if (!t.transactions || t.transactions.length === 0) {
        const emp = document.createElement("div");
        emp.className = "muted";
        emp.textContent = "لا توجد حركات بعد";
        txList.appendChild(emp);
      } else {
        t.transactions.forEach((tx) => {
          const r = document.createElement("div");
          r.className = "child";
          r.innerHTML = `<div>${tx.date ? tx.date.slice(0, 19) : ""} — ${tx.type === "in" ? "+" : "-"}${Number(tx.amount).toFixed(2)} ${tx.note ? "• " + tx.note : ""}</div>`;
          txList.appendChild(r);
        });
      }
      box.appendChild(body);
      box.appendChild(txList);
      treasuryListContainer.appendChild(box);
    });
  }

  function calcTreasuryBalance(t) {
    const base = Number(t.openBalance) || 0;
    const txSum = (t.transactions || []).reduce(
      (s, x) => s + (x.type === "in" ? Number(x.amount) : -Number(x.amount)),
      0,
    );
    return base + txSum;
  }

  function addTreasuryTransaction(tId) {
    const t = treasuries.find((x) => x.id === tId);
    if (!t) return alert("خزنة غير موجودة");
    const type = prompt("نوع الحركة: اكتب in للاضافة أو out للسحب", "in");
    if (!type) return;
    const amt = prompt("المبلغ", "0");
    if (amt === null) return;
    const note = prompt("ملاحظة (اختياري)", "");
    t.transactions = t.transactions || [];
    t.transactions.push({
      id: uid(),
      type: type === "in" ? "in" : "out",
      amount: Number(amt) || 0,
      note: note || "",
      date: new Date().toISOString(),
    });
    save();
    renderTreasuries();
  }

  function closeTreasury(tId) {
    const t = treasuries.find((x) => x.id === tId);
    if (!t) return alert("خزنة غير موجودة");
    const closing = prompt(
      "دخل قيمة تسليم نهاية اليوم (الرصيد النهائي)",
      String(calcTreasuryBalance(t)),
    );
    if (closing === null) return;
    t.closed = true;
    t.closeBalance = Number(closing) || 0;
    t.closedAt = new Date().toISOString();
    save();
    renderTreasuries();
  }

  treasuryMainSelect?.addEventListener("change", () => {
    const mid = treasuryMainSelect.value;
    const main = dailyCategories.find((d) => d.id === mid);
    if (!treasurySubSelect) return;
    treasurySubSelect.innerHTML =
      '<option value="">اختر التصنيف الفرعي</option>';
    ((main && main.children) || []).forEach((ch) => {
      const o = document.createElement("option");
      o.value = ch.name;
      o.textContent = ch.name;
      treasurySubSelect.appendChild(o);
    });
  });

  treasuryForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const mainId = treasuryMainSelect.value;
    if (!mainId) return alert("اختر التصنيف الرئيسي اليومي");
    const subName = (treasurySubSelect.value || "").trim();
    const name =
      (treasuryName.value || "").trim() ||
      treasurySubSelect.value ||
      "" ||
      "خزنة";
    const open = Number(treasuryOpenBalance.value) || 0;
    const newT = {
      id: uid(),
      name,
      mainId,
      subName,
      openBalance: open,
      transactions: [],
      createdAt: new Date().toISOString(),
      closed: false,
    };
    treasuries.push(newT);
    save();
    treasuryName.value = "";
    treasuryOpenBalance.value = "";
    renderTreasuries();
  });

  // dark mode removed — no theme handling here

  // export / import categories
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  function exportCategories() {
    const dataStr = JSON.stringify(categories, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "categories.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importCategoriesFromText(text) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Invalid format");
      categories = parsed;
      save();
      render();
      alert("تم استيراد التصنيفات بنجاح");
    } catch (e) {
      alert("خطأ عند استيراد JSON: " + e.message);
    }
  }

  if (exportBtn) exportBtn.addEventListener("click", exportCategories);
  if (importBtn)
    importBtn.addEventListener("click", () => {
      importFile.click();
    });
  if (importFile)
    importFile.addEventListener("change", (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        importCategoriesFromText(reader.result);
        importFile.value = "";
      };
      reader.readAsText(file, "utf-8");
    });

  // Notifications simple implementation
  const notifications = { trade: [], limit: [], call: [] };
  const tradeCountEl = document.getElementById("tradeCount");
  const limitCountEl = document.getElementById("limitCount");
  const callCountEl = document.getElementById("callCount");
  const notificationBox = document.getElementById("notificationBox");
  const notificationList = document.getElementById("notificationList");
  const boxTitle = document.getElementById("boxTitle");

  function updateCounts() {
    tradeCountEl.textContent = notifications.trade.length || 0;
    limitCountEl.textContent = notifications.limit.length || 0;
    callCountEl.textContent = notifications.call.length || 0;
  }

  window.openBox = function (type) {
    const items = notifications[type] || [];
    boxTitle.textContent =
      { trade: "بيع/شراء", limit: "الليمت", call: "آخر مكالمة" }[type] ||
      "الإشعارات";
    notificationList.innerHTML = "";
    if (items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "لا توجد إشعارات";
      notificationList.appendChild(li);
    } else {
      items.forEach((it, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${it}</span><button onclick="notifications.${type}.splice(${idx},1); updateCounts(); openBox('${type}')" class='btn small'>إلغاء</button>`;
        notificationList.appendChild(li);
      });
    }
    notificationBox.classList.toggle("hidden", false);
  };

  window.markAllRead = function () {
    notifications.trade = [];
    notifications.limit = [];
    notifications.call = [];
    updateCounts();
    notificationBox.classList.add("hidden");
  };

  // sample notifications (for demo) — you can remove or replace with real data
  notifications.trade.push("طلب بيع رقم 123");
  notifications.limit.push("تجاوز الحد لمحفظة فودافون");
  notifications.call.push("مكالمة من 010xxxxxxx");
  updateCounts();

  // init
  load();
  render();
  renderDaily();
  populateTreasuryMainOptions();
  renderTreasuries();
})();
