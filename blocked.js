document.addEventListener('DOMContentLoaded', () => {
    const blockedUrlElement = document.getElementById('blockedUrl');
    const params = new URLSearchParams(window.location.search);
    let blockedUrl = params.get('blockedUrl') || '';

    if (!blockedUrl && window.location.hash.length > 1) {
        blockedUrl = window.location.hash.slice(1);
    }

    try {
        blockedUrl = decodeURIComponent(blockedUrl);
    } catch (error) {
        // Keep the raw value if it is not encoded.
    }

    blockedUrlElement.textContent = blockedUrl || 'This website has been blocked for your security.';

    document.getElementById('backButton').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'https://inheriti.com';
    });
});
