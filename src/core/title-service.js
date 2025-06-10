import { EventService } from './event-service.js';

export class TitleService {
  constructor(titleElement, container) {
    this.titleElement = titleElement;
    this.container = container;
    this.events = new EventService();
    this.observer = null;
    this.setupObserver();
  }

  setupObserver() {
    if (!this.container) return;
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(this.container);
  }

  updateTitle(text) {
    if (!this.titleElement || !text) return;
    this.titleElement.textContent = text;
    this.fit();
  }

  async fit() {
    if (!this.titleElement || !this.container) return;

    try {
      const containerWidth = this.container.offsetWidth;
      const titleWidth = this.titleElement.scrollWidth;
      const scale = Math.min(1, containerWidth / titleWidth);
      
      this.titleElement.style.transform = `scale(${scale})`;
      this.events.emit(EventService.EVENTS.TITLE_ADJUSTED, { scale });
      return scale;
    } catch (error) {
      console.error('Error adjusting title:', error);
      return 1;
    }
  }

  destroy() {
    this.observer?.disconnect();
    this.events.destroy();
    this.titleElement = null;
    this.container = null;
  }
}