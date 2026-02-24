/**
 * admin/js/utils/fileDownload.js
 *
 * Downloads a file from an authenticated API URL.
 * On iOS / mobile devices that support the Web Share API with files,
 * this opens the native share sheet (AirDrop, Mail, Print, Save to Files, …)
 * so the user never leaves the app.
 * On desktop / unsupported browsers it falls back to a standard <a download> click.
 *
 * @param {string} url       - Authenticated API endpoint that returns the file
 * @param {string} filename  - Suggested filename (e.g. "Invoice_12345.pdf")
 * @param {string} [mimeType='application/pdf']
 */
export async function downloadOrShareFile(url, filename, mimeType = 'application/pdf') {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur HTTP ${res.status}`);
    }
    const blob = await res.blob();

    // --- iOS / mobile: use native share sheet ---
    if (navigator.canShare && navigator.share) {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            return;
        }
    }

    // --- Desktop fallback: trigger browser download ---
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
}
