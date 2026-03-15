// alert.js — wrapper for SweetAlert2 and Toastr
(function () {
  function loadCss(href) {
    if (!document.querySelector('link[href="' + href + '"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    }
  }

  // ensure css (in case some pages miss adding it in <head>)
  loadCss(
    "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css",
  );
  loadCss(
    "https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css",
  );

  // Wait until libraries are available, otherwise provide simple fallbacks
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    // basic Toast setup for SweetAlert2
    if (window.Swal) {
      window.SwalToast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }

    // Toastr defaults
    if (window.toastr) {
      toastr.options = {
        closeButton: true,
        debug: false,
        newestOnTop: true,
        progressBar: true,
        positionClass: "toast-top-right",
        preventDuplicates: true,
        showDuration: "300",
        hideDuration: "1000",
        timeOut: "3000",
        extendedTimeOut: "1000",
      };
    }
  });

  // Global helpers
  window.showAlert = function (title, text, icon) {
    icon = icon || "info";
    if (window.Swal)
      return Swal.fire({ title: title || "", text: text || "", icon: icon });
    alert((title ? title + "\n" : "") + (text || ""));
  };

  window.showToast = function (message, type) {
    type = (type || "info").toLowerCase();
    if (window.toastr) {
      if (["success", "info", "warning", "error"].includes(type))
        toastr[type](message);
      else toastr.info(message);
      return;
    }
    if (window.SwalToast)
      return SwalToast.fire({
        icon:
          type === "error" ? "error" : type === "success" ? "success" : "info",
        title: message,
      });
    console.log("Toast:", type, message);
  };

  // Override native alert to use SweetAlert2 when available
  (function () {
    var _nativeAlert = window.alert;
    window.alert = function (msg) {
      try {
        if (window.Swal) {
          Swal.fire({ text: String(msg || ""), icon: "info" });
          return;
        }
      } catch (e) {
        // fall through to native
      }
      _nativeAlert(String(msg || ""));
    };
  })();
})();
