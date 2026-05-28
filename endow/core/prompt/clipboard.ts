export function copyToClipboard(plainText: string, jsonData: Record<string, unknown>): void {
  const jsonStr = JSON.stringify(jsonData, null, 2);
  const htmlText = `<pre>${plainText}</pre>`;

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const plainBlob = new Blob([plainText], { type: 'text/plain' });
    const htmlBlob = new Blob([htmlText], { type: 'text/html' });
    const item = new ClipboardItem({
      'text/plain': plainBlob,
      'text/html': htmlBlob,
    });
    navigator.clipboard.write([item]).catch(() => {
      fallbackCopy(jsonStr);
    });
    return;
  }

  fallbackCopy(plainText);
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}
