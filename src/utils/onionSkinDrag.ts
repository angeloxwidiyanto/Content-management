import type React from 'react';

/**
 * Creates a crisp, translucent onion-skin drag ghost attached to the cursor
 * during HTML5 drag-and-drop, then removes the off-screen clone on the next frame.
 */
export function applyOnionDragGhost(
  e: React.DragEvent<HTMLElement>,
  sourceEl: HTMLElement
): void {
  if (!e.dataTransfer || typeof e.dataTransfer.setDragImage !== 'function') {
    return;
  }

  try {
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true) as HTMLElement;

    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.width = `${rect.width}px`;
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0.84';
    clone.style.transform = 'rotate(1.1deg) scale(1.015)';
    clone.style.borderRadius = getComputedStyle(sourceEl).borderRadius || '12px';
    clone.style.boxShadow =
      '0 18px 36px -10px rgba(0, 113, 227, 0.28), 0 0 0 1.5px rgba(0, 113, 227, 0.45)';
    clone.style.backgroundColor = 'rgba(255, 255, 255, 0.94)';
    clone.style.zIndex = '9999';

    document.body.appendChild(clone);

    const offsetX = Math.max(
      12,
      Math.min(rect.width - 12, e.clientX - rect.left)
    );
    const offsetY = Math.max(
      12,
      Math.min(rect.height - 12, e.clientY - rect.top)
    );

    e.dataTransfer.setDragImage(clone, offsetX, offsetY);

    window.requestAnimationFrame(() => {
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    });
  } catch {
    // Gracefully fall back to native browser drag image
  }
}
