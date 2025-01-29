// .stylelintrc.js
export default {
    extends: ["stylelint-config-standard"],
    rules: {
        // Reglas de propiedades
        "property-no-unknown": true,
        "property-no-vendor-prefix": true,
        "declaration-block-no-duplicate-properties": true,

        // Reglas de selector 
        "selector-pseudo-class-no-unknown": true,
        "selector-pseudo-element-no-unknown": true,
        "selector-class-pattern": null,

        // Reglas de bloques
        "block-no-empty": true,
        "declaration-block-semicolon-newline-after": "always",

        // Permitir variables personalizadas
        "custom-property-pattern": null,
        "custom-property-empty-line-before": null,
        "custom-property-no-missing-var-function": null,

        // Reglas de medios
        "media-feature-name-no-unknown": true
    }
}