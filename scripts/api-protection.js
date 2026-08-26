(function() {
    console.log('[InheritiGuard] API Protection initializing...');
    
    let isEnabled = true; // Default state
    let apiBlockingEnabled = true; // Default state for API blocking
    
    // Store original APIs for reference
    const originalMediaDevices = navigator.mediaDevices;
    const originalGeolocation = navigator.geolocation;
    const originalClipboard = navigator.clipboard;
    const originalBattery = navigator.getBattery;
    const originalNotification = window.Notification;
    const originalServiceWorker = navigator.serviceWorker;

    // Helper function to notify extension with error handling
    function notifyBlocked(type) {
        if (!apiBlockingEnabled) return; // Don't notify if API blocking is disabled
        
        try {
            chrome.runtime.sendMessage({
                action: 'apiBlocked',
                type: type,
                url: window.location.href
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Ignore message port closure
                    console.debug('[InheritiGuard] Message port closed:', chrome.runtime.lastError.message);
                }
            });
        } catch (error) {
            console.debug('[InheritiGuard] Notification error:', error);
        }
    }

    // Block Media Devices API
    if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = new Proxy(navigator.mediaDevices.getUserMedia, {
            apply: (target, thisArg, args) => {
                notifyBlocked('Camera/Microphone');
                return Promise.reject(new Error('Media access blocked by InheritiGuard'));
            }
        });

        navigator.mediaDevices.enumerateDevices = new Proxy(navigator.mediaDevices.enumerateDevices, {
            apply: (target, thisArg, args) => {
                notifyBlocked('Device enumeration');
                return Promise.reject(new Error('Device enumeration blocked by InheritiGuard'));
            }
        });
    }

    // Block Geolocation API
    navigator.geolocation = {
        getCurrentPosition: (success, error) => {
            notifyBlocked('Geolocation');
            if (error) {
                error({ code: 1, message: 'Geolocation blocked by InheritiGuard' });
            }
        },
        watchPosition: () => {
            notifyBlocked('Geolocation tracking');
            return 0;
        },
        clearWatch: () => {}
    };

    // Block Clipboard API
    if (navigator.clipboard) {
        navigator.clipboard = {
            read: () => {
                notifyBlocked('Clipboard read');
                return Promise.reject(new Error('Clipboard read blocked by InheritiGuard'));
            },
            write: () => {
                notifyBlocked('Clipboard write');
                return Promise.reject(new Error('Clipboard write blocked by InheritiGuard'));
            },
            readText: () => {
                notifyBlocked('Clipboard read');
                return Promise.reject(new Error('Clipboard read blocked by InheritiGuard'));
            },
            writeText: () => {
                notifyBlocked('Clipboard write');
                return Promise.reject(new Error('Clipboard write blocked by InheritiGuard'));
            }
        };
    }

    // Block Battery API
    if (navigator.getBattery) {
        navigator.getBattery = () => {
            notifyBlocked('Battery status');
            return Promise.reject(new Error('Battery status blocked by InheritiGuard'));
        };
    }

    // Block Notifications API
    window.Notification = {
        requestPermission: () => {
            notifyBlocked('Notification permission');
            return Promise.reject(new Error('Notifications blocked by InheritiGuard'));
        },
        permission: 'denied'
    };

    // Block Service Worker registration
    if (navigator.serviceWorker) {
        navigator.serviceWorker.register = () => {
            notifyBlocked('Service Worker registration');
            return Promise.reject(new Error('Service Worker registration blocked by InheritiGuard'));
        };
    }

    // Prevent access via Object.getOwnPropertyDescriptor
    const protectProperty = (obj, prop) => {
        try {
            Object.defineProperty(obj, prop, {
                get: () => {
                    notifyBlocked(`${prop} access`);
                    return undefined;
                },
                configurable: false
            });
        } catch (e) {
            console.log(`[InheritiGuard] Could not protect ${prop}:`, e);
        }
    };

    // Additional protection for direct property access
    protectProperty(navigator, 'mediaDevices');
    protectProperty(navigator, 'getUserMedia');
    protectProperty(navigator, 'webkitGetUserMedia');
    protectProperty(navigator, 'mozGetUserMedia');
    protectProperty(window, 'Notification');
    protectProperty(navigator, 'serviceWorker');

    // Function to restore original APIs
    function restoreApis() {
        if (originalMediaDevices) navigator.mediaDevices = originalMediaDevices;
        if (originalGeolocation) navigator.geolocation = originalGeolocation;
        if (originalClipboard) navigator.clipboard = originalClipboard;
        if (originalBattery) navigator.getBattery = originalBattery;
        if (originalNotification) window.Notification = originalNotification;
        if (originalServiceWorker) navigator.serviceWorker = originalServiceWorker;
    }

    // Function to apply API blocking
    function applyApiBlocking() {
        if (!apiBlockingEnabled) {
            restoreApis();
            return;
        }

        // ... existing API blocking code ...
    }

    // Listen for toggle updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateApiBlocking') {
            apiBlockingEnabled = message.enabled;
            if (isEnabled) {
                applyApiBlocking();
            }
        } else if (message.action === 'toggleEnabled') {
            isEnabled = message.enabled;
            if (isEnabled) {
                applyApiBlocking();
            } else {
                restoreApis();
            }
        }
    });

    // Get initial state
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
        if (response) {
            isEnabled = response.isEnabled;
            apiBlockingEnabled = response.apiBlockingEnabled;
            if (isEnabled) {
                applyApiBlocking();
            }
        }
    });

    // Add error handling for initialization
    try {
        console.log('[InheritiGuard] API Protection initialized successfully');
    } catch (error) {
        console.error('[InheritiGuard] Initialization error:', error);
    }

    // Add CSP violation monitoring
    document.addEventListener('securitypolicyviolation', (e) => {
        if (isEnabled) {
            chrome.runtime.sendMessage({
                action: 'cspViolation',
                url: window.location.href,
                violation: `${e.violatedDirective} from ${e.blockedURI}`
            });
        }
    });

    // Listen for CSP monitoring requests
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'monitorCsp') {
            console.log('[InheritiGuard] Monitoring CSP violations for:', message.url);
        }
        // ... existing message handling ...
    });
})(); 