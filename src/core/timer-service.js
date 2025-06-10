import { EventService } from "./event-service.js";

export class TimerService {
  static EVENTS = {
    TIMER_START: "timer-start",
    TIMER_PAUSE: "timer-pause",
    TIMER_RESUME: "timer-resume",
    TIMER_RESET: "timer-reset",
    TIMER_TICK: "timer-tick",
  };

  constructor(timerElement) {
    this.element = timerElement;
    this.startTime = 0;
    this.elapsed = 0;
    this.interval = null;
    this.isPaused = false;
    this.events = new EventService();

    this.minutesElement = timerElement.querySelector(".minutes");
    this.secondsElement = timerElement.querySelector(".seconds");
  }

  // Añadimos esta propiedad para verificar el estado del timer fácilmente
  get isRunning() {
    return this.interval !== null && !this.isPaused;
  }

  start() {
    this.startTime = Date.now() - this.elapsed;
    this.isPaused = false;
    this.clearInterval();
    this.interval = setInterval(() => this.tick(), 100);
    this.events.emit(TimerService.EVENTS.TIMER_START);
    console.log("[TIMER] Timer iniciado");
  }

  tick() {
    if (!this.isPaused) {
      this.elapsed = Date.now() - this.startTime;
      this.updateDisplay();
      this.events.emit(TimerService.EVENTS.TIMER_TICK, {
        elapsed: this.elapsed,
      });
    }
  }

  pause() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.elapsed = Date.now() - this.startTime;
      this.events.emit(TimerService.EVENTS.TIMER_PAUSE, {
        elapsed: this.elapsed,
      });
      console.log("[TIMER] Timer pausado");
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.startTime = Date.now() - this.elapsed;
      this.events.emit(TimerService.EVENTS.TIMER_RESUME, {
        elapsed: this.elapsed,
      });
      console.log("[TIMER] Timer reanudado");
    }
  }

  reset() {
    this.clearInterval();
    this.elapsed = 0;
    this.isPaused = false;
    this.updateDisplay();
    this.events.emit(TimerService.EVENTS.TIMER_RESET);
    console.log("[TIMER] Timer reseteado");
  }

  clearInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  updateDisplay() {
    if (!this.minutesElement || !this.secondsElement) return;

    const seconds = Math.floor(this.elapsed / 1000);
    const minutes = Math.floor(seconds / 60);

    this.minutesElement.textContent = String(minutes).padStart(2, "0");
    this.secondsElement.textContent = String(seconds % 60).padStart(2, "0");
  }

  getTimeString() {
    const seconds = Math.floor(this.elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(
      2,
      "0"
    )}`;
  }

  getState() {
    return {
      startTime: this.startTime,
      elapsed: this.elapsed,
      isPaused: this.isPaused,
      isRunning: this.isRunning,
    };
  }

  destroy() {
    this.clearInterval();
    this.events.destroy();
    this.element = null;
    this.minutesElement = null;
    this.secondsElement = null;
  }
}
