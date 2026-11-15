/*!
 * Modül Commercial Multi-Tenant 3D Configurator Embed SDK v1.0
 * Usage:
 *   <div id="modul-configurator-mount"></div>
 *   <script src="https://app.modul.studio/sdk/v1/embed.js" data-tenant="anka" data-currency="TRY" async></script>
 */
(function (global) {
  "use strict";

  function resolvePlatformOrigin(scriptEl) {
    if (scriptEl && scriptEl.src) {
      try {
        return new URL(scriptEl.src).origin;
      } catch (_e) {}
    }
    return global.location ? global.location.origin : "https://app.modul.studio";
  }

  function mountConfigurator(options) {
    var opts = options || {};
    var tenantSlug = String(opts.tenant || "birim").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "birim";
    var currency = String(opts.currency || "TRY").toUpperCase();
    var targetSelector = opts.mountId || "modul-configurator-mount";
    var container =
      typeof opts.container === "object" && opts.container
        ? opts.container
        : global.document.getElementById(targetSelector);

    if (!container) {
      throw new Error("[ModulEmbedSDK] Mount element not found: #" + targetSelector);
    }

    var origin = opts.origin || resolvePlatformOrigin(opts.scriptEl);
    var iframeUrl =
      origin.replace(/\/+$/, "") +
      "/embed/" +
      encodeURIComponent(tenantSlug) +
      "?currency=" +
      encodeURIComponent(currency);

    var iframe = global.document.createElement("iframe");
    iframe.src = iframeUrl;
    iframe.title = tenantSlug.toUpperCase() + " 3D Mobilya Konfigüratörü";
    iframe.allow = "xr-spatial-tracking; fullscreen; clipboard-write";
    iframe.style.width = "100%";
    iframe.style.height = opts.height || "780px";
    iframe.style.border = "0";
    iframe.style.borderRadius = "16px";
    iframe.style.display = "block";

    container.innerHTML = "";
    container.appendChild(iframe);

    function onMessage(ev) {
      if (!ev || !ev.data || typeof ev.data !== "object") return;
      if (ev.origin !== origin && origin !== "*") return;
      if (ev.data.namespace !== "modul-embed-v1") return;

      if (ev.data.type === "MODUL_RESIZE" && typeof ev.data.heightPx === "number") {
        iframe.style.height = Math.max(480, Math.round(ev.data.heightPx)) + "px";
      }
      if (ev.data.type === "MODUL_QUOTE_CREATED" && typeof opts.onQuoteCreated === "function") {
        opts.onQuoteCreated(ev.data.payload);
      }
      if (ev.data.type === "MODUL_ADD_TO_CART" && typeof opts.onAddToCart === "function") {
        opts.onAddToCart(ev.data.payload);
      }
    }

    global.addEventListener("message", onMessage);

    return {
      iframe: iframe,
      destroy: function () {
        global.removeEventListener("message", onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      },
    };
  }

  global.ModulConfigurator = {
    version: "1.0.0",
    mount: mountConfigurator,
  };

  if (global.document) {
    var currentScript =
      global.document.currentScript ||
      global.document.querySelector('script[src*="/sdk/v1/embed.js"]');
    if (currentScript && currentScript.getAttribute("data-tenant")) {
      var autoMount = function () {
        var mountNode = global.document.getElementById(
          currentScript.getAttribute("data-mount-id") || "modul-configurator-mount"
        );
        if (mountNode) {
          mountConfigurator({
            tenant: currentScript.getAttribute("data-tenant"),
            currency: currentScript.getAttribute("data-currency") || "TRY",
            scriptEl: currentScript,
            container: mountNode,
          });
        }
      };
      if (global.document.readyState === "loading") {
        global.document.addEventListener("DOMContentLoaded", autoMount);
      } else {
        autoMount();
      }
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
