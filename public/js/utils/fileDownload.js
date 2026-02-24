/**
 * public/js/utils/fileDownload.js
 *
 * Downloads a file from an authenticated API URL.
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

    // Detect iOS / mobile
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = isIOS || /Android/i.test(navigator.userAgent);

    // On mobile: try native share sheet directly (skip canShare check)
    if (isMobile && navigator.share) {
        try {
            const file = new File([blob], filename, { type: mimeType });
            await navigator.share({ files: [file], title: filename });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return; // user cancelled
            console.warn('navigator.share failed, falling back to download:', err);
        }
    }

    // Desktop fallback: trigger browser download
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
