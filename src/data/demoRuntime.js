// Estado efímero compartido por los services cuando Supabase no está configurado.
// Mantiene coherentes las altas/ediciones durante la sesión actual del navegador.
export const demoClients = []
export const demoNutritionHistory = new Map()
export const demoWorkoutHistory = new Map()
