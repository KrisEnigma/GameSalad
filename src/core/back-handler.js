/**
 * Maneja la navegación del botón Back de manera consistente
 */
export class BackHandler {
  /**
   * Maneja la presión del botón Back de Android
   * @returns {Promise<boolean>} true si el evento fue manejado, false si se debe minimizar la app
   */
  static async handleBackPress() {
    try {
      // Verificar si tenemos acceso al servicio UI
      if (!window.game?.uiService) {
        return false;
      }

      const modalStack = window.game.uiService._modalStack || [];

      // Caso 1: Modal de victoria - siempre minimiza
      if (this.#hasVictoryModal(modalStack)) {
        return false;
      }

      // Caso 2: Modal de temas - usar el botón back existente
      if (await this.#handleThemeModal(modalStack)) {
        return true;
      }

      // Caso 3: Otros modales - navegación estándar
      return await this.#handleRegularModals(modalStack);
    } catch (e) {
      console.error("[BACK] Error:", e);
      return false;
    }
  }

  static #hasVictoryModal(modalStack) {
    return modalStack.some(
      (modalId) =>
        modalId === "victory-modal" ||
        modalId === "modal-victoria" ||
        document.getElementById(modalId)?.classList.contains("victory-modal")
    );
  }

  static async #handleThemeModal(modalStack) {
    const currentModal = modalStack[modalStack.length - 1];
    if (currentModal === "theme-modal") {
      const backBtn = document.querySelector(".back-button");
      if (backBtn) {
        backBtn.click();
        return true;
      }

      // Alternativa: usar el método de navegación
      if (typeof window.game.uiService.navigateToPreviousModal === "function") {
        return await window.game.uiService.navigateToPreviousModal();
      }
    }
    return false;
  }

  static async #handleRegularModals(modalStack) {
    if (!modalStack.length) {
      return false;
    }

    const uiService = window.game.uiService;
    const currentModal = modalStack[modalStack.length - 1];

    // Para múltiples modales, usar navegación entre modales
    if (
      modalStack.length > 1 &&
      typeof uiService.navigateToPreviousModal === "function"
    ) {
      await uiService.navigateToPreviousModal();
      return true;
    }

    // Para un solo modal, usar hideModal
    await uiService.hideModal(currentModal);
    return true;
  }
}
