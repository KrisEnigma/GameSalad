export class GameTimer {
  constructor(element) {
    this.element = element;
    this.startTime = 0;
    this.elapsed = 0;
    this.interval = null;
    this.isPaused = false;
  }

  start() {
    this.startTime = Date.now() - this.elapsed;
    this.isPaused = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = setInterval(() => {
      if (!this.isPaused) {
        this.elapsed = Date.now() - this.startTime;
        this.updateDisplay();
      }
    }, 100);
  }

  pause() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.elapsed = Date.now() - this.startTime;
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.startTime = Date.now() - this.elapsed;
    }
  }

  reset() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.elapsed = 0;
    this.isPaused = false;
    this.updateDisplay();
  }

  updateDisplay() {
    const seconds = Math.floor(this.elapsed / 1000);
    const minutes = Math.floor(seconds / 60);

    this.element.querySelector(".minutes").textContent = String(
      minutes
    ).padStart(2, "0");
    this.element.querySelector(".seconds").textContent = String(
      seconds % 60
    ).padStart(2, "0");
  }

  getState() {
    return {
      startTime: this.startTime,
      pausedAt: this.pausedAt,
      totalPausedTime: this.totalPausedTime,
      isPaused: this.isPaused,
    };
  }
}
