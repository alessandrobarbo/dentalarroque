/* Configuración de consentimiento compartida por todas las páginas.
   Cambiar `version` cuando cambien las cookies o sus finalidades: se volverá a pedir el consentimiento. */
window.CookieConsentConfig = {
  version: '2026-11-1',
  policyUrl: 'https://dentalarroque.es/aviso-legal-y-condiciones-de-uso/politica-de-cookies/',
  maxAgeDays: 365,
  texts: {
    body: 'Este sitio solo usa almacenamiento técnico propio. Los mapas de Google Maps son de un tercero que puede instalar cookies, por eso no se cargan salvo que los aceptes. Puedes cambiar tu decisión cuando quieras desde «Configurar cookies», al pie de la página.'
  },
  categories: [
    {
      id: 'mapas',
      label: 'Mapas de Google Maps',
      description: 'Muestra la ubicación de las clínicas con un mapa integrado de Google. Al cargarlo, Google puede instalar cookies y tratar datos de tu navegación según su política de privacidad. Sin aceptarlo, puedes abrir la ubicación con el botón «Cómo llegar».'
    }
  ]
};
