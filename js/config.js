/* MEC CRM – producción. Solo la clave PUBLICABLE/anon (JWT); jamás una clave secreta de servidor. */
window.MEC_CRM_CONFIG = {
  SUPABASE_URL: "https://skhvrdhgyuqtyyubzack.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNraHZyZGhneXVxdHl5dWJ6YWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5Njc2NTYsImV4cCI6MjEwNzU0MzY1Nn0.azJ0ZY9y5UXf-d8T1xeRkqEl4l7EaJuj85gkbJYdUV8",
  TZ: "America/Bogota",
  /* Funciones terminadas en el código pero con su migración SIN aplicar en producción: apagadas. Encender una SOLO después de aplicar su SQL (ver release_20261023/LEEME_RELEASE.md). */
  FEATURES: { clave_obligatoria: false, correo_recuperacion: false, google_meet: false }
};
