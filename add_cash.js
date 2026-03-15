// add_cash.js
(() => {
  // expose a stable global used by inline handlers in the HTML
  try {
    window.showAddWalletModal = function () {
      if (typeof openModal === "function") return openModal();
      if (typeof window.openWalletModal === "function")
        return window.openWalletModal();
      console.warn("showAddWalletModal: modal opener not ready");
    };
  } catch (e) {}
  let mainCat;
  let subCat;
  let phoneSearch;
  let walletCardsContainer;

  let addWalletBtn;
  let walletModal;

  let wPhone;
  let wMainCat;
  let wSubCat;
  let wBranch;
  let wBalance;
  let wMaxReceive;
  let wReminderAmount;
  let wLastCall;
  let wReminderDays;
  let wOwnerName;
  let wOwnerAddress;
  let wOwnerNationalId;
  let wOwnerMobile;
  let wDailyMax;
  let wPurchase;
  let wSold;
  let wSoldDaily;

  let editingId = null;

  let clearFilters;

  // categories will be loaded from Categories.js localStorage key
  let categories = [];

  function makeProxy() {
    return {
      value: "",
      addEventListener() {},
      removeEventListener() {},
      focus() {},
      disabled: false,
      options: { length: 0 },
      selectedIndex: 0,
      style: { display: "" },
    };
  }

  function getElByAny(...ids) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const el = document.getElementById(id);
      if (el) return el;
    }
    return makeProxy();
  }

  // utility: pick first existing property from object using candidate keys
  function pickFirst(obj, names) {
    for (let i = 0; i < names.length; i++) {
      const k = names[i];
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return null;
  }

  function loadCategoriesFromStorage() {
    try {
      const raw = localStorage.getItem("wallet_categories_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      categories = (Array.isArray(parsed) ? parsed : []).map((c) => ({
        id: c.id,
        name: c.name,
        subs: Array.isArray(c.children) ? c.children.map((ch) => ch.name) : [],
      }));
    } catch (e) {
      categories = [];
    }
  }

  // Wallets storage (in-memory). In real app, sync with backend.
  const WALLETS_KEY = "wallets_v1";
  let wallets = [];
  // expose simple getter for debugging in the console
  try {
    window.__cashy_getWallets = function () {
      return wallets;
    };
  } catch (e) {}
  const selectedWallets = new Set();

  function loadWalletsFromStorage() {
    try {
      const raw = localStorage.getItem(WALLETS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) wallets = parsed;
      else {
        // default sample
        wallets = [
          {
            id: 1,
            phone: "01012345678",
            main: "فودافون",
            sub: "فودافون كاش",
            branch: "المنصة",
            balance: 250.5,
            slotInfo: "درج - 01012345678 - فودافون",
            maxReceive: 10000,
            reminderAmount: 200,
            lastCall: "2026-03-01",
            reminderDays: 7,
            owner: {
              name: "أحمد علي",
              address: "القاهرة",
              nationalId: "12345678901234",
              mobile: "01000000000",
            },
            notified: false,
          },
        ];
      }
    } catch (e) {
      wallets = [];
    }
  }

  function saveWalletsToStorage() {
    try {
      const payload = JSON.stringify(wallets);
      // try write
      localStorage.setItem(WALLETS_KEY, payload);
      // verify readback
      const raw = localStorage.getItem(WALLETS_KEY);
      let ok = false;
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        ok = Array.isArray(parsed) && parsed.length === wallets.length;
      } catch (e) {
        ok = false;
      }
      if (ok) {
        console.debug(
          "saveWalletsToStorage: saved",
          WALLETS_KEY,
          wallets.length,
        );
      } else {
        // attempt backup write and surface error
        try {
          localStorage.setItem(WALLETS_KEY + "_backup", payload);
        } catch (be) {
          console.error("saveWalletsToStorage backup write failed", be);
        }
        console.error("saveWalletsToStorage: verification failed after write", {
          key: WALLETS_KEY,
          rawLength: raw && raw.length,
        });
      }
    } catch (e) {
      console.error("saveWalletsToStorage error", e);
    }
    // notify other parts of the app in this window that wallets changed
    try {
      try {
        // dispatch a custom event other scripts can listen to
        window.dispatchEvent(new Event("walletsUpdated"));
      } catch (e) {}
      try {
        // also dispatch a StorageEvent (useful for code listening to 'storage')
        const se = new StorageEvent("storage", {
          key: WALLETS_KEY,
          newValue: payload,
        });
        window.dispatchEvent(se);
      } catch (e) {}
    } catch (e) {}
  }

  function populateMainOptions() {
    loadCategoriesFromStorage();
    // clear existing
    mainCat.innerHTML = '<option value="">الكل</option>';
    wMainCat.innerHTML = "";
    categories.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.name;
      o.textContent = c.name;
      mainCat.appendChild(o.cloneNode(true));
      wMainCat.appendChild(o);
    });
    // populate modal sub for first main
    updateSubOptions(
      wMainCat.value || (categories[0] && categories[0].name) || "",
      wSubCat,
    );
  }

  function updateSubOptions(mainValue, targetSelect) {
    while (targetSelect.firstChild)
      targetSelect.removeChild(targetSelect.firstChild);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "الكل";
    targetSelect.appendChild(empty);
    const cat = categories.find((c) => c.name === mainValue) || categories[0];
    if (!cat || !Array.isArray(cat.subs)) return;
    cat.subs.forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      targetSelect.appendChild(o);
    });
  }

  function renderTable() {
    // render as cards into walletCardsContainer
    console.debug("renderTable: start", { walletCardsContainer });
    const rows = filterWallets();
    if (!walletCardsContainer) {
      console.error("renderTable: walletCardsContainer missing");
      return;
    }
    walletCardsContainer.innerHTML = "";
    console.debug("renderTable: rows count", rows.length);
    try {
      rows.forEach((w) => {
        const card = document.createElement("div");
        card.className = "wallet-card";

        // selection checkbox
        const selWrap = document.createElement("div");
        selWrap.className = "select-wrap";
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "select-wallet";
        chk.dataset.id = w.id;
        chk.checked = selectedWallets.has(w.id);
        chk.addEventListener("change", (e) => {
          const id = Number(e.target.dataset.id);
          if (e.target.checked) selectedWallets.add(id);
          else selectedWallets.delete(id);
          updateSelectedCount();
          const sa = document.getElementById("selectAll");
          if (sa) sa.checked = false;
        });
        selWrap.appendChild(chk);
        card.appendChild(selWrap);

        const head = document.createElement("div");
        head.className = "head";
        const avatar = document.createElement("div");
        avatar.className = "wallet-avatar";
        try {
          avatar.textContent =
            (w.main && String(w.main).trim().charAt(0)) ||
            (w.phone && String(w.phone).slice(-2)) ||
            "ح";
        } catch (e) {
          avatar.textContent = "ح";
        }
        const phoneEl = document.createElement("div");
        phoneEl.className = "phone";
        phoneEl.textContent = w.phone;
        const tag = document.createElement("div");
        tag.className = "tag";
        tag.textContent = w.main || "";
        head.appendChild(avatar);
        head.appendChild(phoneEl);
        head.appendChild(tag);

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `${w.sub || ""} • ${w.branch || ""}`;

        const bal = document.createElement("div");
        bal.className = "balance";
        bal.textContent = Number(w.balance).toFixed(2);

        // per-wallet profit/loss
        const pl = document.createElement("div");
        const initRaw = w.initialBalance;
        const balNum = Number(w.balance) || 0;
        const init =
          initRaw !== undefined && initRaw !== null ? Number(initRaw) : balNum;
        const diff = balNum - (Number.isFinite(init) ? init : balNum);
        pl.className =
          diff > 0
            ? "profit-positive small"
            : diff < 0
              ? "profit-negative small"
              : "small";
        pl.textContent = (diff > 0 ? "+" : "") + diff.toFixed(2) + " ر.ج";

        // helper to pick first existing property from wallet
        function pickFirst(wobj, names) {
          for (let i = 0; i < names.length; i++) {
            const k = names[i];
            if (wobj[k] !== undefined && wobj[k] !== null) return wobj[k];
          }
          return null;
        }

        const maxR = Number(w.maxReceive) || 0;
        const dailyMax = Number(w.dailyMax) || 0;
        const remainingMonthly = maxR > 0 ? Math.max(0, maxR - balNum) : null;
        const remainingDaily =
          dailyMax > 0 ? Math.max(0, dailyMax - balNum) : null;

        // try to find monthly/daily buy/sell aggregates from common property names
        const monthlyBuy =
          Number(
            pickFirst(w, [
              "buyValue",
              "boughtValue",
              "receivedValue",
              "received",
              "buyTotal",
            ]) || 0,
          ) || 0;
        const dailyBuy =
          Number(
            pickFirst(w, [
              "buyDaily",
              "boughtDaily",
              "receivedDaily",
              "buyDailyTotal",
            ]) || 0,
          ) || 0;
        const monthlySell =
          Number(
            pickFirst(w, [
              "soldValue",
              "sellValue",
              "transferredValue",
              "transferred",
            ]) || 0,
          ) || 0;
        const dailySell =
          Number(
            pickFirst(w, ["soldDaily", "sellDaily", "transferredDaily"]) || 0,
          ) || 0;

        // profit (balance - initialBalance)
        const profit = diff;

        // reminders: try to pick specific reminder fields if present
        const reminderBuyMonthly = pickFirst(w, [
          "reminderAmount",
          "reminderBuyMonthly",
          "reminderBuy",
        ]);
        const reminderBuyDaily = pickFirst(w, [
          "reminderAmountDailyconversion",
          "reminderBuyDaily",
          "reminderDaily",
        ]);
        const reminderSellMonthly = pickFirst(w, [
          "reminderSellMonthly",
          "reminderSell",
        ]);
        const reminderSellDaily = pickFirst(w, ["reminderSellDaily"]);

        // compact info rows arranged as requested by the user
        const info = document.createElement("div");
        info.className = "wallet-info";
        info.innerHTML = `
          
          
          <div class="row"><span class="label">الفرع</span><span class="val">${w.branch || "-"}</span></div>
          <div class="row"><span class="label">الرصيد</span><span class="val">${balNum.toFixed(2)}</span></div>
          <div class="row"><span class="label">المتبقي الشهري</span><span class="val">${remainingMonthly === null ? "-" : remainingMonthly.toFixed(2)}</span></div>
          <div class="row"><span class="label">المتبقي اليومي</span><span class="val">${remainingDaily === null ? "-" : remainingDaily.toFixed(2)}</span></div>
          <div class="row"><span class="label">جمع عمليات الشراء (سحب)</span><span class="val">${monthlyBuy.toFixed(2)}</span></div>
          <div class="row"><span class="label">جمع عمليات البيع (تحويل)</span><span class="val">${monthlySell.toFixed(2)}</span></div>
          <div class="row"><span class="label">الأرباح</span><span class="val">${profit.toFixed(2)}</span></div>
          <div class="row"><span class="label">تذكير عند (شراء شهري)</span><span class="val">${reminderBuyMonthly || "-"}</span></div>
          <div class="row"><span class="label">تذكير عند (شراء يومي)</span><span class="val">${reminderBuyDaily || "-"}</span></div>
          <div class="row"><span class="label">تذكير عند (بيع شهري)</span><span class="val">${reminderSellMonthly || "-"}</span></div>
          <div class="row"><span class="label">تذكير عند (بيع يومي)</span><span class="val">${reminderSellDaily || "-"}</span></div>
          <div class="row"><span class="label">آخر مكالمة</span><span class="val">${w.lastCall || "-"}</span></div>
          <div class="row"><span class="label">تذكير بعد (أيام)</span><span class="val">${w.reminderDays || "-"}</span></div>
          <div class="row"><span class="label">مالك المحفظة</span><span class="val">${(w.owner && w.owner.name) || "-"}</span></div>
          <div class="row"><span class="label">عنوان المالك</span><span class="val">${(w.owner && w.owner.address) || "-"}</span></div>
          <div class="row"><span class="label">الرقم القومي</span><span class="val">${(w.owner && w.owner.nationalId) || "-"}</span></div>
          <div class="row"><span class="label">موبايل المالك</span><span class="val">${(w.owner && w.owner.mobile) || "-"}</span></div>
          <div class="row"><span class="label">مكان المحفظة</span><span class="val">${w.slotInfo || "-"}</span></div>
        `;

        // progress towards maxReceive
        const progWrap = document.createElement("div");
        progWrap.className = "progress";

        // add explicit details block for owner and limits
        const details = document.createElement("div");
        details.className = "card-details";
        details.innerHTML = `
          <div class="detail-row"><span class="label">المالك:</span><span class="val">${(w.owner && w.owner.name) || "-"}</span></div>
          <div class="detail-row"><span class="label">مكان الشريحة:</span><span class="val">${w.slotInfo || "-"}</span></div>
          <div class="detail-row"><span class="label">الحد الشهري للشراء:</span><span class="val">${w.maxReceive || "-"}</span></div>
          <div class="detail-row"><span class="label">الحد اليومي:</span><span class="val">${w.dailyMax || "-"}</span></div>
        `;

        const progBar = document.createElement("div");
        progBar.className = "progress-bar";
        const pct = maxR > 0 ? Math.min(100, (balNum / maxR) * 100) : 0;
        progBar.style.width = pct + "%";
        // color thresholds: <=30% green, <=70% yellow, >70% red
        progBar.classList.remove("green", "yellow", "red", "over");
        if (pct <= 30) progBar.classList.add("green");
        else if (pct <= 70) progBar.classList.add("yellow");
        else progBar.classList.add("red");
        // mark 'over' when >=75% to add glow emphasis
        if (pct >= 75) progBar.classList.add("over");
        progWrap.appendChild(progBar);
        // percentage label and optional warning icon
        const progLabel = document.createElement("div");
        progLabel.className = "progress-label";
        progLabel.textContent = Math.round(pct) + "%";
        const warnIcon = document.createElement("div");
        warnIcon.className = "warn-icon small";
        if (pct <= 30) warnIcon.classList.add("green");
        else if (pct <= 70) warnIcon.classList.add("");
        else warnIcon.classList.add("red");
        warnIcon.textContent = pct > 70 ? "!" : "";

        // countdown to next call
        const cdWrap = document.createElement("div");
        cdWrap.className = "countdown";
        const cdBar = document.createElement("div");
        cdBar.className = "count";
        let cdText = "-";
        if (w.lastCall && w.reminderDays) {
          const last = new Date(w.lastCall);
          const next = new Date(
            last.getTime() +
              (Number(w.reminderDays) || 0) * 24 * 60 * 60 * 1000,
          );
          const daysTotal = Number(w.reminderDays) || 0;
          const msLeft = next - new Date();
          const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
          if (msLeft <= 0) {
            cdText = "مطلوب إجراء مكالمة الآن";
            cdBar.style.width = "100%";
            cdBar.classList.remove("green", "yellow", "red");
            cdBar.classList.add("red");
          } else {
            cdText = daysLeft + " يوم";
            const elapsed = daysTotal > 0 ? daysTotal - daysLeft : 0;
            const pctCd =
              daysTotal > 0 ? Math.min(100, (elapsed / daysTotal) * 100) : 0;
            cdBar.style.width = pctCd + "%";
            cdBar.classList.remove("green", "yellow", "red");
            if (pctCd <= 30) cdBar.classList.add("green");
            else if (pctCd <= 70) cdBar.classList.add("yellow");
            else cdBar.classList.add("red");
          }
        }
        cdWrap.appendChild(cdBar);

        const smalls = document.createElement("div");
        smalls.className = "small";
        smalls.innerHTML = `آخر مكالمة: ${w.lastCall || "-"} • ${cdText}<br>مالك: ${w.owner?.name || "-"}`;

        const actions = document.createElement("div");
        actions.className = "actions";
        const btnView = document.createElement("button");
        btnView.className = "btn small";
        btnView.textContent = "عرض";
        btnView.addEventListener("click", () => openViewModal(w));
        const btnEdit = document.createElement("button");
        btnEdit.className = "btn small success";
        btnEdit.textContent = "تعديل";
        btnEdit.addEventListener("click", () => openEditModal(w));
        const btnDelete = document.createElement("button");
        btnDelete.className = "btn small danger";
        btnDelete.textContent = "حذف";
        btnDelete.addEventListener("click", async () => {
          if (
            !(await swalConfirm(
              "هل أنت متأكد من حذف هذه المحفظة؟ نعم لحذف، لا لإلغاء",
            ))
          )
            return;
          const idx = wallets.findIndex((x) => x.id === w.id);
          if (idx >= 0) {
            wallets.splice(idx, 1);
            saveWalletsToStorage();
          }
          renderTable();
        });
        actions.appendChild(btnView);
        actions.appendChild(btnEdit);
        actions.appendChild(btnDelete);

        card.appendChild(head);
        card.appendChild(meta);
        card.appendChild(bal);
        // user-requested ordered info block
        card.appendChild(info);
        const progRow = document.createElement("div");
        progRow.className = "progress-wrap";
        progRow.appendChild(progLabel);
        progRow.appendChild(progWrap);
        progRow.appendChild(warnIcon);
        card.appendChild(progRow);
        card.appendChild(cdWrap);
        card.appendChild(pl);
        card.appendChild(smalls);
        card.appendChild(actions);

        walletCardsContainer.appendChild(card);
      });
    } catch (e) {
      console.error("renderTable: items render error", e);
    }

    // update analytics after rendering
    computeAnalytics();
  }

  function filterWallets() {
    const phone = phoneSearch.value.trim();
    const m = mainCat.value;
    const s = subCat.value;
    return wallets.filter((w) => {
      if (phone && !w.phone.includes(phone)) return false;
      if (m && w.main !== m) return false;
      if (s && w.sub !== s) return false;
      return true;
    });
  }

  function openModal() {
    if (!walletModal) walletModal = document.getElementById("walletModal");
    if (!walletModal) {
      console.warn("openModal: walletModal not found when attempting to open");
      return;
    }
    console.debug("openModal() called - walletModal:", walletModal);
    walletModal.classList.remove("hidden");
    walletModal.style.display = "flex";
  }

  function openEditModal(wallet) {
    if (!wallet) return;
    editingId = wallet.id;
    // prefill modal fields
    wPhone.value = wallet.phone || "";
    wMainCat.value = wallet.main || "";
    updateSubOptions(wMainCat.value, wSubCat);
    wSubCat.value = wallet.sub || "";
    wBranch.value = wallet.branch || "";
    wBalance.value = wallet.balance || "";
    wPurchase.value = wallet.slotInfo || "";
    wSold.value = wallet.soldValue || "";
    wMaxReceive.value = wallet.maxReceive || "";
    wDailyMax.value = wallet.dailyMax || "";
    wReminderAmount.value = wallet.reminderAmount || "";
    wLastCall.value = wallet.lastCall || "";
    wReminderDays.value = wallet.reminderDays || "";
    wOwnerName.value = wallet.owner?.name || "";
    wOwnerAddress.value = wallet.owner?.address || "";
    wOwnerNationalId.value = wallet.owner?.nationalId || "";
    wOwnerMobile.value = wallet.owner?.mobile || "";
    openModal();
    // ensure inputs enabled and save button visible
    Array.from(
      document.querySelectorAll("#walletForm input,#walletForm select"),
    ).forEach((i) => (i.disabled = false));
    const saveBtn = document.getElementById("saveWallet");
    if (saveBtn) saveBtn.style.display = "inline-block";
  }

  function openViewModal(wallet) {
    if (!wallet) return;
    editingId = null;
    // prefill modal fields
    wPhone.value = wallet.phone || "";
    wMainCat.value = wallet.main || "";
    updateSubOptions(wMainCat.value, wSubCat);
    wSubCat.value = wallet.sub || "";
    wBranch.value = wallet.branch || "";
    wBalance.value = wallet.balance || "";
    wPurchase.value = wallet.slotInfo || "";
    wSold.value = wallet.soldValue || "";
    wMaxReceive.value = wallet.maxReceive || "";
    wDailyMax.value = wallet.dailyMax || "";
    wReminderAmount.value = wallet.reminderAmount || "";
    wLastCall.value = wallet.lastCall || "";
    wReminderDays.value = wallet.reminderDays || "";
    wOwnerName.value = wallet.owner?.name || "";
    wOwnerAddress.value = wallet.owner?.address || "";
    wOwnerNationalId.value = wallet.owner?.nationalId || "";
    wOwnerMobile.value = wallet.owner?.mobile || "";
    openModal();
    // disable inputs and hide save
    Array.from(
      document.querySelectorAll("#walletForm input,#walletForm select"),
    ).forEach((i) => (i.disabled = true));
    const saveBtn = document.getElementById("saveWallet");
    if (saveBtn) saveBtn.style.display = "none";
  }
  function closeModal() {
    if (!walletModal) walletModal = document.getElementById("walletModal");
    if (!walletModal) return;
    walletModal.classList.add("hidden");
    try {
      walletModal.style.display = "none";
      walletModal.setAttribute("aria-hidden", "true");
      // also remove 'open' attribute if any
      walletModal.removeAttribute("open");
    } catch (e) {}
    walletFormReset();
  }

  function walletFormReset() {
    wPhone.value = "";
    wBranch.value = "";
    wBalance.value = "";
    wMaxReceive.value = "";
    wReminderAmount.value = "";
    wLastCall.value = "";
    wReminderDays.value = "";
    if (wPurchase) wPurchase.value = "";
    wOwnerName.value = "";
    wOwnerAddress.value = "";
    wOwnerNationalId.value = "";
    wOwnerMobile.value = "";
    if (wMainCat.options.length) wMainCat.selectedIndex = 0;
    updateSubOptions(
      wMainCat.value || (categories[0] && categories[0].name) || "",
      wSubCat,
    );
    // ensure inputs are enabled and save button visible when form closed/reset
    Array.from(
      document.querySelectorAll("#walletForm input,#walletForm select"),
    ).forEach((i) => (i.disabled = false));
    const saveBtn = document.getElementById("saveWallet");
    if (saveBtn) saveBtn.style.display = "inline-block";
    editingId = null;
  }

  function validatePhone(value) {
    const digits = value.replace(/\D/g, "");
    // Allow wallet numbers of length 1..40 digits
    return digits.length >= 1 && digits.length <= 40;
  }

  function saveWalletHandler() {
    console.debug("saveWalletHandler: start", { editingId });
    if (!wPhone) {
      console.error("saveWalletHandler: wPhone element missing");
      return;
    }
    console.debug("saveWalletHandler: form values", {
      wPhone: wPhone && wPhone.value,
      wMainCat: wMainCat && wMainCat.value,
      wSubCat: wSubCat && wSubCat.value,
      wBalance: wBalance && wBalance.value,
    });
    const phoneVal = (wPhone.value || "").replace(/\D/g, "");
    if (!validatePhone(phoneVal)) {
      alert("من فضلك أدخل رقم هاتف صحيح مكون من 11 رقم");
      wPhone.focus();
      return;
    }
    if (editingId) {
      // update existing
      const found = wallets.find((w) => w.id === editingId);
      if (found) {
        found.phone = phoneVal;
        found.main = wMainCat.value || "";
        found.sub = wSubCat.value || "";
        found.branch = wBranch.value || "";
        found.balance = Number(wBalance.value) || 0;
        // keep initialBalance unless user changes it explicitly (if not set, set now)
        if (found.initialBalance === undefined || found.initialBalance === null)
          found.initialBalance = found.balance;
        found.slotInfo = wPurchase.value || "";
        found.soldValue = Number(wSold.value) || 0;
        found.soldDaily = Number(wSoldDaily?.value) || 0;
        found.maxReceive = Number(wMaxReceive.value) || 0;
        found.dailyMax = Number(wDailyMax.value) || 0;
        found.reminderAmount = Number(wReminderAmount.value) || 0;
        // reset reminder notification flags when editing thresholds
        found.reminderBuyMonthlyNotified = false;
        found.reminderBuyDailyNotified = false;
        found.reminderSellMonthlyNotified = false;
        found.reminderSellDailyNotified = false;
        found.reminderCallNotified = false;
        found.lastCall = wLastCall.value || "";
        found.reminderDays = Number(wReminderDays.value) || 0;
        found.owner = {
          name: wOwnerName.value || "",
          address: wOwnerAddress.value || "",
          nationalId: wOwnerNationalId.value || "",
          mobile: wOwnerMobile.value || "",
        };
        saveWalletsToStorage();
      }
      editingId = null;
      renderTable();
      closeModal();
      return;
    }

    const wallet = {
      id: Date.now(),
      phone: phoneVal,
      main: wMainCat.value || "",
      sub: wSubCat.value || "",
      branch: wBranch.value || "",
      balance: Number(wBalance.value) || 0,
      initialBalance: Number(wBalance.value) || 0,
      slotInfo: wPurchase.value || "",
      soldValue: Number(wSold.value) || 0,
      soldDaily: Number(wSoldDaily?.value) || 0,
      maxReceive: Number(wMaxReceive.value) || 0,
      dailyMax: Number(wDailyMax.value) || 0,
      reminderAmount: Number(wReminderAmount.value) || 0,
      lastCall: wLastCall.value || "",
      reminderDays: Number(wReminderDays.value) || 0,
      owner: {
        name: wOwnerName.value || "",
        address: wOwnerAddress.value || "",
        nationalId: wOwnerNationalId.value || "",
        mobile: wOwnerMobile.value || "",
      },
      notified: false,
      reminderBuyMonthlyNotified: false,
      reminderBuyDailyNotified: false,
      reminderSellMonthlyNotified: false,
      reminderSellDailyNotified: false,
      reminderCallNotified: false,
    };

    wallets.push(wallet);
    console.debug("saveWalletHandler: wallets before push", wallets.length - 1);
    saveWalletsToStorage();
    console.debug(
      "saveWalletHandler: after save, wallets.length",
      wallets.length,
      "walletCardsContainer=",
      !!walletCardsContainer,
    );
    try {
      const raw = localStorage.getItem(WALLETS_KEY);
      console.debug("saveWalletHandler: saved raw length", raw && raw.length);
      const parsed = raw ? JSON.parse(raw) : null;
      console.debug(
        "saveWalletHandler: saved wallets count readback",
        Array.isArray(parsed) ? parsed.length : typeof parsed,
        parsed && parsed[parsed.length - 1],
      );
    } catch (e) {
      console.error("saveWalletHandler: readback error", e);
    }
    console.debug("saveWalletHandler: wallet pushed", wallet.id);
    // force render and close; also schedule a deferred render to work around any timing issues
    try {
      renderTable();
    } catch (e) {
      console.error("renderTable error immediate", e);
    }
    setTimeout(() => {
      try {
        renderTable();
      } catch (e) {
        console.error("renderTable error deferred", e);
      }
      try {
        closeModal();
      } catch (e) {
        console.error("closeModal error deferred", e);
      }
    }, 60);
    alert("تم حفظ المحفظة بنجاح");
  }

  // compute analytics based on current filtered wallets
  function computeAnalytics() {
    const rows = filterWallets();
    const count = rows.length;
    const total = rows.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    const profit = rows.reduce((s, r) => {
      const bal = Number(r.balance) || 0;
      const initRaw = r.initialBalance;
      const init =
        initRaw !== undefined && initRaw !== null ? Number(initRaw) : bal;
      const initSafe = Number.isFinite(init) ? init : bal;
      return s + (bal - initSafe);
    }, 0);

    // determine risk reasons per wallet including buy/sell monthly/daily thresholds
    const risky = rows
      .map((r) => {
        const reasons = [];
        const bal = Number(r.balance) || 0;

        // 1) low balance vs reminderAmount
        if (
          r.reminderAmount &&
          Number(r.reminderAmount) > 0 &&
          bal <= Number(r.reminderAmount)
        ) {
          reasons.push("وصل لحد التذكير بالرصيد");
        }

        // 2) reached monthly receive cap
        if (
          r.maxReceive !== undefined &&
          r.maxReceive !== null &&
          Number.isFinite(Number(r.maxReceive))
        ) {
          if (bal >= Number(r.maxReceive)) {
            reasons.push("وصل للحد الأقصى للاستقبال");
          }
        }

        // 3) last call overdue
        if (r.lastCall && r.reminderDays) {
          const last = new Date(r.lastCall);
          const next = new Date(
            last.getTime() +
              (Number(r.reminderDays) || 0) * 24 * 60 * 60 * 1000,
          );
          if (new Date() >= next) reasons.push("مطلوب إجراء مكالمة");
        }

        // 4) monthly/daily buy and sell aggregates vs thresholds (use pickFirst fallbacks)
        const monthlyBuy = Number(
          pickFirst(r, [
            "buyValue",
            "boughtValue",
            "receivedValue",
            "received",
            "buyTotal",
          ]) || 0,
        );
        const dailyBuy = Number(
          pickFirst(r, [
            "buyDaily",
            "boughtDaily",
            "receivedDaily",
            "buyDailyTotal",
          ]) || 0,
        );
        const monthlySell = Number(
          pickFirst(r, [
            "soldValue",
            "sellValue",
            "transferredValue",
            "transferred",
          ]) || 0,
        );
        const dailySell = Number(
          pickFirst(r, ["soldDaily", "sellDaily", "transferredDaily"]) || 0,
        );

        const thresholdBuyMonthly = Number(
          pickFirst(r, [
            "reminderBuyMonthly",
            "reminderAmount",
            "reminderMonthlydrawal",
            "reminderMonthlytransfer",
          ]) || 0,
        );
        if (thresholdBuyMonthly > 0 && monthlyBuy >= thresholdBuyMonthly) {
          reasons.push("وصل لحد التذكير للشراء الشهري");
        }

        const thresholdBuyDaily = Number(
          pickFirst(r, [
            "reminderBuyDaily",
            "reminderAmountDailyconversion",
            "reminderDaily",
          ]) || 0,
        );
        if (thresholdBuyDaily > 0 && dailyBuy >= thresholdBuyDaily) {
          reasons.push("وصل لحد التذكير للشراء اليومي");
        }

        const thresholdSellMonthly = Number(
          pickFirst(r, ["reminderSellMonthly", "reminderSell"]) || 0,
        );
        if (thresholdSellMonthly > 0 && monthlySell >= thresholdSellMonthly) {
          reasons.push("وصل لحد التذكير للبيع الشهري");
        }

        const thresholdSellDaily = Number(
          pickFirst(r, ["reminderSellDaily", "reminderDaily"]) || 0,
        );
        if (thresholdSellDaily > 0 && dailySell >= thresholdSellDaily) {
          reasons.push("وصل لحد التذكير للبيع اليومي");
        }

        return { wallet: r, reasons };
      })
      .filter((x) => x.reasons.length > 0);

    const elCount = document.getElementById("walletCount");
    const elTotal = document.getElementById("totalBalance");
    const elPL = document.getElementById("profitLoss");
    const elRiskCount = document.getElementById("riskCount");
    const riskContainer = document.getElementById("riskContainer");

    if (elCount) elCount.textContent = count;
    if (elTotal) elTotal.textContent = total.toFixed(2);
    if (elPL) {
      if (profit > 0) {
        elPL.textContent = "+" + profit.toFixed(2);
        elPL.classList.add("profit-positive");
        elPL.classList.remove("profit-negative");
      } else if (profit < 0) {
        elPL.textContent = profit.toFixed(2);
        elPL.classList.add("profit-negative");
        elPL.classList.remove("profit-positive");
      } else {
        elPL.textContent = "0.00";
        elPL.classList.remove("profit-negative");
        elPL.classList.remove("profit-positive");
      }
    }
    if (elRiskCount) elRiskCount.textContent = risky.length;

    if (!riskContainer) return;
    if (risky.length === 0) {
      riskContainer.textContent = "لا توجد محافظ خطرة";
      return;
    }
    riskContainer.innerHTML = "";
    risky.forEach((item) => {
      const r = item.wallet;
      const reasons = item.reasons;
      const div = document.createElement("div");
      div.className = "risk-row";
      const left = document.createElement("div");
      left.innerHTML = `<div class="phone">${r.phone}</div><div class="muted">${r.main} • ${r.sub || ""}</div><div class="reason">سبب: ${reasons.join(" • ")}</div>`;
      const right = document.createElement("div");
      right.innerHTML = `<div>${Number(r.balance).toFixed(2)}</div>`;
      div.appendChild(left);
      div.appendChild(right);
      riskContainer.appendChild(div);
    });
  }

  // selection helpers
  function updateSelectedCount() {
    const el = document.getElementById("selectedCount");
    if (!el) return;
    el.textContent = `${selectedWallets.size} محدد`;
  }

  async function zeroSelected() {
    if (selectedWallets.size === 0) return alert("لم يتم تحديد أي محفظة");
    if (!(await swalConfirm("هل تريد تصفير الرصيد للمحافظ المحددة؟"))) return;
    wallets.forEach((w) => {
      if (selectedWallets.has(w.id)) {
        w.balance = 0;
      }
    });
    saveWalletsToStorage();
    renderTable();
    updateSelectedCount();
    alert("تم تصفير المحافظ المحددة");
  }

  async function zeroAll() {
    if (!(await swalConfirm("هل تريد تصفير جميع المحافظ؟"))) return;
    wallets.forEach((w) => (w.balance = 0));
    saveWalletsToStorage();
    renderTable();
    selectedWallets.clear();
    updateSelectedCount();
    alert("تم تصفير جميع المحافظ");
  }

  // Periodic reminder check (every 60s). Marks notification flags and saves once.
  function checkReminders() {
    let changed = false;
    wallets.forEach((w) => {
      try {
        // 1) Monthly buy reminder (تذكير عند (شراء شهري))
        const monthlyBuy = Number(
          pickFirst(w, [
            "buyValue",
            "boughtValue",
            "receivedValue",
            "received",
            "buyTotal",
            "monthlyBuy",
          ]) || 0,
        );
        const thresholdBuyMonthly = Number(
          pickFirst(w, [
            "reminderBuyMonthly",
            "reminderAmount",
            "reminderMonthlydrawal",
            "reminderMonthlytransfer",
          ]) || 0,
        );
        if (
          thresholdBuyMonthly > 0 &&
          monthlyBuy >= thresholdBuyMonthly &&
          !w.reminderBuyMonthlyNotified
        ) {
          alert(
            `تنبيه: المحفظة ${w.phone} وصلت إلى حد شراء شهري ${thresholdBuyMonthly} (الاجمالي: ${monthlyBuy.toFixed(2)})`,
          );
          w.reminderBuyMonthlyNotified = true;
          changed = true;
        }

        // 2) Daily buy reminder (تذكير عند (شراء يومي))
        const dailyBuy = Number(
          pickFirst(w, [
            "buyDaily",
            "boughtDaily",
            "receivedDaily",
            "buyDailyTotal",
            "dailyBuy",
          ]) || 0,
        );
        const thresholdBuyDaily = Number(
          pickFirst(w, [
            "reminderBuyDaily",
            "reminderAmountDailyconversion",
            "reminderDaily",
          ]) || 0,
        );
        if (
          thresholdBuyDaily > 0 &&
          dailyBuy >= thresholdBuyDaily &&
          !w.reminderBuyDailyNotified
        ) {
          alert(
            `تنبيه: المحفظة ${w.phone} وصلت إلى حد شراء يومي ${thresholdBuyDaily} (الاجمالي اليومي: ${dailyBuy.toFixed(2)})`,
          );
          w.reminderBuyDailyNotified = true;
          changed = true;
        }

        // 3) Monthly sell reminder (تذكير عند (بيع شهري))
        const monthlySell = Number(
          pickFirst(w, [
            "soldValue",
            "sellValue",
            "transferredValue",
            "transferred",
            "monthlySell",
          ]) || 0,
        );
        const thresholdSellMonthly = Number(
          pickFirst(w, [
            "reminderSellMonthly",
            "reminderSell",
            "reminderAmount",
          ]) || 0,
        );
        if (
          thresholdSellMonthly > 0 &&
          monthlySell >= thresholdSellMonthly &&
          !w.reminderSellMonthlyNotified
        ) {
          alert(
            `تنبيه: المحفظة ${w.phone} وصلت إلى حد بيع شهري ${thresholdSellMonthly} (الاجمالي: ${monthlySell.toFixed(2)})`,
          );
          w.reminderSellMonthlyNotified = true;
          changed = true;
        }

        // 4) Daily sell reminder (تذكير عند (بيع يومي))
        const dailySell = Number(
          pickFirst(w, [
            "soldDaily",
            "sellDaily",
            "transferredDaily",
            "dailySell",
          ]) || 0,
        );
        const thresholdSellDaily = Number(
          pickFirst(w, ["reminderSellDaily", "reminderDaily"]) || 0,
        );
        if (
          thresholdSellDaily > 0 &&
          dailySell >= thresholdSellDaily &&
          !w.reminderSellDailyNotified
        ) {
          alert(
            `تنبيه: المحفظة ${w.phone} وصلت إلى حد بيع يومي ${thresholdSellDaily} (الاجمالي اليومي: ${dailySell.toFixed(2)})`,
          );
          w.reminderSellDailyNotified = true;
          changed = true;
        }

        // 5) Last-call reminder (تذكير بعد (أيام)) — only if both values provided
        if (w.reminderDays && w.lastCall) {
          const last = new Date(w.lastCall);
          const next = new Date(
            last.getTime() +
              (Number(w.reminderDays) || 0) * 24 * 60 * 60 * 1000,
          );
          const today = new Date();
          if (today >= next && !w.reminderCallNotified) {
            alert(`تذكير: موعد متابعة المحفظة ${w.phone}`);
            w.reminderCallNotified = true;
            // also set legacy flag used elsewhere
            w.reminderNotified = true;
            changed = true;
          }
        }
      } catch (e) {
        console.error("checkReminders item error", e);
      }
    });
    if (changed) saveWalletsToStorage();
  }

  // Event wiring
  function attachEvents() {
    try {
      if (phoneSearch)
        phoneSearch.addEventListener("input", () => renderTable());
      else console.warn("attachEvents: phoneSearch not found");
      if (mainCat)
        mainCat.addEventListener("change", () => {
          updateSubOptions(mainCat.value, subCat);
          renderTable();
        });
      else console.warn("attachEvents: mainCat not found");
      if (subCat) subCat.addEventListener("change", renderTable);
      else console.warn("attachEvents: subCat not found");

      if (clearFilters)
        clearFilters.addEventListener("click", () => {
          if (phoneSearch) phoneSearch.value = "";
          if (mainCat) mainCat.value = "";
          updateSubOptions(
            (mainCat && mainCat.value) ||
              (categories[0] && categories[0].name) ||
              "",
            subCat,
          );
          if (subCat) subCat.value = "";
          renderTable();
        });
      else console.warn("attachEvents: clearFilters not found");
    } catch (e) {
      console.error("attachEvents initial wiring error", e);
    }

    // ensure we have latest reference to add button
    try {
      const btn = document.getElementById("addWalletBtn") || addWalletBtn;
      if (btn) {
        btn.addEventListener("click", (ev) => {
          try {
            ev.preventDefault && ev.preventDefault();
          } catch (e) {}
          console.debug("#addWalletBtn click handler fired (direct)");
          openModal();
        });
      } else {
        console.warn("addWalletBtn not found — using delegated click fallback");
        document.addEventListener("click", (e) => {
          const dbtn =
            e.target && e.target.closest && e.target.closest("#addWalletBtn");
          if (dbtn) {
            try {
              e.preventDefault && e.preventDefault();
            } catch (e) {}
            console.debug("#addWalletBtn click handler fired (delegated)");
            openModal();
          }
        });
      }
    } catch (e) {
      console.error("attachEvents addWalletBtn wiring error", e);
    }

    try {
      const modalCloseBtn = document.getElementById("modalClose");
      const closeWalletBtn = document.getElementById("closeWallet");
      const saveWalletBtn = document.getElementById("saveWallet");
      if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
      else console.warn("modalClose not found");
      if (closeWalletBtn) closeWalletBtn.addEventListener("click", closeModal);
      else console.warn("closeWallet not found");
      if (saveWalletBtn)
        saveWalletBtn.addEventListener("click", saveWalletHandler);
      else console.warn("saveWallet not found");
    } catch (e) {
      console.error("attachEvents modal buttons wiring error", e);
    }

    try {
      if (walletModal) {
        walletModal.addEventListener("click", (e) => {
          if (e.target === walletModal) closeModal();
        });
      } else console.warn("attachEvents: walletModal not found");
    } catch (e) {
      console.error("attachEvents walletModal overlay error", e);
    }

    // delegated fallback for close button if direct listener not attached
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("#closeWallet");
      if (btn) closeModal();
    });
    // delegated fallback for save button (ensures handler works even if direct wiring failed)
    document.addEventListener("click", (e) => {
      const s = e.target.closest && e.target.closest("#saveWallet");
      if (s) {
        try {
          e.preventDefault && e.preventDefault();
        } catch (ex) {}
        console.debug("#saveWallet clicked (delegated)");
        try {
          saveWalletHandler();
        } catch (err) {
          console.error("saveWalletHandler error", err);
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    try {
      const zeroSelectedBtn = document.getElementById("zeroSelectedBtn");
      const zeroAllBtn = document.getElementById("zeroAllBtn");
      const selectAll = document.getElementById("selectAll");
      if (zeroSelectedBtn)
        zeroSelectedBtn.addEventListener("click", zeroSelected);
      if (zeroAllBtn) zeroAllBtn.addEventListener("click", zeroAll);
      if (selectAll)
        selectAll.addEventListener("change", (e) => {
          selectedWallets.clear();
          if (e.target.checked) {
            // select all currently visible wallets
            filterWallets().forEach((w) => selectedWallets.add(w.id));
          }
          // re-render to update checkboxes
          renderTable();
          updateSelectedCount();
        });
    } catch (e) {
      console.error("attachEvents bulk actions wiring error", e);
    }

    try {
      if (wMainCat)
        wMainCat.addEventListener("change", () =>
          updateSubOptions(wMainCat.value, wSubCat),
        );
      else console.warn("attachEvents: wMainCat not found");
    } catch (e) {
      console.error("attachEvents wMainCat error", e);
    }

    try {
      if (wPhone)
        wPhone.addEventListener("input", () => {
          wPhone.value = wPhone.value.replace(/\D/g, "").slice(0, 40);
        });
      else console.warn("attachEvents: wPhone not found");
      if (phoneSearch)
        phoneSearch.addEventListener("input", () => {
          phoneSearch.value = phoneSearch.value.replace(/[^0-9]/g, "");
        });
    } catch (e) {
      console.error("attachEvents input handlers error", e);
    }
  }

  // Initialize
  function init() {
    // theme handling removed
    // query DOM elements (ensure script can be loaded anywhere)
    mainCat = document.getElementById("mainCat");
    subCat = document.getElementById("subCat");
    phoneSearch = document.getElementById("phoneSearch");
    walletCardsContainer = document.getElementById("walletCards");
    addWalletBtn = document.getElementById("addWalletBtn");
    walletModal = document.getElementById("walletModal");
    console.debug(
      "init(): addWalletBtn=",
      addWalletBtn,
      "walletModal=",
      walletModal,
    );
    wPhone = getElByAny("wPhone", "wbank");
    wMainCat = getElByAny("wMainCat");
    wSubCat = getElByAny("wSubCat");
    wBranch = getElByAny("wBranch");
    wBalance = getElByAny("wBalance");
    wMaxReceive = getElByAny("wMaxReceive");
    // reminder amount may have different ids in the form; prefer monthly withdrawal
    wReminderAmount = getElByAny(
      "wReminderAmount",
      "wReminderMonthlydrawal",
      "wReminderMonthlytransfer",
      "wReminderAmountDailyconversion",
    );
    wLastCall = getElByAny("wLastCall");
    wReminderDays = getElByAny("wReminderDays");
    wOwnerName = getElByAny("wOwnerName");
    wOwnerAddress = getElByAny("wOwnerAddress");
    wOwnerNationalId = getElByAny("wOwnerNationalId");
    wOwnerMobile = getElByAny("wOwnerMobile");
    wDailyMax = getElByAny("wDailyMax");
    wPurchase = getElByAny("wPurchase", "wOwnerwalletlocation");
    wSold = getElByAny("wSold");
    wSoldDaily = getElByAny("wSoldDaily");
    clearFilters = document.getElementById("clearFilters");

    loadCategoriesFromStorage();
    populateMainOptions();
    // Ensure wallets are not persisted in localStorage — remove any legacy keys
    // load wallets from storage (persistent)
    loadWalletsFromStorage();
    // initial subcat for filter
    updateSubOptions(
      mainCat.value || (categories[0] && categories[0].name) || "",
      subCat,
    );
    renderTable();
    attachEvents();
    // expose quick global opener for debugging / inline handlers
    try {
      window.openWalletModal = openModal;
      window.openModalDebug = openModal;
    } catch (e) {}
    try {
      window.saveWallet = saveWalletHandler;
      window.checkReminders = checkReminders;
    } catch (e) {}
    // ensure modal is hidden on init — only open via `#addWalletBtn` or explicit edit/view
    if (!walletModal) walletModal = document.getElementById("walletModal");
    if (walletModal) {
      walletModal.classList.add("hidden");
      walletModal.style.display = "none";
    }
    // check reminders every minute
    setInterval(checkReminders, 60 * 1000);

    // react to category changes from other tabs/pages
    window.addEventListener("storage", (e) => {
      if (e.key === "wallet_categories_v1") {
        loadCategoriesFromStorage();
        populateMainOptions();
        updateSubOptions(
          mainCat.value || (categories[0] && categories[0].name) || "",
          subCat,
        );
        renderTable();
      }
      // react to wallets or overall storage clear
      else if (e.key === WALLETS_KEY) {
        loadWalletsFromStorage();
        renderTable();
        computeAnalytics();
      } else if (e.key === null) {
        // localStorage.clear() in another tab — reload all
        loadCategoriesFromStorage();
        populateMainOptions();
        loadWalletsFromStorage();
        updateSubOptions(
          mainCat.value || (categories[0] && categories[0].name) || "",
          subCat,
        );
        renderTable();
      }
    });
  }

  /* Theme handling removed */

  // Kickoff — ensure init runs even if script is executed after DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already ready
    setTimeout(init, 0);
  }

  // Install capturing delegated handlers to ensure save/close clicks reach our handlers
  (function installCaptureDelegates() {
    if (window.__cashy_capture_delegates_installed) return;
    window.__cashy_capture_delegates_installed = true;
    document.addEventListener(
      "click",
      function (e) {
        try {
          const s =
            e.target && e.target.closest && e.target.closest("#saveWallet");
          if (s) {
            try {
              e.preventDefault && e.preventDefault();
            } catch (ex) {}
            console.debug("capture: #saveWallet clicked (capture)");
            try {
              saveWalletHandler();
            } catch (err) {
              console.error("saveWalletHandler error (capture)", err);
            }
            e.stopPropagation && e.stopPropagation();
            return;
          }
          const c =
            e.target && e.target.closest && e.target.closest("#closeWallet");
          if (c) {
            try {
              e.preventDefault && e.preventDefault();
            } catch (ex) {}
            console.debug("capture: #closeWallet clicked (capture)");
            try {
              closeModal();
            } catch (err) {
              console.error("closeModal error (capture)", err);
            }
            e.stopPropagation && e.stopPropagation();
            return;
          }
        } catch (e) {
          console.error("capture delegate error", e);
        }
      },
      true,
    );
  })();
})();
