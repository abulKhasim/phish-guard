// content.js
(async function() {
  const rules = await fetch(chrome.runtime.getURL('rules.json'))
    .then(r => r.json())
    .catch(() => ({}));

  const state = { score: 0, reasons: [] };

  const url = new URL(location.href);
  const hostname = url.hostname.toLowerCase();

  // Helpers
  const add = (pts, reason) => {
    const existing = state.reasons.find(r => r.reason === reason);
    if (existing) {
      existing.pts += pts; // accumulate score for duplicates
      existing.count = (existing.count || 1) + 1;
    } else {
      state.reasons.push({ pts, reason, count: 1 });
    }
    state.score += pts;
  };

  const hasMixedScripts = s => /[^\u0000-\u007F]/.test(s); // rough
  const looksLikeHomograph = h =>
    /[Il10O]/.test(h.replace(/[.\-]/g, "")) || h.includes("xn--");

  // URL features
  if (hostname.split(".").length > 3) add(10, "Many subdomains");
  const tld = hostname.split(".").pop();
  if (rules.riskyTlds?.includes(tld)) add(8, `Risky TLD (.${tld})`);
  if (hostname.length > 25) add(5, "Unusually long domain");
  if (looksLikeHomograph(hostname)) add(20, "Possible homograph");
  if (hasMixedScripts(hostname)) add(15, "Non-ASCII in domain");
  if ((url.pathname + url.search).length > 120)
    add(4, "Very long URL path/query");
  if (/\d{2,}\.\d{2,}\.\d{2,}\.\d{2,}/.test(hostname))
    add(12, "Bare IP address");

  // Link text vs href mismatch
  [...document.querySelectorAll("a[href]")].slice(0, 150).forEach(a => {
    try {
      const link = new URL(a.href);
      const text = (a.innerText || "").trim().toLowerCase();
      if (text && text.includes(".")) {
        if (!link.hostname.toLowerCase().includes(text.replace(/^www\./, ""))) {
          add(6, "Link text/domain mismatch");
        }
      }
    } catch {}
  });

  // Credential harvest & forms
  const inputs = [
    ...document.querySelectorAll(
      "input[type=password], input[name*=otp i], input[name*=ssn i]"
    )
  ];
  if (inputs.length) {
    add(15, "Credential inputs detected");
    // cross-origin form action
    const forms = [...document.querySelectorAll("form")];
    forms.forEach(f => {
      try {
        const action = f.getAttribute("action") || location.href;
        const actionHost = new URL(action, location.href).hostname;
        if (actionHost && actionHost !== hostname)
          add(12, "Form posts to different domain");
      } catch {}
    });
  }

  // Urgency language
  const textSample = document.body.innerText.slice(0, 20000).toLowerCase();
  (rules.urgentPhrases || []).forEach(p => {
    if (textSample.includes(p)) add(5, `Urgency: "${p}"`);
  });

  // Brand spoofing
  for (const brand of rules.spoofBrands || []) {
    if (textSample.includes(brand)) {
      const ok = (rules.brandDomains?.[brand] || []).some(d =>
        hostname.endsWith(d)
      );
      if (!ok) add(14, `Mentions "${brand}" but domain not recognized`);
    }
  }

  // Normalize & cap
  const score = Math.min(100, state.score);
  const level = score >= 35 ? (score >= 60 ? "High" : "Medium") : "Low";

  // Inject banner (once)
  const id = "phishguard-banner";
  if (!document.getElementById(id)) {
    const banner = document.createElement("div");
    banner.id = id;
    banner.innerHTML = `
      <div class="pg-wrap">
        <div class="pg-left">
          <strong>PhishGuard</strong> risk: <span class="pg-level pg-${level.toLowerCase()}">${level}</span>
          <span class="pg-score">(${score})</span>
        </div>
        <button id="pg-details">Details</button>
      </div>
    `;
    document.documentElement.appendChild(banner);

    const dlg = document.createElement("div");
    dlg.id = "pg-dialog";
    dlg.innerHTML = `
      <div class="pg-modal">
        <h3>Why flagged</h3>
        <ul>
          ${state.reasons
            .map(
              r =>
                `<li>+${r.pts}: ${r.reason}${
                  r.count > 1 ? ` (x${r.count})` : ""
                }</li>`
            )
            .join("")}
        </ul>
        <button id="pg-close">Close</button>
      </div>
    `;
    dlg.style.display = "none";
    document.documentElement.appendChild(dlg);

    document.getElementById("pg-details").onclick = () =>
      (dlg.style.display = "block");
    document.getElementById("pg-close").onclick = () =>
      (dlg.style.display = "none");
  }

  // Highlight suspicious links
  if (score >= 35) {
    [...document.querySelectorAll("a[href]")].forEach(a => {
      a.style.outline = "2px dashed currentColor";
      a.style.outlineOffset = "2px";
    });
  }
})();
