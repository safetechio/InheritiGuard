(function() {
    const SESSION_ROOTS = ['inheriti.com', 'safetech.io', 'safekey.be'];

    function isSessionHostname(hostname) {
        const host = (hostname || '').toLowerCase();
        return SESSION_ROOTS.some((root) => host === root || host.endsWith('.' + root));
    }

    function containsInheritiUrl(text) {
        return /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*inheriti\.com(?:[\/:?#]|\s|$)/i.test(text || '');
    }

    const onSessionPage = isSessionHostname(window.location.hostname);
    let guardEnabled = true;
    let allowPaste = true;
    let allowRead = true;

    function notifyBlocked(kind) {
        try {
            chrome.runtime.sendMessage({
                action: 'clipboardBlocked',
                type: kind,
                url: window.location.href
            }, () => {
                void chrome.runtime.lastError;
            });
        } catch (error) {
            console.debug('[InheritiGuard] Clipboard notify failed:', error);
        }
    }

    function refreshState() {
        try {
            chrome.runtime.sendMessage({ action: 'clipboardQuery' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    return;
                }
                guardEnabled = response.clipboardGuardEnabled !== false;
                allowPaste = response.allowPaste !== false;
                allowRead = response.allowRead !== false;
            });
        } catch (error) {
            console.debug('[InheritiGuard] Clipboard query failed:', error);
        }
    }

    if (onSessionPage) {
        const markCopied = () => {
            try {
                chrome.runtime.sendMessage({ action: 'clipboardCopiedOnSession' }, () => {
                    void chrome.runtime.lastError;
                });
            } catch (error) {
                console.debug('[InheritiGuard] Clipboard copy mark failed:', error);
            }
        };
        document.addEventListener('copy', markCopied, true);
        document.addEventListener('cut', markCopied, true);
        return;
    }

    refreshState();
    setInterval(refreshState, 2000);
    window.addEventListener('focus', refreshState);

    chrome.runtime.onMessage.addListener((message) => {
        if (message && message.action === 'clipboardState') {
            guardEnabled = message.clipboardGuardEnabled !== false;
            allowPaste = message.allowPaste !== false;
            allowRead = message.allowRead !== false;
        }
    });

    document.addEventListener('paste', (event) => {
        if (!guardEnabled) {
            return;
        }

        const text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        const pastingInheritiUrl = containsInheritiUrl(text);
        if (!pastingInheritiUrl && allowPaste) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        notifyBlocked(pastingInheritiUrl ? 'Inheriti URL paste' : 'Sensitive paste');
    }, true);

    if (navigator.clipboard) {
        const originalReadText = navigator.clipboard.readText
            ? navigator.clipboard.readText.bind(navigator.clipboard)
            : null;
        const originalRead = navigator.clipboard.read
            ? navigator.clipboard.read.bind(navigator.clipboard)
            : null;

        if (originalReadText) {
            navigator.clipboard.readText = function() {
                if (guardEnabled && !allowRead) {
                    notifyBlocked('Clipboard read');
                    return Promise.reject(new Error('Clipboard read blocked by InheritiGuard'));
                }
                return originalReadText();
            };
        }

        if (originalRead) {
            navigator.clipboard.read = function() {
                if (guardEnabled && !allowRead) {
                    notifyBlocked('Clipboard read');
                    return Promise.reject(new Error('Clipboard read blocked by InheritiGuard'));
                }
                return originalRead();
            };
        }
    }
})();
