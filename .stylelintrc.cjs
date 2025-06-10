module.exports = {
  extends: ["stylelint-config-standard", "stylelint-config-recess-order"],
  rules: {
    // Reglas fundamentales
    "no-invalid-position-at-import-rule": null,
    "no-descending-specificity": null,
    "property-no-unknown": true,
    "declaration-block-no-duplicate-properties": true,
    "no-duplicate-selectors": null, // Permitir selectores duplicados
    "declaration-property-value-no-unknown": null, // Permitir valores CSS personalizados

    // Reglas de selectores y clases
    "selector-pseudo-class-no-unknown": true,
    "selector-pseudo-element-no-unknown": true,
    "selector-class-pattern": null,
    "selector-not-notation": "complex",

    // Reglas de espaciado y formato
    "rule-empty-line-before": null, // Deshabilitar regla de líneas vacías
    "custom-property-no-missing-var-function": null, // Permitir variables sin var()

    // Reglas modernas
    "alpha-value-notation": "number",
    "color-function-notation": "modern",
    "import-notation": "string",
    "media-feature-range-notation": "context",

    // Variables y propiedades personalizadas
    "custom-property-pattern": null,
    "property-no-vendor-prefix": null,

    // Otras reglas
    "no-empty-source": null,
    "at-rule-no-unknown": null,
    "value-keyword-case": [
      "lower",
      {
        ignoreProperties: ["/$-/"],
      },
    ],
  },
};
