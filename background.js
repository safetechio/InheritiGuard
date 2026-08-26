// Extension state
let isEnabled = false; // Start disabled by default
let currentStatus = 'warning';
let blockedSites = [];
const MAX_BLOCKED_SITES = 100;

// Store the listener function at a higher scope
let handleTabUpdate = null;

// Add new state variable
let apiBlockingEnabled = true;

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

            // Add the listener for URL checking
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
            if (handleTabUpdate) {
                chrome.tabs.onUpdated.removeListener(handleTabUpdate);
                handleTabUpdate = null;
            }
            
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

// Initialize extension
console.log('[InheritiGuard] Extension initializing...');

// Initial cleanup and state loading
(async () => {
    try {
        await removeAllRules();
        
        // Load saved state and blocked sites
        const result = await chrome.storage.local.get(['isEnabled', 'blockedSites', 'apiBlockingEnabled']);
        isEnabled = result.isEnabled || false;
        apiBlockingEnabled = result.apiBlockingEnabled ?? true; // Default to true
        blockedSites = result.blockedSites || [];
        
        console.log(`[InheritiGuard] Loaded saved state: ${isEnabled ? 'enabled' : 'disabled'}`);
        console.log(`[InheritiGuard] API Blocking: ${apiBlockingEnabled ? 'enabled' : 'disabled'}`);
        
        updateStatus(isEnabled ? 'secure' : 'warning');
        if (isEnabled) {
            await updateRules(true);
        }
    } catch (error) {
        console.error('[InheritiGuard] Initialization error:', error);
        updateStatus('warning');
    }
})();

// Listen for extension unload/disable
chrome.runtime.onSuspend.addListener(() => {
    console.log('[InheritiGuard] Extension being suspended - cleaning up rules');
    removeAllRules();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[InheritiGuard] Received message:', message);
    
    if (message.action === 'getStatus') {
        console.log('[InheritiGuard] Status requested:', { isEnabled, currentStatus, blockedSites, apiBlockingEnabled });
        sendResponse({ isEnabled, currentStatus, blockedSites, apiBlockingEnabled });
        return false; // Synchronous response
    } else if (message.action === 'toggleEnabled') {
        isEnabled = message.enabled;
        console.log(`[InheritiGuard] Protection toggled: ${isEnabled ? 'ON' : 'OFF'}`);
        
        chrome.storage.local.set({ isEnabled }, () => {
            console.log(`[InheritiGuard] State saved: ${isEnabled}`);
        });
        
        updateRules(isEnabled).then(() => {
            sendResponse({ isEnabled, currentStatus, blockedSites, apiBlockingEnabled });
        });
        return true; // Async response
    } else if (message.action === 'toggleApiBlocking') {
        apiBlockingEnabled = message.enabled;
        console.log(`[InheritiGuard] API Blocking toggled: ${apiBlockingEnabled ? 'ON' : 'OFF'}`);
        
        chrome.storage.local.set({ apiBlockingEnabled }, () => {
            console.log(`[InheritiGuard] API Blocking state saved: ${apiBlockingEnabled}`);
            sendResponse({ isEnabled, currentStatus, blockedSites, apiBlockingEnabled });
        });
        return true; // Async response
    } else if (message.action === 'apiBlocked') {
        showSecurityNotification('api', {
            type: message.type,
            url: message.url
        });
    } else if (message.action === 'cspViolation') {
        showSecurityNotification('csp', {
            url: message.url,
            violation: message.violation
        });
    }
});

// Log when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log('[InheritiGuard] Extension installed/updated');
});

// Remove the webRequest listener section completely 
