(function() {
    console.log('[InheritiGuard] API Protection initializing...');

    let isEnabled = false;
    let apiBlockingEnabled = true;
    let blockingApplied = false;

    const originalMediaDevices = navigator.mediaDevices;
    const originalGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        : null;
    const originalEnumerateDevices = navigator.mediaDevices && navigator.mediaDevices.enumerateDevices
        ? navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices)
        : null;
    const originalGeolocation = navigator.geolocation;
    const originalBattery = navigator.getBattery;
    const originalNotification = window.Notification;
    const originalServiceWorker = navigator.serviceWorker;
    const originalServiceWorkerRegister = navigator.serviceWorker && navigator.serviceWorker.register
        ? navigator.serviceWorker.register.bind(navigator.serviceWorker)
        : null;

    function notifyBlocked(type) {
        if (!isEnabled || !apiBlockingEnabled) {
            return;
        }

        try {
            chrome.runtime.sendMessage({
                action: 'apiBlocked',
                type: type,
                url: window.location.href
            }, () => {
                void chrome.runtime.lastError;
            });
        } catch (error) {
            console.debug('[InheritiGuard] Notification error:', error);
        }
    }

    function restoreApis() {
        if (originalMediaDevices) {
            if (originalGetUserMedia) {
                originalMediaDevices.getUserMedia = originalGetUserMedia;
            }
            if (originalEnumerateDevices) {
                originalMediaDevices.enumerateDevices = originalEnumerateDevices;
            }
            try {
                navigator.mediaDevices = originalMediaDevices;
            } catch (error) {
                console.debug('[InheritiGuard] Could not restore mediaDevices:', error);
            }
        }
        if (originalGeolocation) {
            try {
                navigator.geolocation = originalGeolocation;
            } catch (error) {
                console.debug('[InheritiGuard] Could not restore geolocation:', error);
            }
        }
        if (originalBattery) {
            navigator.getBattery = originalBattery;
        }
        if (originalNotification) {
            try {
                window.Notification = originalNotification;
            } catch (error) {
                console.debug('[InheritiGuard] Could not restore Notification:', error);
            }
        }
        if (originalServiceWorker) {
            if (originalServiceWorkerRegister) {
                originalServiceWorker.register = originalServiceWorkerRegister;
            }
            try {
                navigator.serviceWorker = originalServiceWorker;
            } catch (error) {
                console.debug('[InheritiGuard] Could not restore serviceWorker:', error);
            }
        }
        blockingApplied = false;
    }

    function applyApiBlocking() {
        if (!isEnabled || !apiBlockingEnabled) {
            restoreApis();
            return;
        }
        if (blockingApplied) {
            return;
        }

        if (navigator.mediaDevices && originalGetUserMedia) {
            navigator.mediaDevices.getUserMedia = function() {
                notifyBlocked('Camera/Microphone');
                return Promise.reject(new Error('Media access blocked by InheritiGuard'));
            };
        }
        if (navigator.mediaDevices && originalEnumerateDevices) {
            navigator.mediaDevices.enumerateDevices = function() {
                notifyBlocked('Device enumeration');
                return Promise.reject(new Error('Device enumeration blocked by InheritiGuard'));
            };
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition = function(success, error) {
                notifyBlocked('Geolocation');
                if (error) {
                    error({ code: 1, message: 'Geolocation blocked by InheritiGuard' });
                }
            };
            navigator.geolocation.watchPosition = function() {
                notifyBlocked('Geolocation tracking');
                return 0;
            };
            navigator.geolocation.clearWatch = function() {};
        }

        if (navigator.getBattery) {
            navigator.getBattery = function() {
                notifyBlocked('Battery status');
                return Promise.reject(new Error('Battery status blocked by InheritiGuard'));
            };
        }

        if (window.Notification) {
            window.Notification.requestPermission = function() {
                notifyBlocked('Notification permission');
                return Promise.reject(new Error('Notifications blocked by InheritiGuard'));
            };
        }

        if (navigator.serviceWorker && navigator.serviceWorker.register) {
            navigator.serviceWorker.register = function() {
                notifyBlocked('Service Worker registration');
                return Promise.reject(new Error('Service Worker registration blocked by InheritiGuard'));
            };
        }

        blockingApplied = true;
    }

    function applyProtectionState(state) {
        if (!state) {
            return;
        }
        isEnabled = !!state.isEnabled;
        if (typeof state.apiBlockingEnabled !== 'undefined') {
            apiBlockingEnabled = !!state.apiBlockingEnabled;
        }
        applyApiBlocking();
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'protectionState' || message.action === 'toggleEnabled') {
            applyProtectionState({
                isEnabled: message.isEnabled ?? message.enabled,
                apiBlockingEnabled: message.apiBlockingEnabled
            });
        } else if (message.action === 'updateApiBlocking') {
            apiBlockingEnabled = !!message.enabled;
            applyApiBlocking();
        }
    });

    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
            return;
        }
        applyProtectionState(response);
    });

    document.addEventListener('securitypolicyviolation', (e) => {
        if (isEnabled) {
            chrome.runtime.sendMessage({
                action: 'cspViolation',
                url: window.location.href,
                violation: `${e.violatedDirective} from ${e.blockedURI}`
            }, () => {
                void chrome.runtime.lastError;
            });
        }
    });
})();
