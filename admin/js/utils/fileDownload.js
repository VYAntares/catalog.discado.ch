/**
 * admin/js/utils/fileDownload.js
 *
 * Downloads a file from an authenticated API URL.
 * - Mobile (iOS/Android, web or Capacitor app): native share sheet
 * - Desktop: standard browser download
 *
 * Also registers as window.downloadOrShareFile for inline/onclick use.
 */
async function downloadOrShareFile(url, filename, mimeType = 'application/pdf') {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur HTTP ${res.status}`);
    }
    const blob = await res.blob();

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = isIOS || /Android/i.test(navigator.userAgent);

    // Mobile: try native share sheet
    if (isMobile && navigator.share) {
        try {
            const file = new File([blob], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            // share failed — fall through to overlay on iOS, download on Android
        }
    }

    // iOS without working share: show in-app PDF overlay with share button
    if (isIOS) {
        _showPdfOverlay(blob, filename, mimeType);
        return;
    }

    // Desktop / Android fallback: trigger browser download
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

function _showPdfOverlay(blob, filename, mimeType) {
    document.getElementById('cap-pdf-overlay')?.remove();

    const objectUrl = URL.createObjectURL(blob);

    const overlay = document.createElement('div');
    overlay.id = 'cap-pdf-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;'
        + 'background:rgba(0,0,0,0.92);display:flex;flex-direction:column;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;'
        + 'padding:10px 14px;background:#1a1a2e;flex-shrink:0;gap:8px;';

    const title = document.createElement('span');
    title.textContent = filename;
    title.style.cssText = 'color:#fff;font-size:13px;font-weight:600;overflow:hidden;'
        + 'text-overflow:ellipsis;white-space:nowrap;flex:1;';
    header.appendChild(title);

    const shareBtn = document.createElement('button');
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i> Partager';
    shareBtn.style.cssText = 'background:#3498db;color:#fff;border:none;padding:8px 14px;'
        + 'border-radius:6px;font-size:13px;cursor:pointer;flex-shrink:0;';
    shareBtn.addEventListener('click', async () => {
        try {
            const file = new File([blob], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
        } catch (e) {
            if (e.name !== 'AbortError') console.warn('Share failed:', e);
        }
    });
    header.appendChild(shareBtn);

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

    const viewer = document.createElement('iframe');
    viewer.src = objectUrl;
    viewer.style.cssText = 'flex:1;border:none;background:#fff;';
    overlay.appendChild(viewer);

    document.body.appendChild(overlay);
}

// Register globally so inline onclick handlers work even without ES module import
window.downloadOrShareFile = downloadOrShareFile;

// Also export for ES module consumers
export { downloadOrShareFile };
