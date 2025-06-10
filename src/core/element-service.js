export class ElementService {
  constructor() {
    this._elements = new Map();
    this._elementConfig = new Map();
  }

  registerElement(key, config) {
    this._elementConfig.set(key, {
      selector: config.selector,
      required: config.required ?? false,
      cached: config.cached ?? true,
    });
  }

  registerElements(configs) {
    Object.entries(configs).forEach(([key, config]) => {
      this.registerElement(key, config);
    });
  }

  getElement(key, forceRefresh = false) {
    if (!this._elementConfig.has(key)) {
      throw new Error(`No hay configuración para el elemento: ${key}`);
    }

    if (!forceRefresh && this._elements.has(key)) {
      return this._elements.get(key);
    }

    const config = this._elementConfig.get(key);
    const element = document.querySelector(config.selector);

    if (config.required && !element) {
      throw new Error(
        `Elemento requerido no encontrado: ${key} (${config.selector})`
      );
    }

    if (config.cached) {
      this._elements.set(key, element);
    }

    return element;
  }

  getElements(keys) {
    return Object.fromEntries(keys.map((key) => [key, this.getElement(key)]));
  }

  updateElement(key, element) {
    if (!this._elementConfig.has(key)) {
      throw new Error(`No hay configuración para el elemento: ${key}`);
    }
    this._elements.set(key, element);
  }

  clear() {
    this._elements.clear();
  }

  destroy() {
    this._elements.clear();
    this._elementConfig.clear();
  }
}