// Extension state
let isEnabled = false; // Start disabled by default
let currentStatus = 'warning';
let blockedSites = [];
const MAX_BLOCKED_SITES = 100;

// Store the listener function at a higher scope
let handleTabUpdate = null;

// Add new state variable
let apiBlockingEnabled = true;
let clipboardGuardEnabled = true;
let idleLockEnabled = true;
let idleLockMinutes = 10;
let downloadTrapEnabled = true;
let sensitiveClipboardUntil = 0;
const blockedDownloadIds = new Set();
const SENSITIVE_CLIPBOARD_MS = 5 * 60 * 1000;
const SESSION_ROOT_DOMAINS = ['inheriti.com', 'safetech.io', 'safekey.be'];
const SESSION_ORIGINS = [
    'https://inheriti.com',
    'https://www.inheriti.com',
    'https://app.inheriti.com',
    'https://app-stg.inheriti.com',
    'https://app-dev.inheriti.com',
    'https://business.inheriti.com',
    'https://business-prod.inheriti.com',
    'https://business-stg.inheriti.com',
    'https://business-dev.inheriti.com',
    'https://inheritichain-explorer.inheriti.com',
    'https://inheritichain-explorer-dev.inheriti.com',
    'https://safetech.io',
    'https://safeid-prod.safetech.io',
    'https://safeid-stg.safetech.io',
    'https://safeid-dev.safetech.io',
    'https://safekey.be'
];
const RISKY_DOWNLOAD_EXTENSIONS = [
    'html', 'htm', 'xhtml', 'svg', 'js', 'jse', 'exe', 'msi', 'dll',
    'bat', 'cmd', 'com', 'scr', 'pif', 'wsf', 'vbs', 'hta', 'ps1', 'apk'
];

// Function to add blocked site to list with proper URL
function addBlockedSite(url) {
    // Don't add chrome:// URLs or empty URLs
    if (!url || url.startsWith('chrome://')) {
        return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const blockedSite = `${url} (${timestamp})`;
    
    // Add to beginning of array and limit to last 10 sites
    blockedSites.unshift(blockedSite);
    if (blockedSites.length > 10) {
        blockedSites.pop();
    }
    
    // Save updated list
    chrome.storage.local.set({ blockedSites });
    console.log('[InheritiGuard] Added to blocked sites:', blockedSite);
}

// Function to check if a URL is from a trusted domain
function isTrustedDomain(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        console.log('[InheritiGuard] Checking domain:', hostname);

        // Skip checking extension URLs
        if (url.startsWith('chrome-extension://')) {
            console.log('[InheritiGuard] Allowing extension URL:', url);
            return true;
        }

        // List of explicitly trusted hostnames and domains
        const trustedHostnames = [
            // Inheriti domains
            "inheriti.com",
            "app.inheriti.com",
            "app-stg.inheriti.com",
            "app-dev.inheriti.com",
            "business.inheriti.com",
            "business-prod.inheriti.com",
            "business-stg.inheriti.com",
            "business-dev.inheriti.com",
            "inheritichain-explorer.inheriti.com",
            "inheritichain-explorer-dev.inheriti.com",
            // Safetech domains
            "safetech.io",
            "safeid-prod.safetech.io",
            "safeid-stg.safetech.io",
            "safeid-dev.safetech.io",
            "safekey.be",
            // Infrastructure
            "cloudflareaccess.com",
            "cloudflare.com",
            // Video platform
            "youtube.com",
            "www.youtube.com",
            // OAuth Providers
            "accounts.google.com",
            "appleid.apple.com",
            "facebook.com",
            "www.facebook.com",
            "twitter.com",
            "x.com",
            "api.twitter.com"
        ];

        // Log the hostname we're checking
        console.log('[InheritiGuard] Checking hostname:', hostname);
        //console.log('[InheritiGuard] Trusted hostnames:', trustedHostnames);

        // Check for exact hostname match first
        const isExactMatch = trustedHostnames.includes(hostname);
        console.log('[InheritiGuard] Exact match result:', isExactMatch);

        if (isExactMatch) {
            console.log('[InheritiGuard] Exact hostname match found for:', hostname);
            return true;
        }

        // Then check for subdomain matches
        for (const domain of trustedHostnames) {
            if (hostname.endsWith('.' + domain)) {
                console.log('[InheritiGuard] Subdomain match found:', hostname, 'matches', domain);
                return true;
            }
        }

        console.log('[InheritiGuard] No matches found for:', hostname);
        return false;

    } catch (e) {
        console.error('[InheritiGuard] Error parsing URL:', e);
        console.error('[InheritiGuard] Error details:', e.message);
        return false;
    }
}

function hostnameFromUrl(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch (e) {
        return '';
    }
}

function isSessionHostname(hostname) {
    const host = (hostname || '').toLowerCase();
    return SESSION_ROOT_DOMAINS.some((root) => host === root || host.endsWith('.' + root));
}

function isSessionUrl(url) {
    return !!url && isSessionHostname(hostnameFromUrl(url));
}

function getPublicStatus() {
    return {
        isEnabled,
        currentStatus,
        blockedSites,
        apiBlockingEnabled,
        clipboardGuardEnabled,
        idleLockEnabled,
        idleLockMinutes,
        downloadTrapEnabled
    };
}

function isSensitiveClipboardActive() {
    return Date.now() < sensitiveClipboardUntil;
}

async function hasOpenSessionTabs() {
    const tabs = await chrome.tabs.query({});
    return tabs.some((tab) => isSessionUrl(tab.url));
}

function clipboardDecisionForUrl(senderUrl, sessionOpen) {
    const onSessionPage = isSessionUrl(senderUrl);
    if (onSessionPage || !clipboardGuardEnabled) {
        return {
            clipboardGuardEnabled,
            allowPaste: true,
            allowRead: true
        };
    }

    const sensitive = isSensitiveClipboardActive();
    return {
        clipboardGuardEnabled,
        allowPaste: !sensitive,
        allowRead: !sessionOpen && !sensitive
    };
}

async function getClipboardDecisionAsync(senderUrl) {
    const sessionOpen = await hasOpenSessionTabs();
    return clipboardDecisionForUrl(senderUrl, sessionOpen);
}

async function broadcastClipboardState() {
    const tabs = await chrome.tabs.query({});
    const sessionOpen = tabs.some((tab) => isSessionUrl(tab.url));

    for (const tab of tabs) {
        if (!tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            continue;
        }
        const decision = clipboardDecisionForUrl(tab.url, sessionOpen);
        chrome.tabs.sendMessage(tab.id, {
            action: 'clipboardState',
            ...decision
        }).catch(() => {});
    }
}

function markSensitiveClipboard() {
    sensitiveClipboardUntil = Date.now() + SENSITIVE_CLIPBOARD_MS;
    broadcastClipboardState().catch((error) => {
        console.error('[InheritiGuard] Clipboard broadcast failed:', error);
    });
}

function cookieUrl(cookie) {
    const host = cookie.domain.replace(/^\./, '');
    return `http${cookie.secure ? 's' : ''}://${host}${cookie.path || '/'}`;
}

async function clearSessionCookies() {
    for (const domain of SESSION_ROOT_DOMAINS) {
        const cookies = await chrome.cookies.getAll({ domain });
        await Promise.all(cookies.map((cookie) =>
            chrome.cookies.remove({
                url: cookieUrl(cookie),
                name: cookie.name,
                storeId: cookie.storeId
            }).catch(() => {})
        ));
    }
}

async function secureLeave(reason) {
    const tabs = await chrome.tabs.query({});
    const sessionTabs = tabs.filter((tab) => tab.id && isSessionUrl(tab.url));
    await Promise.all(sessionTabs.map((tab) => chrome.tabs.remove(tab.id).catch(() => {})));

    await clearSessionCookies();
    try {
        await chrome.browsingData.remove(
            { origins: SESSION_ORIGINS },
            { cookies: true, localStorage: true }
        );
    } catch (error) {
        console.error('[InheritiGuard] browsingData clear failed:', error);
    }

    sensitiveClipboardUntil = 0;
    apiBlockingEnabled = false;
    await chrome.storage.local.set({ apiBlockingEnabled: false });
    broadcastClipboardState().catch((error) => {
        console.error('[InheritiGuard] Clipboard broadcast failed:', error);
    });

    await showSecurityNotification(reason === 'idle' ? 'idleLock' : 'secureLeave', {
        count: sessionTabs.length
    });

    return { closedTabs: sessionTabs.length, ...getPublicStatus() };
}

function applyIdleDetection() {
    const seconds = Math.max(15, Math.min(60 * 120, Number(idleLockMinutes) * 60 || 600));
    try {
        chrome.idle.setDetectionInterval(seconds);
        console.log('[InheritiGuard] Idle detection set to', seconds, 'seconds');
    } catch (error) {
        console.error('[InheritiGuard] Failed to set idle interval:', error);
    }
}

function extensionFromPath(path) {
    const clean = (path || '').split('?')[0].split('#')[0];
    const parts = clean.split('.');
    if (parts.length < 2) {
        return '';
    }
    return parts.pop().toLowerCase();
}

function isRiskyDownload(item) {
    if (!downloadTrapEnabled) {
        return false;
    }

    const url = item.finalUrl || item.url || '';
    const referrer = item.referrer || '';
    const filename = item.filename || '';
    const fromSession = isSessionUrl(url) || isSessionUrl(referrer);
    if (!fromSession && !url.startsWith('blob:') && !url.startsWith('data:')) {
        return false;
    }

    if (url.startsWith('blob:') || url.startsWith('data:text/html') || url.startsWith('data:image/svg') || url.startsWith('data:application/xhtml')) {
        return fromSession || url.includes('inheriti.com');
    }

    const ext = extensionFromPath(filename) || extensionFromPath(url);
    return fromSession && RISKY_DOWNLOAD_EXTENSIONS.includes(ext);
}

async function blockDownload(item) {
    if (blockedDownloadIds.has(item.id)) {
        return;
    }
    blockedDownloadIds.add(item.id);
    try {
        await chrome.downloads.cancel(item.id);
        await chrome.downloads.erase({ id: item.id });
    } catch (error) {
        console.error('[InheritiGuard] Failed to cancel download:', error);
    }
    const label = item.filename || hostnameFromUrl(item.url) || 'file';
    await showSecurityNotification('download', { filename: label });
}

// Function to remove all rules
async function removeAllRules() {
    try {
        // Get all current rules
        const rules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIds = rules.map(rule => rule.id);
        
        // Remove all rules
        if (ruleIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds
            });
            console.log('[InheritiGuard] All rules removed successfully');
        } else {
            console.log('[InheritiGuard] No rules to remove');
        }
    } catch (error) {
        console.error('[InheritiGuard] Error removing rules:', error);
    }
}

// Function to show notification for security events
async function showSecurityNotification(type, details) {
    try {
        const notificationOptions = {
            type: 'basic',
            iconUrl: 'icons/warning128.png',
            title: 'InheritiGuard - Security Alert',
            message: '',
            priority: 2,
            requireInteraction: true,
            buttons: [
                {
                    title: 'Return to Inheriti',
                    iconUrl: 'icons/secure16.png'
                },
                {
                    title: 'View Details'
                }
            ]
        };

        // Customize message based on type
        switch(type) {
            case 'api':
                notificationOptions.message = `Blocked ${details.type} access attempt\nSite: ${details.url}`;
                break;
            case 'csp':
                notificationOptions.message = `CSP Violation blocked\nSite: ${details.url}\nViolation: ${details.violation}`;
                break;
            case 'clipboard':
                notificationOptions.message = `Blocked ${details.type} on an untrusted site`;
                break;
            case 'download':
                notificationOptions.message = `Blocked a risky download: ${details.filename}`;
                break;
            case 'idleLock':
                notificationOptions.title = 'InheritiGuard - Idle lock';
                notificationOptions.message = 'You were idle, so Inheriti tabs were closed and session data was cleared.';
                notificationOptions.requireInteraction = false;
                notificationOptions.buttons = [{ title: 'Open Inheriti' }];
                break;
            case 'secureLeave':
                notificationOptions.title = 'InheritiGuard - Secure logoff';
                notificationOptions.message = 'You were logged off the Inheriti ecosystem. Tabs were closed and session data was cleared.';
                notificationOptions.requireInteraction = false;
                notificationOptions.buttons = [{ title: 'Open Inheriti' }];
                break;
        }

        const notificationId = 'inheriti-guard-' + Date.now();
        await chrome.notifications.create(notificationId, notificationOptions);
        console.log(`[InheritiGuard] ${type} notification sent for:`, details);

        // Handle notification button clicks
        chrome.notifications.onButtonClicked.addListener((clickedId, buttonIndex) => {
            if (clickedId === notificationId) {
                if (buttonIndex === 0) {
                    chrome.tabs.create({ url: 'https://app.inheriti.com' });
                } else if (buttonIndex === 1) {
                    chrome.tabs.create({ url: chrome.runtime.getURL('blocked.html') });
                }
                chrome.notifications.clear(notificationId);
            }
        });

    } catch (error) {
        console.error('[InheritiGuard] Error creating notification:', error);
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('[InheritiGuard] Notification clicked:', event.notification.tag);
    event.notification.close();
    
    if (event.notification.tag === 'inheriti-guard-blocked') {
        clients.openWindow('https://app.inheriti.com');
    }
});

// Create rule to block non-trusted domains
async function updateRules(enabled) {
    console.log(`[InheritiGuard] Protection ${enabled ? 'enabled' : 'disabled'}`);
    
    try {
        await removeAllRules();

        if (handleTabUpdate) {
            chrome.tabs.onUpdated.removeListener(handleTabUpdate);
            handleTabUpdate = null;
        }

        if (enabled) {
            console.log('[InheritiGuard] Adding protection rules...');
            
            // Define the listener function with session handling
            handleTabUpdate = async (tabId, changeInfo, tab) => {
                if (changeInfo.url && !changeInfo.url.startsWith('chrome-extension://')) {
                    console.log('[InheritiGuard] Checking URL:', changeInfo.url);
                    
                    // Allow Cloudflare Access authentication URLs
                    if (changeInfo.url.includes('kyc.cloudflareaccess.com/cdn-cgi/access/login')) {
                        console.log('[InheritiGuard] Allowing Cloudflare Access auth URL:', changeInfo.url);
                        return;
                    }

                    if (!isTrustedDomain(changeInfo.url)) {
                        const blockedUrl = changeInfo.url;
                        console.log(`[InheritiGuard] Tab listener blocked URL: ${blockedUrl}`);
                        addBlockedSite(blockedUrl);

                        // Redirect to blocked page
                        const blockPageURL = chrome.runtime.getURL('blocked.html');
                        const redirectUrl = `${blockPageURL}?blockedUrl=${encodeURIComponent(blockedUrl)}`;
                        
                        try {
                            await chrome.tabs.update(tabId, { url: redirectUrl });
                        } catch (error) {
                            console.error('[InheritiGuard] Error updating tab:', error);
                        }
                    } else {
                        console.log('[InheritiGuard] Allowing trusted URL:', changeInfo.url);
                    }
                }
            };

            chrome.tabs.onUpdated.addListener(handleTabUpdate);

            // Add declarativeNetRequest rules
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [1, 2], // Remove existing rules
                addRules: [
                    {
                        id: 1,
                        priority: 1,
                        action: {
                            type: "block"
                        },
                        condition: {
                            urlFilter: "*",
                            resourceTypes: ["main_frame"],
                            excludedInitiatorDomains: [chrome.runtime.id],
                            excludedRequestDomains: [
                                // ... your trusted domains ...
                                "inheriti.com",
                                "*.inheriti.com",
                                "business.inheriti.com",
                                "business-prod.inheriti.com",
                                "business-stg.inheriti.com",
                                "business-dev.inheriti.com",
                                "inheritichain-explorer.inheriti.com",
                                "inheritichain-explorer-dev.inheriti.com",
                                "safetech.io",
                                "*.safetech.io",
                                "cloudflareaccess.com",
                                "*.cloudflareaccess.com",
                                "cloudflare.com",
                                "*.cloudflare.com",
                                "safekey.be",
                                "youtube.com",
                                "www.youtube.com",
                                "accounts.google.com",
                                "appleid.apple.com",
                                "facebook.com",
                                "www.facebook.com",
                                "twitter.com",
                                "x.com",
                                "api.twitter.com"
                            ]
                        }
                    }
                ]
            });

            console.log('[InheritiGuard] Protection rules added successfully');
            updateStatus('secure');
        } else {
            console.log('[InheritiGuard] Protection disabled - rules removed');
            updateStatus('warning');
        }
    } catch (error) {
        console.error('[InheritiGuard] Error updating rules:', error);
        updateStatus('warning');
    }
}

// Handle navigation events
function handleNavigation(details) {
    if (!isTrustedDomain(details.url)) {
        console.log(`[InheritiGuard] Navigation blocked to: ${details.url}`);
        addBlockedSite(details.url);
        
        // Update the blocked page URL
        const blockPageURL = chrome.runtime.getURL('blocked.html');
        const redirectUrl = `${blockPageURL}?blockedUrl=${encodeURIComponent(details.url)}`;
        
        chrome.tabs.update(details.tabId, {
            url: redirectUrl
        }).catch(error => {
            console.error('[InheritiGuard] Error updating tab:', error);
        });
    }
}

// Function to update extension status and icon
function updateStatus(status) {
    currentStatus = status;
    console.log('[InheritiGuard] Status changed to:', status);
    
    // Update icon based on status
    // Toolbar and extensions menu always show the brand icon.
    // Enabled/disabled state is shown in the popup, not by swapping the logo.
    const iconPath = {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png'
    };
    
    chrome.action.setIcon({ path: iconPath }, () => {
        console.log('[InheritiGuard] Icon updated to:', status);
    });
}

function notifyTabsOfProtection() {
    chrome.tabs.query({}).then((tabs) => {
        for (const tab of tabs) {
            if (!tab.id) {
                continue;
            }
            chrome.tabs.sendMessage(tab.id, {
                action: 'protectionState',
                isEnabled,
                apiBlockingEnabled
            }).catch(() => {});
        }
    }).catch((error) => {
        console.error('[InheritiGuard] Failed to notify tabs:', error);
    });
}

let resolveReady;
const extensionReady = new Promise((resolve) => {
    resolveReady = resolve;
});

async function initializeExtension() {
    try {
        const result = await chrome.storage.local.get([
            'isEnabled',
            'blockedSites',
            'apiBlockingEnabled',
            'clipboardGuardEnabled',
            'idleLockEnabled',
            'idleLockMinutes',
            'downloadTrapEnabled'
        ]);
        isEnabled = result.isEnabled === true;
        apiBlockingEnabled = result.apiBlockingEnabled ?? true;
        clipboardGuardEnabled = result.clipboardGuardEnabled ?? true;
        idleLockEnabled = result.idleLockEnabled ?? true;
        idleLockMinutes = Number(result.idleLockMinutes) > 0 ? Number(result.idleLockMinutes) : 10;
        downloadTrapEnabled = result.downloadTrapEnabled ?? true;
        blockedSites = result.blockedSites || [];

        console.log(`[InheritiGuard] Loaded saved state: ${isEnabled ? 'enabled' : 'disabled'}`);
        applyIdleDetection();
        updateStatus(isEnabled ? 'secure' : 'warning');
        await updateRules(isEnabled);
    } catch (error) {
        console.error('[InheritiGuard] Initialization error:', error);
        updateStatus('warning');
    } finally {
        resolveReady();
    }
}

console.log('[InheritiGuard] Extension initializing...');
initializeExtension();

async function handleRuntimeMessage(message, sender) {
    console.log('[InheritiGuard] Received message:', message);

    if (message.action === 'getStatus') {
        return getPublicStatus();
    }

    if (message.action === 'toggleEnabled') {
        isEnabled = message.enabled === true;
        await chrome.storage.local.set({ isEnabled });
        await updateRules(isEnabled);
        notifyTabsOfProtection();
        return getPublicStatus();
    }

    if (message.action === 'toggleApiBlocking') {
        apiBlockingEnabled = message.enabled === true;
        await chrome.storage.local.set({ apiBlockingEnabled });
        notifyTabsOfProtection();
        return getPublicStatus();
    }

    if (message.action === 'toggleClipboardGuard') {
        clipboardGuardEnabled = message.enabled === true;
        await chrome.storage.local.set({ clipboardGuardEnabled });
        broadcastClipboardState().catch((error) => {
            console.error('[InheritiGuard] Clipboard broadcast failed:', error);
        });
        return getPublicStatus();
    }

    if (message.action === 'toggleIdleLock') {
        idleLockEnabled = message.enabled === true;
        await chrome.storage.local.set({ idleLockEnabled });
        applyIdleDetection();
        return getPublicStatus();
    }

    if (message.action === 'setIdleLockMinutes') {
        idleLockMinutes = Math.max(1, Math.min(120, Number(message.minutes) || 10));
        await chrome.storage.local.set({ idleLockMinutes });
        applyIdleDetection();
        return getPublicStatus();
    }

    if (message.action === 'toggleDownloadTrap') {
        downloadTrapEnabled = message.enabled === true;
        await chrome.storage.local.set({ downloadTrapEnabled });
        return getPublicStatus();
    }

    if (message.action === 'secureLeave') {
        return secureLeave('manual');
    }

    if (message.action === 'clipboardCopiedOnSession') {
        markSensitiveClipboard();
        return { ok: true };
    }

    if (message.action === 'clipboardQuery') {
        return getClipboardDecisionAsync(sender?.url || sender?.tab?.url || '');
    }

    if (message.action === 'clipboardBlocked') {
        showSecurityNotification('clipboard', {
            type: message.type,
            url: message.url
        });
        return { ok: true };
    }

    if (message.action === 'apiBlocked') {
        showSecurityNotification('api', {
            type: message.type,
            url: message.url
        });
        return { ok: true };
    }

    if (message.action === 'cspViolation') {
        showSecurityNotification('csp', {
            url: message.url,
            violation: message.violation
        });
        return { ok: true };
    }

    return undefined;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    extensionReady
        .then(() => handleRuntimeMessage(message, sender))
        .then((response) => {
            sendResponse(response);
        })
        .catch((error) => {
            console.error('[InheritiGuard] Message handling error:', error);
            sendResponse(getPublicStatus());
        });
    return true;
});

// Log when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log('[InheritiGuard] Extension installed/updated');
});

chrome.idle.onStateChanged.addListener(async (state) => {
    if (!idleLockEnabled) {
        return;
    }
    if (state !== 'idle' && state !== 'locked') {
        return;
    }
    const sessionOpen = await hasOpenSessionTabs();
    if (!sessionOpen) {
        return;
    }
    console.log('[InheritiGuard] Idle lock triggered:', state);
    await secureLeave('idle');
});

chrome.downloads.onCreated.addListener((item) => {
    if (isRiskyDownload(item)) {
        blockDownload(item);
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    if (isRiskyDownload(item)) {
        blockDownload(item);
    }
    suggest();
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (!downloadTrapEnabled || details.frameId !== 0) {
        return;
    }

    const dest = details.url || '';
    const isDataDoc = /^data:(text\/html|application\/xhtml|image\/svg)/i.test(dest);
    const isBlob = dest.startsWith('blob:');
    if (!isDataDoc && !isBlob) {
        return;
    }

    try {
        const tab = await chrome.tabs.get(details.tabId);
        const fromSession = isSessionUrl(tab.url) || dest.includes('inheriti.com');
        if (!fromSession) {
            return;
        }

        const blockPageURL = chrome.runtime.getURL('blocked.html');
        await chrome.tabs.update(details.tabId, {
            url: `${blockPageURL}?blockedUrl=${encodeURIComponent(dest.slice(0, 80))}`
        });
        await showSecurityNotification('download', { filename: 'inline HTML document' });
    } catch (error) {
        console.error('[InheritiGuard] Failed to trap inline document:', error);
    }
});
 
