// home.js - dashboard and buy/sell actions
// ensure a safe global exists early to avoid ReferenceError from console calls
try {
  if (typeof window.renderWalletSelect === "undefined") {
    window.renderWalletSelect = function () {
      console.warn(
        "renderWalletSelect called before initialization; call ignored.",
      );
    };
  }
  // also create a global lexical binding so bare `renderWalletSelect()` calls work
  try {
    if (typeof renderWalletSelect === "undefined") {
      /* eslint-disable no-var */
      var renderWalletSelect = window.renderWalletSelect;
    }
  } catch (e) {}
} catch (e) {}

(function () {
  const WALLETS_KEY = "wallets_v1";
  const TX_KEY = "transactions_v1";
  const INVOICE_KEY = "invoice_settings_v1";
  const SELECTED_WALLET_KEY = "selected_wallet_v1";
  let editingTxId = null;

  function getWallets() {
    try {
      return JSON.parse(localStorage.getItem(WALLETS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveWallets(ws) {
    try {
      localStorage.setItem(WALLETS_KEY, JSON.stringify(ws));
    } catch (e) {}
  }
  function getTx() {
    try {
      return JSON.parse(localStorage.getItem(TX_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveTx(t) {
    try {
      localStorage.setItem(TX_KEY, JSON.stringify(t));
    } catch (e) {}
  }
  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(INVOICE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function q(id) {
    return document.getElementById(id);
  }

  // daily invoices sync (auto-create invoices from main transactions)
  const DAILY_INVOICES_KEY = "daily_invoices_v1";

  function genInvId() {
    return "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  }

  function getDailyInvoices() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_INVOICES_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveDailyInvoices(list) {
    try {
      localStorage.setItem(DAILY_INVOICES_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function syncTxToInvoice(txObj) {
    if (!txObj || !txObj.id) return;
    const list = getDailyInvoices();
    const existingIdx = list.findIndex(
      (i) => String(i.txId) === String(txObj.id),
    );
    const inv = {
      id: existingIdx !== -1 ? list[existingIdx].id : genInvId(),
      txId: txObj.id,
      mainId: "",
      subName:
        txObj.type === "buy"
          ? "شراء"
          : txObj.type === "sell"
            ? "بيع"
            : txObj.type || "",
      amount: Number(txObj.amount) || 0,
      paid: Number(txObj.paid) || 0,
      phone: txObj.phone || "",
      notes: `مزامنة من المعاملة ${txObj.id}`,
      manual: false,
      createdAt: txObj.date || new Date().toISOString(),
    };
    if (existingIdx !== -1) {
      list[existingIdx] = Object.assign({}, list[existingIdx], inv);
    } else {
      list.unshift(inv);
    }
    saveDailyInvoices(list);
  }

  function format(n) {
    return Number(n || 0).toFixed(2);
  }

  function displayType(type) {
    if (type === "buy") return "شراء((سحب))";
    if (type === "sell") return "بيع((تحويل))";
    return type;
  }

  function computeOverview() {
    const wallets = getWallets();
    // compute profit/loss from transaction diffs (diff stored on each tx)
    const tx = getTx();
    let totalProfit = 0,
      totalLoss = 0;
    tx.forEach((t) => {
      const d = computeDiffForTx(t);
      const paid = Number(t.paid || t.price || 0);
      const amt = Number(t.amount) || 0;
      const tradeProfit = t.type === "buy" ? amt - paid : paid - amt;
      const total = d + tradeProfit;
      if (total > 0) totalProfit += total;
      else if (total < 0) totalLoss += Math.abs(total);
    });
    q("totalGain").textContent = format(totalProfit);
    q("totalLoss").textContent = format(totalLoss);
    q("netProfit").textContent = format(totalProfit - totalLoss);
    q("allBalances").textContent = format(
      wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0),
    );
  }

  function computeDiffForTx(t) {
    // if diff is present and numeric, use it
    const stored = t && t.diff;
    if (stored !== undefined && stored !== null && isFinite(Number(stored)))
      return Number(stored);
    // otherwise compute using rounding logic
    const amount = Number(t.amount) || 0;
    const target = Math.round(amount / 1000) * 1000;
    let diff = 0;
    if (t.type === "buy") diff = target - amount;
    else diff = amount - target;
    return diff;
  }

  function normalizeTxs() {
    const tx = getTx();
    let changed = false;
    tx.forEach((t) => {
      if (t.diff === undefined || t.diff === null) {
        t.diff = computeDiffForTx(t);
        changed = true;
      }
      // ensure tradeProfit and total exist for older tx objects
      if (t.tradeProfit === undefined || t.tradeProfit === null) {
        const paid = Number(t.paid || t.price || 0);
        const amt = Number(t.amount) || 0;
        t.tradeProfit = t.type === "buy" ? amt - paid : paid - amt;
        changed = true;
      }
      if (t.total === undefined || t.total === null) {
        t.total = Number(t.diff || 0) + Number(t.tradeProfit || 0);
        changed = true;
      }
    });
    if (changed) saveTx(tx);
  }

  function computeTodayReport() {
    const tx = getTx();
    const today = new Date().toISOString().slice(0, 10);
    const todayTx = tx.filter((t) => (t.date || "").slice(0, 10) === today);
    const buy = todayTx.filter((t) => t.type === "buy");
    const sell = todayTx.filter((t) => t.type === "sell");
    q("todayBuyCount").textContent = buy.length;
    q("todaySellCount").textContent = sell.length;
    q("todayBuyTotal").textContent = format(
      buy.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    );
    q("todaySellTotal").textContent = format(
      sell.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    );
    // today's profit = sell total - buy total
    q("todayProfit").textContent = format(
      sell.reduce((s, t) => s + (Number(t.amount) || 0), 0) -
        buy.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    );
  }

  function getTodayBuyTotalForWallet(walletId, excludeTxId) {
    const tx = getTx();
    const today = new Date().toISOString().slice(0, 10);
    return tx
      .filter(
        (t) => String(t.walletId) === String(walletId) && t.type === "buy",
      )
      .filter((t) => (t.date || "").slice(0, 10) === today)
      .filter((t) =>
        excludeTxId ? String(t.id) !== String(excludeTxId) : true,
      )
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }

  function addLog(phone, type, amount, diff, dateStr, tradeProfit) {
    const tb = q("log");
    if (!tb) return;
    const item = document.createElement("div");
    item.className = "accordion-item";
    item.dataset.date = dateStr;
    item.innerHTML = `
      <button class="accordion-header" type="button">
        <div class="hdr-left"><span class="phone">${phone}</span> <span class="date">${dateStr}</span></div>
        <div class="hdr-right"><span class="type">${displayType(type)}</span> <span class="amount">${format(amount)}</span> <span class="diff ${tradeProfit >= 0 ? "profit" : "loss"}">${tradeProfit >= 0 ? "+" : ""}${format(tradeProfit || 0)}</span></div>
      </button>
      <div class="accordion-body">
        <div class="accordion-actions">
          <button class="edit">تعديل</button>
          <button class="del">حذف</button>
          <button class="print">طباعة</button>
        </div>
      </div>
    `;
    tb.appendChild(item);
  }

  async function deleteTx(id) {
    const tx = getTx();
    const idx = tx.findIndex((t) => t.id === id);
    if (idx === -1) return;
    if (!(await swalConfirm("تأكيد حذف العملية؟"))) return;
    // revert wallet effect if possible
    const t = tx[idx];
    try {
      const wallets = getWallets();
      const w = wallets.find((x) => String(x.id) === String(t.walletId));
      if (w) {
        if (t.type === "buy")
          w.balance = (Number(w.balance) || 0) - (Number(t.amount) || 0);
        else w.balance = (Number(w.balance) || 0) + (Number(t.amount) || 0);
        saveWallets(wallets);
      }
    } catch (e) {}
    tx.splice(idx, 1);
    saveTx(tx);
    // remove synced daily invoice if any
    try {
      const inv = getDailyInvoices().filter(
        (i) => String(i.txId) !== String(id),
      );
      saveDailyInvoices(inv);
    } catch (e) {}
    computeOverview();
    computeTodayReport();
    renderWalletSelect();
    onWalletChange();
    renderTxLog();
  }

  function startEditTx(id) {
    const tx = getTx().find((t) => t.id === id);
    if (!tx) return alert("المعاملة غير موجودة");
    editingTxId = id;
    // populate form
    q("walletSelect").value = tx.walletId || "";
    try {
      localStorage.setItem(SELECTED_WALLET_KEY, String(tx.walletId || ""));
    } catch (e) {}
    q("actionPhone").value = tx.phone || "";
    q("chargedAmount").value = tx.amount;
    q("paidAmount").value = tx.paid || tx.price || 0;
    // highlight edit mode
    alert("وضع التعديل مُفعّل. اضغط تنفيذ شراء/بيع لحفظ التعديل.");
  }

  function printTx(id) {
    // legacy single-arg print (kept for compatibility)
    printTx(id, 80, false);
  }

  function printTx(id, sizeMM = 80, viaBluetooth = false) {
    const tx = getTx().find((t) => t.id === id);
    if (!tx) return alert("المعاملة غير موجودة");
    const settings = getSettings() || {};
    const logo = settings.logoDataUrl || null;
    const shop = settings.shopName || "";
    const mid = settings.midMessage || "";
    const footer = settings.footerMessage || "";

    const width = sizeMM === 58 ? "58mm" : "80mm";
    const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة طباعة</title>
        <style>
          @page { size: ${width} auto; margin: 6mm; }
          body { font-family: Inter, Arial, sans-serif; direction: rtl; width: ${width}; margin:0; color:#111; }
          .ticket { width: 100%; box-sizing: border-box; }
          .logo { text-align: center; margin-bottom: 6px; }
          .logo img { max-width: 100%; height: auto; }
          .shop { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 6px; }
          .meta { font-size: 12px; margin-bottom: 6px; }
          .meta div { margin: 3px 0; }
          .meta .bold { font-weight: 700; font-size: 14px; }
          .section { border-top:1px dashed #ccc; padding-top:6px; margin-top:6px; }
          .center { text-align: center; }
          .values { display:flex; justify-content:space-between; gap:8px; font-size:13px; }
          .values .label { color:#666 }
          .wallet-number { font-weight: 800; font-size: 16px; display:inline-block; margin-right:6px }
          .footer { margin-top:8px; font-size:12px; text-align:center; }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${logo ? `<div class="logo"><img src="${logo}" alt="logo" /></div>` : ""}
          <div class="shop">${shop}</div>
          <div class="meta">
            <div>التاريخ: <span class="bold">${(tx.date || "").replace("T", " ").slice(0, 19)}</span></div>
            <div>رقم العملية: <span class="bold">${tx.id}</span></div>
            <div>نوع العملية: <span class="bold">${displayType(tx.type)}</span></div>
            <div>رقم المحفظة: <span class="wallet-number">${tx.phone || tx.walletId}</span></div>
          </div>

          <div class="section">
            <div class="values"><div class="label">الرصيد المشحون</div><div class="bold">${format(tx.amount)}</div></div>
          </div>

          ${mid ? `<div class="section center">${mid}</div>` : ""}

          <div class="section">
            <div class="values"><div class="label">المبلغ المدفوع</div><div class="bold">${format(tx.paid || tx.price)}</div></div>
          </div>

          <div class="footer">${footer}</div>
        </div>
      </body>
      </html>
    `;

    if (viaBluetooth) {
      // Open print preview and rely on OS/browser to select Bluetooth printer.
      const w = window.open("", "_blank", "width=400,height=600");
      if (!w) return alert("لا يمكن فتح نافذة الطباعة");
      w.document.write(html);
      w.document.close();
      w.focus();
      // show instruction for Bluetooth (many browsers use system dialog)
      setTimeout(() => w.print(), 500);
      return;
    }

    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return alert("لا يمكن فتح نافذة الطباعة");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  function renderTxLog() {
    const container = q("log");
    if (!container) return;
    container.innerHTML = "";
    // ensure transactions are rendered newest -> oldest (by date or id)
    const tx = getTx()
      .slice()
      .sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        const ta = isFinite(da) ? da : a.id || 0;
        const tb = isFinite(db) ? db : b.id || 0;
        return tb - ta;
      });

    tx.forEach((t) => {
      const d = computeDiffForTx(t);
      const paid = Number(t.paid || t.price || 0);
      const amt = Number(t.amount) || 0;
      const tradeProfit = t.type === "buy" ? amt - paid : paid - amt;
      const total = d + tradeProfit;
      const dateStr = (t.date || "").replace("T", " ").slice(0, 19);

      const item = document.createElement("div");
      item.className = "accordion-item";
      item.dataset.id = t.id;
      const header = document.createElement("button");
      header.className = "accordion-header";
      header.type = "button";
      header.innerHTML = `<div class="hdr-left"><span class="phone">${t.phone || t.walletId}</span> <span class="date">${dateStr}</span></div><div class="hdr-right"><span class="type">${displayType(t.type)}</span> <span class="amount">${format(amt)}</span> <span class="paid">${format(paid)}</span> <span class="diff ${tradeProfit >= 0 ? "profit" : "loss"}">${tradeProfit >= 0 ? "+" : ""}${format(tradeProfit)}</span></div>`;

      const body = document.createElement("div");
      body.className = "accordion-body";
      body.innerHTML = `<div>ربح الصفقة: <strong class="${tradeProfit >= 0 ? "profit" : "loss"}">${tradeProfit >= 0 ? "+" : ""}${format(tradeProfit)}</strong> — الصافي: <strong class="${total >= 0 ? "profit" : "loss"}">${total >= 0 ? "+" : ""}${format(total)}</strong></div>`;

      const actions = document.createElement("div");
      actions.className = "accordion-actions";
      const editBtn = document.createElement("button");
      editBtn.textContent = "تعديل";
      editBtn.className = "edit";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startEditTx(t.id);
      });
      const delBtn = document.createElement("button");
      delBtn.textContent = "حذف";
      delBtn.className = "del";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTx(t.id);
      });
      const print80 = document.createElement("button");
      print80.textContent = "طباعة 80mm";
      print80.className = "print80";
      print80.addEventListener("click", (e) => {
        e.stopPropagation();
        printTx(t.id, 80, false);
      });
      const print58 = document.createElement("button");
      print58.textContent = "طباعة 58mm";
      print58.className = "print58";
      print58.addEventListener("click", (e) => {
        e.stopPropagation();
        printTx(t.id, 58, false);
      });
      const printBT = document.createElement("button");
      printBT.textContent = "طباعة بلوتوث";
      printBT.className = "print-bt";
      printBT.addEventListener("click", (e) => {
        e.stopPropagation();
        printTx(t.id, 80, true);
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      actions.appendChild(print80);
      actions.appendChild(print58);
      actions.appendChild(printBT);
      body.appendChild(actions);

      header.addEventListener("click", () => item.classList.toggle("open"));
      item.appendChild(header);
      item.appendChild(body);
      container.appendChild(item);
    });
  }

  function renderWalletSelect() {
    const sel = q("walletSelect");
    if (!sel) return;
    // Prefer persisted wallets (localStorage). Use in-memory getter only when it
    // returns a non-empty array to avoid hiding stored wallets with an empty cache.
    let wallets = getWallets();
    try {
      if (typeof window.__cashy_getWallets === "function") {
        const mem = window.__cashy_getWallets() || [];
        if (Array.isArray(mem) && mem.length > 0) wallets = mem;
      }
    } catch (e) {}
    sel.innerHTML =
      '<option value="">-- اختر --</option>' +
      (Array.isArray(wallets)
        ? wallets
            .map((w) => {
              const bal = Number(w.balance || 0).toFixed(2);
              const main = w.main || "";
              const sub = w.sub ? " • " + w.sub : "";
              return `<option value="${w.id}">${w.phone} • ${main}${sub} • ${bal}</option>`;
            })
            .join("")
        : "");
    // restore previously selected wallet if any
    try {
      const saved = localStorage.getItem(SELECTED_WALLET_KEY);
      if (saved) sel.value = saved;
    } catch (e) {}
    // category filter
    const catSel = q("categoryFilter");
    if (catSel) {
      const rawCats = localStorage.getItem("wallet_categories_v1");
      let cats = [];
      try {
        cats = JSON.parse(rawCats) || [];
      } catch (e) {}
      catSel.innerHTML =
        '<option value="">الكل</option>' +
        cats
          .map((c) => `<option value="${c.name}">${c.name}</option>`)
          .join("");
    }
    // fixed values: render as Bootstrap buttons
    const fixed = getSettings().fixedValues || [];
    const btnContainer = q("fixedValueButtons");
    const fv = q("fixedValueSelect");
    if (btnContainer) {
      btnContainer.innerHTML = "";
      fixed.forEach((f) => {
        const amt = Number(f.amount || 0).toFixed(2);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-outline-primary";
        b.dataset.amount = f.amount;
        b.textContent = `${amt} ج.م`;
        b.addEventListener("click", (e) => {
          // set charged amount
          q("chargedAmount").value = amt;
          // update hidden select for compatibility
          if (fv) fv.value = f.amount;
          // update active styles
          Array.from(btnContainer.children).forEach((c) => {
            c.className = "btn btn-outline-primary";
          });
          b.className = "btn btn-primary";
        });
        btnContainer.appendChild(b);
      });
    }
  }

  function onWalletChange() {
    const id = q("walletSelect").value;
    try {
      localStorage.setItem(SELECTED_WALLET_KEY, id || "");
    } catch (e) {}
    const wallets = getWallets();
    const w = wallets.find((x) => String(x.id) === String(id));
    if (!w) {
      q("selBalance").textContent = "-";
      q("selBuyTotal").textContent = "0.00";
      q("selSellTotal").textContent = "0.00";
      q("selRemaining").textContent = "-";
      q("selProfit").textContent = "0.00";
      return;
    }
    const tx = getTx().filter((t) => String(t.walletId) === String(w.id));
    const buyTotal = tx
      .filter((t) => t.type === "buy")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const sellTotal = tx
      .filter((t) => t.type === "sell")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    q("selBalance").textContent = format(w.balance);
    q("selBuyTotal").textContent = format(buyTotal);
    q("selSellTotal").textContent = format(sellTotal);
    const rem = (Number(w.maxReceive) || 0) - (Number(w.balance) || 0);
    q("selRemaining").textContent = w.maxReceive
      ? format(Math.max(0, rem))
      : "-";
    // compute profit for this wallet from recorded transactions (sum of tradeProfit)
    const walletProfit = tx.reduce(
      (s, t) => s + (Number(t.tradeProfit) || 0),
      0,
    );
    // fallback: if no transactions, compute from balance vs initialBalance
    const profit = tx.length
      ? walletProfit
      : (Number(w.balance) || 0) - (Number(w.initialBalance) || 0);
    q("selProfit").textContent = format(profit);
  }

  async function doAction(type) {
    const walletId = q("walletSelect").value;
    const phone = q("actionPhone").value.trim();
    const amount = Number(q("chargedAmount").value) || 0;
    const paid = Number(q("paidAmount").value) || 0;
    if (!walletId && !phone) return alert("حدد محفظة أو أدخل رقم");
    const wallets = getWallets();
    let wallet = wallets.find((w) => String(w.id) === String(walletId));
    if (!wallet && phone) {
      wallet = wallets.find((w) => (w.phone || "") === phone);
    }
    if (!wallet) {
      return alert("المحفظة غير موجودة");
    }
    if (type === "sell" && (Number(wallet.balance) || 0) < amount)
      return alert("الرصيد لا يكفي للبيع");
    // Prevent buys that would exceed wallet monthly receive limit
    const maxReceive = Number(wallet.maxReceive || 0);
    if (type === "buy" && maxReceive > 0) {
      const currentBalance = Number(wallet.balance || 0);
      if (currentBalance >= maxReceive) {
        return alert(
          "تحذير: وصل الرصيد إلى الحد الأقصى للاستقبال الشهري. لا يمكن تنفيذ شراء جديد.",
        );
      }
      if (currentBalance + amount > maxReceive) {
        return alert(
          "تحذير: تنفيذ هذه العملية سيتجاوز الحد الأقصى للشهر. خفف المبلغ أو عدّل الحد.",
        );
      }
      // daily limit check
      const dailyMax = Number(wallet.dailyMax || 0);
      if (dailyMax > 0) {
        const todayTotal = getTodayBuyTotalForWallet(wallet.id, null);
        if (todayTotal >= dailyMax) {
          return alert(
            "تحذير: وصل مجموع مشتريات اليوم إلى الحد اليومي. لا يمكن تنفيذ شراء جديد.",
          );
        }
        if (todayTotal + amount > dailyMax) {
          return alert(
            "تحذير: تنفيذ هذه العملية سيتجاوز الحد اليومي للمشتريات. خفف المبلغ أو عدّل الحد.",
          );
        }
      }
    }
    // compute diff like example (rounding to nearest 1000)
    const target = Math.round(amount / 1000) * 1000;
    let diff = 0;
    if (type === "buy") diff = target - amount;
    else diff = amount - target;

    // If editing an existing tx, update it by reverting/applying balances
    const tx = getTx();
    let lastTxId = null;
    if (editingTxId) {
      const origIdx = tx.findIndex((t) => t.id === editingTxId);
      if (origIdx === -1) {
        editingTxId = null;
        return alert("المعاملة القديمة غير موجودة");
      }
      const orig = tx[origIdx];
      // revert original wallet effect
      try {
        const origWallet = wallets.find(
          (w) => String(w.id) === String(orig.walletId),
        );
        if (origWallet) {
          if (orig.type === "buy")
            origWallet.balance =
              (Number(origWallet.balance) || 0) - (Number(orig.amount) || 0);
          else
            origWallet.balance =
              (Number(origWallet.balance) || 0) + (Number(orig.amount) || 0);
        }
      } catch (e) {}

      // apply new effect to (possibly different) wallet
      if (type === "buy") {
        // check maxReceive when editing
        const maxReceive = Number(wallet.maxReceive || 0);
        if (
          maxReceive > 0 &&
          Number(wallet.balance || 0) + amount > maxReceive
        ) {
          return alert(
            "تحذير: تنفيذ هذا التعديل سيتجاوز الحد الأقصى للشهر. العملية ملغاة.",
          );
        }
        const dailyMaxEdit = Number(wallet.dailyMax || 0);
        if (dailyMaxEdit > 0) {
          // exclude the original tx if it was a buy today
          const todayTotalExcl = getTodayBuyTotalForWallet(
            wallet.id,
            orig && orig.id,
          );
          if (todayTotalExcl + amount > dailyMaxEdit) {
            return alert(
              "تحذير: تعديل هذه العملية سيتجاوز الحد اليومي للمشتريات. العملية ملغاة.",
            );
          }
        }
        wallet.balance = (Number(wallet.balance) || 0) + amount;
      } else {
        // check sufficiency
        if ((Number(wallet.balance) || 0) < amount) {
          // restore original wallet before abort
          try {
            const origWallet = wallets.find(
              (w) => String(w.id) === String(orig.walletId),
            );
            if (origWallet) {
              if (orig.type === "buy")
                origWallet.balance =
                  (Number(origWallet.balance) || 0) +
                  (Number(orig.amount) || 0);
              else
                origWallet.balance =
                  (Number(origWallet.balance) || 0) -
                  (Number(orig.amount) || 0);
              saveWallets(wallets);
            }
          } catch (e) {}
          return alert("الرصيد لا يكفي للبيع");
        }
        wallet.balance = (Number(wallet.balance) || 0) - amount;
      }
      saveWallets(wallets);

      // update tx object
      const tradeProfit = type === "buy" ? amount - paid : paid - amount;
      tx[origIdx] = Object.assign({}, orig, {
        walletId: wallet.id,
        type: type,
        amount: amount,
        paid: paid,
        phone: phone || wallet.phone,
        date: new Date().toISOString(),
        diff: diff,
        tradeProfit: tradeProfit,
        total: diff + tradeProfit,
      });
      saveTx(tx);
      // sync to daily invoices (update existing or create)
      try {
        syncTxToInvoice(tx[origIdx]);
      } catch (e) {}
      lastTxId = tx[origIdx].id;
      editingTxId = null;
    } else {
      // apply balance change for new tx
      if (type === "buy") {
        // check maxReceive for new transactions
        const maxReceiveNew = Number(wallet.maxReceive || 0);
        if (
          maxReceiveNew > 0 &&
          Number(wallet.balance || 0) + amount > maxReceiveNew
        ) {
          return alert(
            "تحذير: تنفيذ هذه العملية سيتجاوز الحد الأقصى للاستقبال الشهري للمحفظة.",
          );
        }
        const dailyMaxNew = Number(wallet.dailyMax || 0);
        if (dailyMaxNew > 0) {
          const todayTotalNew = getTodayBuyTotalForWallet(wallet.id, null);
          if (todayTotalNew + amount > dailyMaxNew) {
            return alert(
              "تحذير: تنفيذ هذه العملية سيتجاوز الحد اليومي للمشتريات للمحفظة.",
            );
          }
        }
        wallet.balance = (Number(wallet.balance) || 0) + amount;
      } else {
        wallet.balance = (Number(wallet.balance) || 0) - amount;
      }
      saveWallets(wallets);

      // record tx with diff
      const tradeProfit = type === "buy" ? amount - paid : paid - amount;
      const txObj = {
        id: Date.now(),
        walletId: wallet.id,
        type: type,
        amount: amount,
        paid: paid,
        phone: phone || wallet.phone,
        date: new Date().toISOString(),
        diff: diff,
        tradeProfit: tradeProfit,
        total: diff + tradeProfit,
      };
      tx.push(txObj);
      saveTx(tx);
      // sync new tx to daily invoices
      try {
        syncTxToInvoice(txObj);
      } catch (e) {}
      lastTxId = txObj.id;
    }

    // update UI
    computeOverview();
    computeTodayReport();
    renderWalletSelect();
    onWalletChange();
    renderTxLog();

    // prompt to print immediately after action
    try {
      const wantPrint = await swalConfirm(
        "تم تنفيذ العملية. هل تريد طباعة الفاتورة الآن؟",
      );
      if (wantPrint && lastTxId) {
        const size = prompt(
          "اختر حجم الطباعة: اكتب 80 أو 58. اكتب bt للطباعة عبر بلوتوث. تركه فارغ = 80.",
        );
        if (size && String(size).trim().toLowerCase() === "58")
          printTx(lastTxId, 58, false);
        else if (size && String(size).trim().toLowerCase() === "bt")
          printTx(lastTxId, 80, true);
        else printTx(lastTxId, 80, false);
      }
    } catch (e) {}
  }

  function attach() {
    const sel = q("walletSelect");
    if (sel) sel.addEventListener("change", () => onWalletChange());
    // fixed value buttons handle charged amount; hidden select kept for compatibility
    const doBuyBtn = q("doBuy");
    if (doBuyBtn) doBuyBtn.addEventListener("click", () => doAction("buy"));
    const doSellBtn = q("doSell");
    if (doSellBtn) doSellBtn.addEventListener("click", () => doAction("sell"));
    q("categoryFilter")?.addEventListener("change", (e) => {
      const v = e.target.value;
      const wallets = getWallets();
      const sel = q("walletSelect");
      sel.innerHTML =
        '<option value="">-- اختر --</option>' +
        wallets
          .filter((w) => !v || w.main === v)
          .map(
            (w) =>
              `<option value="${w.id}">${w.phone} • ${w.main || ""} ${w.sub ? "• " + w.sub : ""}</option>`,
          )
          .join("");
      // restore saved selection if still available
      try {
        const saved = localStorage.getItem(SELECTED_WALLET_KEY);
        if (saved) sel.value = saved;
      } catch (e) {}
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    // ensure legacy transactions have computed diffs
    normalizeTxs();
    computeOverview();
    computeTodayReport();
    renderWalletSelect();
    renderTxLog();
    attach();
    // snapshot current wallets JSON for polling comparison
    try {
      window.__cashy_lastWalletsJson = localStorage.getItem("wallets_v1") || "";
    } catch (e) {
      window.__cashy_lastWalletsJson = "";
    }
  });

  // expose key functions for console / other pages to call directly
  try {
    window.renderWalletSelect = renderWalletSelect;
    window.onWalletChange = onWalletChange;
    window.computeOverview = computeOverview;
    window.computeTodayReport = computeTodayReport;
  } catch (e) {}

  // react to wallets updated in other scripts (same window)
  try {
    window.addEventListener("walletsUpdated", () => {
      try {
        renderWalletSelect();
        onWalletChange();
        computeOverview();
        computeTodayReport();
      } catch (e) {
        console.error("walletsUpdated handler error", e);
      }
    });
  } catch (e) {}
  // also handle storage events (other tabs/windows)
  try {
    window.addEventListener("storage", (e) => {
      try {
        if (e.key === "wallets_v1") {
          renderWalletSelect();
          onWalletChange();
          computeOverview();
          computeTodayReport();
        }
      } catch (err) {}
    });
  } catch (e) {}
  // Poll localStorage as robust fallback for same-tab updates
  try {
    setInterval(() => {
      try {
        const raw = localStorage.getItem("wallets_v1") || "";
        if (raw !== window.__cashy_lastWalletsJson) {
          window.__cashy_lastWalletsJson = raw;
          renderWalletSelect();
          onWalletChange();
          computeOverview();
          computeTodayReport();
        }
      } catch (e) {}
    }, 2000);
  } catch (e) {}
})();
