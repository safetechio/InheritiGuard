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

  let uiEpoch = 0;
  let applyingStatus = false;

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

  function updateUI(status, epoch) {
    if (!status) {
      console.error('[InheritiGuard Popup] Invalid status received');
      return;
    }
    if (typeof epoch === 'number' && epoch !== uiEpoch) {
      return;
    }

    applyingStatus = true;
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
    } finally {
      applyingStatus = false;
    }
  }

  function bindToggle(element, action) {
    element.addEventListener('change', () => {
      if (applyingStatus) {
        return;
      }
      const epoch = ++uiEpoch;
      sendAction({ action, enabled: element.checked })
        .then((status) => updateUI(status, epoch))
        .catch((error) => {
          console.error(`[InheritiGuard Popup] Error handling ${action}:`, error);
          if (epoch === uiEpoch) {
            element.checked = !element.checked;
          }
        });
    });
  }

  const cursorTip = document.getElementById('cursorTip');

  function placeCursorTip(event) {
    const offset = 14;
    const margin = 8;
    cursorTip.style.left = '0px';
    cursorTip.style.top = '0px';
    const tipWidth = cursorTip.offsetWidth;
    const tipHeight = cursorTip.offsetHeight;
    const maxLeft = document.documentElement.clientWidth - tipWidth - margin;
    const maxTop = document.documentElement.clientHeight - tipHeight - margin;
    const left = Math.max(margin, Math.min(event.clientX + offset, maxLeft));
    const top = Math.max(margin, Math.min(event.clientY + offset, maxTop));
    cursorTip.style.left = `${left}px`;
    cursorTip.style.top = `${top}px`;
  }

  document.querySelectorAll('[data-tip]').forEach((element) => {
    element.addEventListener('mouseenter', (event) => {
      cursorTip.textContent = element.getAttribute('data-tip');
      cursorTip.hidden = false;
      placeCursorTip(event);
    });
    element.addEventListener('mousemove', (event) => {
      if (!cursorTip.hidden) {
        placeCursorTip(event);
      }
    });
    element.addEventListener('mouseleave', () => {
      cursorTip.hidden = true;
      cursorTip.textContent = '';
    });
  });

  const loadEpoch = uiEpoch;
  sendAction({ action: 'getStatus' })
    .then((status) => updateUI(status, loadEpoch))
    .catch((error) => {
      console.error('[InheritiGuard Popup] Error getting status:', error);
    });

  bindToggle(toggle, 'toggleEnabled');
  bindToggle(apiToggle, 'toggleApiBlocking');
  bindToggle(clipboardToggle, 'toggleClipboardGuard');
  bindToggle(idleToggle, 'toggleIdleLock');
  bindToggle(downloadToggle, 'toggleDownloadTrap');

  idleMinutesInput.addEventListener('change', () => {
    if (applyingStatus) {
      return;
    }
    const minutes = Math.max(1, Math.min(120, Number(idleMinutesInput.value) || 120));
    idleMinutesInput.value = minutes;
    const epoch = ++uiEpoch;
    sendAction({ action: 'setIdleLockMinutes', minutes })
      .then((status) => updateUI(status, epoch))
      .catch((error) => {
        console.error('[InheritiGuard Popup] Error saving idle minutes:', error);
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
    const epoch = ++uiEpoch;
    try {
      const result = await sendAction({ action: 'secureLeave' });
      updateUI(result, epoch);
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
