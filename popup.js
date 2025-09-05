async function loadRules() { return fetch(chrome.runtime.getURL('rules.json')).then(r => r.json()); }
document.getElementById('check').onclick = async () => {
    const rules = await loadRules();
    const s = (document.getElementById('msg').value || "").toLowerCase();
    let score = 0, reasons = [];
    const add = (p, r) => { score += p; reasons.push(`+${p}: ${r}`); };

    // URL presence
    const urls = s.match(/https?:\/\/[^\s)]+/g) || [];
    urls.forEach(u => {
        try {
            const { hostname, pathname, search } = new URL(u);
            const tld = hostname.split('.').pop();
            if (rules.riskyTlds?.includes(tld)) add(8, `Risky TLD in ${u}`);
            if (hostname.includes('xn--')) add(15, `Punycode in ${u}`);
            if ((pathname + search).length > 120) add(4, `Very long link path`);
        } catch { }
    });

    // Urgency
    (rules.urgentPhrases || []).forEach(p => { if (s.includes(p)) add(5, `Urgency: "${p}"`); });

    // Spoof brand
    for (const brand of (rules.spoofBrands || [])) {
        if (s.includes(brand)) add(6, `Mentions brand: ${brand}`);
    }

    const level = score >= 35 ? (score >= 60 ? "High" : "Medium") : "Low";
    document.getElementById('result').innerHTML = `
    <div><strong>Risk: ${level}</strong> (${score})</div>
    <pre style="white-space:pre-wrap">${reasons.join('\n') || 'No obvious issues found.'}</pre>
  `;
};
