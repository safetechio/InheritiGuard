document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('enableToggle');
  const apiToggle = document.getElementById('apiBlockToggle');
  const enabledText = document.getElementById('enabledText');
  const statusRow = document.getElementById('statusRow');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');

  console.log('[InheritiGuard Popup] Initializing...');

  // Function to update UI based on status
  function updateUI(status) {
    // Check if status exists and has required properties
    if (!status) {
      console.error('[InheritiGuard Popup] Invalid status received');
      return;
    }

    try {
      // Direct mapping of enabled state to toggle
      toggle.checked = !!status.isEnabled;
      
      // Only update API toggle if the property exists
      if (typeof status.apiBlockingEnabled !== 'undefined') {
        apiToggle.checked = status.apiBlockingEnabled;
        apiToggle.disabled = !status.isEnabled;
        apiToggle.parentElement.style.opacity = status.isEnabled ? '1' : '0.5';
      }
      
      // Update enabled text
      enabledText.textContent = status.isEnabled ? 'Enabled' : 'Disabled';

      statusIcon.src = 'icons/icon32.png';
      statusRow.classList.toggle('enabled', !!status.isEnabled);
      statusRow.classList.toggle('disabled', !status.isEnabled);
      statusText.textContent = status.isEnabled
        ? 'Protection is enabled'
        : 'Protection is disabled';
    } catch (error) {
      console.error('[InheritiGuard Popup] Error updating UI:', error);
    }
  }

  // Get initial status with error handling
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[InheritiGuard Popup] Error getting status:', chrome.runtime.lastError);
      return;
    }
    updateUI(response);
  });

  // Add toggle event listener with error handling
  toggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ 
      action: 'toggleEnabled', 
      enabled: toggle.checked 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[InheritiGuard Popup] Error toggling enabled state:', chrome.runtime.lastError);
        // Revert toggle if there was an error
        toggle.checked = !toggle.checked;
        return;
      }
      updateUI(response);
    });
  });

  // Add API toggle event listener with error handling
  apiToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ 
      action: 'toggleApiBlocking', 
      enabled: apiToggle.checked 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[InheritiGuard Popup] Error toggling API blocking:', chrome.runtime.lastError);
        // Revert toggle if there was an error
        apiToggle.checked = !apiToggle.checked;
        return;
      }
      updateUI(response);
    });
  });

  // Add version link handling with error handling
  try {
    const manifest = chrome.runtime.getManifest();
    const versionLink = document.getElementById('versionLink');
    if (versionLink) {
      versionLink.textContent = `v${manifest.version}`;
      versionLink.href = manifest.homepage_url || '#';
      versionLink.target = "_blank";
    }
  } catch (error) {
    console.error('[InheritiGuard Popup] Error setting version:', error);
  }
}); 