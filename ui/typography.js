export class TitleFitter {
  constructor(titleElement) {
    this.titleElement = titleElement;
    this.setupResizeHandler();
  }

  setupResizeHandler() {
    const resizeHandler = () => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = setTimeout(() => this.fit(), 100);
    };

    window.addEventListener("resize", resizeHandler);
    this.resizeHandler = resizeHandler;
  }

  async fit() {
    if (!this.titleElement) return;

    const containerWidth = this.titleElement.parentElement?.clientWidth || 0;
    if (!containerWidth) return;

    let currentSize = parseInt(getComputedStyle(this.titleElement).fontSize);
    let scale = 1;

    // Medir tamaño actual
    const titleWidth = this.titleElement.scrollWidth;
    if (titleWidth > containerWidth) {
      scale = containerWidth / titleWidth;
      this.titleElement.style.fontSize = `${currentSize * scale}px`;
    }

    return scale;
  }
}