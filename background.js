chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'WHOIS_LOOKUP') {
        // Call your API: fetch('https://your-api/domain-age?d=' + msg.domain)...
        sendResponse({ daysOld: null }); // keep null for round-1 if you skip API
    }
    return true;
});
