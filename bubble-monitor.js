// ===== BUBBLE MONITOR SCRIPT =====
// DESACTIVADO TEMPORALMENTE PARA EVITAR BUCLES INFINITOS

console.log('🎯 [BUBBLE-MONITOR] Script de monitoreo DESACTIVADO');

// Monitor desactivado para evitar bucles infinitos
window.bubbleMonitor = {
  enabled: false,
  logs: [],
  
  // Función dummy que no hace nada
  start() {
    console.log('⚠️ [BUBBLE-MONITOR] Monitor desactivado para evitar bucles infinitos');
  },
  
  // Función dummy que no hace nada
  stop() {
    console.log('⚠️ [BUBBLE-MONITOR] Monitor ya está desactivado');
  },
  
  // Función para obtener estadísticas sin logs
  getStats() {
    return { message: 'Monitor desactivado' };
  }
};

// NO INTERCEPTAR NADA - MANTENER CONSOLE.LOG ORIGINAL
console.log('✅ [BUBBLE-MONITOR] Monitor completamente desactivado');