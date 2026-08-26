document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('enableToggle');
  const apiToggle = document.getElementById('apiBlockToggle');
  const clipboardToggle = document.getElementById('clipboardGuardToggle');
  const idleToggle = document.getElementById('idleLockToggle');
  const idleMinutesInput = document.getElementById('idleLockMinutes');
  const downloadToggle = document.getElementById('downloadTrapToggle');
  const secureLeaveButton = document.getElementById('secureLeaveButton');
  const enabledText = document.getElementById('enabledText');
  const statusRow = document.getElementById('statusRow');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');

  function sendAction(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function updateUI(status) {
    if (!status) {
      console.error('[InheritiGuard Popup] Invalid status received');
      return;
    }

    try {
      toggle.checked = !!status.isEnabled;
      enabledText.textContent = status.isEnabled ? 'Enabled' : 'Disabled';

      if (typeof status.apiBlockingEnabled !== 'undefined') {
        apiToggle.checked = status.apiBlockingEnabled;
        apiToggle.disabled = !status.isEnabled;
        apiToggle.parentElement.style.opacity = status.isEnabled ? '1' : '0.5';
      }

      if (typeof status.clipboardGuardEnabled !== 'undefined') {
        clipboardToggle.checked = status.clipboardGuardEnabled;
      }
      if (typeof status.idleLockEnabled !== 'undefined') {
        idleToggle.checked = status.idleLockEnabled;
        idleMinutesInput.disabled = !status.idleLockEnabled;
      }
      if (typeof status.idleLockMinutes !== 'undefined') {
        idleMinutesInput.value = status.idleLockMinutes;
      }
      if (typeof status.downloadTrapEnabled !== 'undefined') {
        downloadToggle.checked = status.downloadTrapEnabled;
      }

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

  const optionHint = document.getElementById('optionHint');
  const defaultHint = 'Hover an option to see what it does.';

  document.querySelectorAll('[data-tip]').forEach((element) => {
    element.addEventListener('mouseenter', () => {
      optionHint.textContent = element.getAttribute('data-tip');
    });
    element.addEventListener('mouseleave', () => {
      optionHint.textContent = defaultHint;
    });
    element.addEventListener('focus', () => {
      optionHint.textContent = element.getAttribute('data-tip');
    });
    element.addEventListener('blur', () => {
      optionHint.textContent = defaultHint;
    });
  });
    console.error('[InheritiGuard Popup] Error getting status:', error);
  });

  toggle.addEventListener('change', () => {
    sendAction({ action: 'toggleEnabled', enabled: toggle.checked })
      .then(updateUI)
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error toggling enabled state:', error);
        toggle.checked = !toggle.checked;
      });
  });

  apiToggle.addEventListener('change', () => {
    sendAction({ action: 'toggleApiBlocking', enabled: apiToggle.checked })
      .then(updateUI)
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error toggling API blocking:', error);
        apiToggle.checked = !apiToggle.checked;
      });
  });

  clipboardToggle.addEventListener('change', () => {
    sendAction({ action: 'toggleClipboardGuard', enabled: clipboardToggle.checked })
      .then(updateUI)
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error toggling clipboard guard:', error);
        clipboardToggle.checked = !clipboardToggle.checked;
      });
  });

  idleToggle.addEventListener('change', () => {
    sendAction({ action: 'toggleIdleLock', enabled: idleToggle.checked })
      .then(updateUI)
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error toggling idle lock:', error);
        idleToggle.checked = !idleToggle.checked;
      });
  });

  idleMinutesInput.addEventListener('change', () => {
    const minutes = Math.max(1, Math.min(120, Number(idleMinutesInput.value) || 10));
    idleMinutesInput.value = minutes;
    sendAction({ action: 'setIdleLockMinutes', minutes })
      .then(updateUI)
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error saving idle minutes:', error);
      });
  });

  downloadToggle.addEventListener('change', () => {
    sendAction({ action: 'toggleDownloadTrap', enabled: downloadToggle.checked })
      .then(updateUI)
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error toggling download trap:', error);
        downloadToggle.checked = !downloadToggle.checked;
      });
  });

  secureLeaveButton.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Log off the Inheriti ecosystem?\n\nThis closes Inheriti, SafeTech, and SafeKey tabs and clears cookies and site data for those sessions.'
    );
    if (!confirmed) {
      return;
    }

    secureLeaveButton.disabled = true;
    try {
      const result = await sendAction({ action: 'secureLeave' });
      updateUI(result);
    } catch (error) {
      console.error('[InheritiGuard Popup] Secure logoff failed:', error);
    } finally {
      secureLeaveButton.disabled = false;
    }
  });

  try {
    const manifest = chrome.runtime.getManifest();
    const versionLink = document.getElementById('versionLink');
    if (versionLink) {
      versionLink.textContent = `v${manifest.version}`;
      versionLink.href = manifest.homepage_url || '#';
      versionLink.target = '_blank';
    }
  } catch (error) {
    console.error('[InheritiGuard Popup] Error setting version:', error);
  }
});
