# Inheriti®Guard

InheritiGuard is a security-focused browser extension that protects you while using the Inheriti platform by restricting access to untrusted domains, enforcing strict content security policies, and blocking sensitive browser features to prevent data leaks, phishing, and unauthorized tracking.

It also helps you leave Inheriti sessions safely: a targeted clipboard leak guard, idle lock with a custom timeout, one-click secure logoff from the Inheriti ecosystem, and a download/file trap for risky files.

[![Latest Release](https://img.shields.io/github/v/release/safetechio/InheritiGuard?display_name=tag&sort=semver&style=for-the-badge&logo=github)](https://github.com/safetechio/InheritiGuard/releases/latest)


https://chromewebstore.google.com/detail/kebghapddpgnfjpkecphjecbffdhodln?utm_source=item-share-cb

## Features List

### URL Filtering Protection
To keep you safe online, it’s essential to control which websites and resources your browser can connect to. Hackers often use deceptive or malicious websites to steal your data or compromise your account.

URL Filtering Protection ensures your browser connects only to trusted Inheriti domains and essential dependencies, so you can focus on using the platform securely and with confidence.

This feature protects you by:

- Restricting network connections to trusted and verified domains associated with Inheriti
- Preventing data leakage to unauthorized or unknown sites
- Blocking harmful redirects that could lead you to phishing or malware-infected pages
- Minimizing exposure to third-party trackers.

### Content Security Policy (CSP) Protection
Websites often load content from multiple sources, including scripts, images, styles, and data from other sites. Unfortunately, this can introduce malicious code from untrusted sources, putting your sensitive information at risk.

CSP Protection enhances your browsing security by enforcing strict policies that determine which content a website is permitted to load, providing a safer, more controlled browsing experience.

This feature protects you by:
- Blocking malicious scripts from untrusted sources
- Preventing data theft through unauthorized scripts
- Restricting connections to suspicious or untrusted domains.

### Sensitive API Blocking
Your browser provides websites with access to certain features, like your location, camera, and microphone. While these features can be useful, they also introduce potential security risks if misused by malicious sites.

Sensitive API Blocking protects your privacy by restricting access to those features—blocking suspicious requests, alerting you, and keeping you in control.

This feature prevents:

- Tracking your location without permission
- Accessing your camera or microphone without your knowledge
- Tracking your device usage through battery status
- Manipulating notifications or background services (such as push messages)

### Clipboard Leak Guard
A total clipboard block would break normal Inheriti use, such as copying recovery codes or account details. Clipboard Leak Guard is targeted instead: it still lets you copy and paste on Inheriti, SafeTech, and SafeKey, and only steps in when that data is about to leave the ecosystem.

When you copy something on an Inheriti page, InheritiGuard treats it as sensitive for a short time (five minutes). On untrusted sites it then:

- Blocks paste of Inheriti URLs (for example `app.inheriti.com`) so they cannot be dropped into a phishing form
- Blocks paste of that recently copied Inheriti content
- Blocks JavaScript clipboard reads while an Inheriti tab is still open, so a malicious page cannot silently steal what you copied

Copied text is never sent to InheritiGuard itself—only a signal that a copy happened on a trusted Inheriti page. You can turn this guard on or off in the popup. Hover the option for a short explanation of what it does.

### Idle Lock
Inheriti dashboards are often left open on a desk or shared computer. Idle Lock watches for inactivity and then logs you off the Inheriti ecosystem automatically.

You choose the timeout in the popup (1 to 120 minutes; the default is 120). When your computer is idle for that long, or the screen is locked, and Inheriti ecosystem tabs are open, Idle Lock:

- Closes Inheriti, SafeTech, and SafeKey tabs
- Clears cookies and site data for those sessions
- Stops a forgotten session from staying signed in after you walk away

Idle Lock does not close unrelated tabs (email, docs, and so on). You can disable it, or change the minutes, at any time. Hover the option in the popup for a short explanation.

### Secure Logoff
Secure Logoff is a safe, intentional way to leave the Inheriti ecosystem when you are done—on a work laptop, a shared machine, or before you step away.

One click in the popup:

- Closes all open Inheriti, SafeTech, and SafeKey tabs
- Clears cookies and site data for those origins
- Turns off the global sensitive-API lock for that session

It does not uninstall InheritiGuard or turn off URL filtering. You stay protected the next time you open Inheriti. Hover the button for a short explanation of what it does.

### Download / File Trap
Phishing kits often try to drop a fake login page or a hostile file from a session that already looks legitimate. Download / File Trap watches downloads and inline documents that come from an Inheriti session.

It blocks:

- Risky file types from Inheriti origins, including HTML, SVG, JavaScript, and common executables (for example `.exe`, `.msi`, `.bat`, `.apk`)
- Inline fake pages opened as `data:` or `blob:` HTML/SVG documents from an Inheriti tab

Normal documents from Inheriti (such as PDFs) are not blocked. When a trap fires, InheritiGuard cancels the download or navigation and shows a security notification. You can turn this protection on or off in the popup. Hover the option for a short explanation.
