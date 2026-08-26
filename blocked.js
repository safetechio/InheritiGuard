document.addEventListener('DOMContentLoaded', () => {
    console.log('[InheritiGuard Block Page] Loading...');
    
    const blockedUrlElement = document.getElementById('blockedUrl');
    blockedUrlElement.textContent = 'This website has been blocked for your security.';

    // Add click handler for the back button
    document.getElementById('backButton').addEventListener('click', (e) => {
        console.log('[InheritiGuard Block Page] Returning to Inheriti');
        window.location.href = 'https://app.inheriti.com';
    });
}); 