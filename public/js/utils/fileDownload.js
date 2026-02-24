/**
 * public/js/utils/fileDownload.js
 *
 * Downloads a file from an authenticated API URL.
 * On Capacitor iOS:  opens the native share sheet (or an in-app PDF overlay).
 * On iOS / Safari mobile: opens the native share sheet.
 * On desktop: triggers a standard browser download.
 */
export async function downloadOrShareFile(url, filename, mimeType = 'application/pdf') {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur HTTP ${res.status}`);
    }
    const blob = await res.blob();

    // Detect environment
    const isCapacitorNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = isIOS || /Android/i.test(navigator.userAgent);

    // On mobile / Capacitor: try native share sheet directly
    if ((isMobile || isCapacitorNative) && navigator.share) {
        try {
            const file = new File([blob], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return; // user cancelled
            console.warn('navigator.share failed:', err);

            // On Capacitor iOS the <a download> fallback opens Safari.
            // Instead, show an in-app PDF overlay with a fresh-gesture Share button.
            if (isCapacitorNative) {
                _showPdfOverlay(blob, filename, mimeType);
                return;
            }
        }
    }

    // Capacitor native without navigator.share — show overlay
    if (isCapacitorNative) {
        _showPdfOverlay(blob, filename, mimeType);
        return;
    }

    // Desktop / Safari fallback: trigger browser download
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/* ---------- Capacitor iOS in-app PDF overlay ---------- */

function _showPdfOverlay(blob, filename, mimeType) {
    // Remove any previous overlay
    document.getElementById('cap-pdf-overlay')?.remove();

    const objectUrl = URL.createObjectURL(blob);

    // Overlay container
    const overlay = document.createElement('div');
    overlay.id = 'cap-pdf-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;'
        + 'background:rgba(0,0,0,0.92);display:flex;flex-direction:column;';

    // Header bar
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;'
        + 'padding:10px 14px;background:#1a1a2e;flex-shrink:0;gap:8px;';

    const title = document.createElement('span');
    title.textContent = filename;
    title.style.cssText = 'color:#fff;font-size:13px;font-weight:600;overflow:hidden;'
        + 'text-overflow:ellipsis;white-space:nowrap;flex:1;';
    header.appendChild(title);

    // Share button — provides a FRESH user gesture so navigator.share works reliably
    const shareBtn = document.createElement('button');
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i> Partager';
    shareBtn.style.cssText = 'background:#3498db;color:#fff;border:none;padding:8px 14px;'
        + 'border-radius:6px;font-size:13px;cursor:pointer;flex-shrink:0;';
    shareBtn.addEventListener('click', async () => {
        try {
            const file = new File([blob], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
        } catch (e) {
            if (e.name !== 'AbortError') console.warn('Share from overlay failed:', e);
        }
    });
    header.appendChild(shareBtn);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:8px 14px;'
        + 'border-radius:6px;font-size:15px;cursor:pointer;flex-shrink:0;';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        URL.revokeObjectURL(objectUrl);
    });
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // PDF viewer (iframe with blob URL)
    const viewer = document.createElement('iframe');
    viewer.src = objectUrl;
    viewer.style.cssText = 'flex:1;border:none;background:#fff;';
    overlay.appendChild(viewer);

    document.body.appendChild(overlay);
}
