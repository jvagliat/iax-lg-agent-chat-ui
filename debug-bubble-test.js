// ===== SCRIPT DE TESTING AUTOMÁTICO PARA BURBUJAS =====
// Este script puede ser ejecutado en la consola del navegador para simular scenarios

console.log('🧪 [BUBBLE-TEST] Iniciando tests automáticos de burbujas...');

// Simulador de contenido estructurado
const testContents = [
  // Caso 1: JSON válido con logic
  '{"logic": "Estoy analizando tu pregunta sobre vuelos. Necesito considerar varios factores..."}',
  
  // Caso 2: JSON con steps
  '{"steps": ["Analizar destino", "Buscar opciones", "Comparar precios", "Recomendar mejor opción"]}',
  
  // Caso 3: JSON con reasoning
  '{"reasoning": "Basándome en los datos disponibles, considero que la mejor opción es..."}',
  
  // Caso 4: JSON parcial (streaming)
  '{"logic": "Empezando análisis...',
  
  // Caso 5: Contenido mixto
  '{"logic": "Análisis completo", "type": "travel_planning"}',
  
  // Caso 6: Texto normal (no debería crear burbuja)
  'Esta es una respuesta normal sin estructura JSON.',
  
  // Caso 7: Transición streaming (cambio de contenido)
  '{"log', // parcial
  '{"logic": "Contenido completo"}' // completo
];

// Función para simular streaming de contenido
function simulateStreamingBubble(messageId, contents, delay = 1000) {
  console.log(`🌊 [BUBBLE-TEST] Simulando streaming para mensaje ${messageId.substring(0, 8)}`);
  
  let currentIndex = 0;
  
  const streamInterval = setInterval(() => {
    if (currentIndex < contents.length) {
      const content = contents[currentIndex];
      console.log(`📝 [BUBBLE-TEST] Enviando contenido ${currentIndex + 1}/${contents.length}:`, content.substring(0, 50) + '...');
      
      // Simular detección de contenido estructurado
      try {
        const parsed = JSON.parse(content);
        console.log(`✅ [BUBBLE-TEST] JSON válido detectado:`, Object.keys(parsed));
      } catch (e) {
        console.log(`❌ [BUBBLE-TEST] No es JSON válido`);
      }
      
      currentIndex++;
    } else {
      clearInterval(streamInterval);
      console.log(`🎯 [BUBBLE-TEST] Streaming completado para ${messageId.substring(0, 8)}`);
    }
  }, delay);
  
  return streamInterval;
}

// Función para verificar estado del storage
function checkStorageState() {
  console.log('📦 [BUBBLE-TEST] Estado actual del storage:');
  if (typeof structuredDataStorage !== 'undefined') {
    console.log(`   - Tamaño: ${structuredDataStorage.size}`);
    console.log(`   - Claves:`, Array.from(structuredDataStorage.keys()).map(k => k.substring(0, 8)));
    
    for (const [key, value] of structuredDataStorage.entries()) {
      console.log(`   - ${key.substring(0, 8)}: ${value.type} (${value.detectorName})`);
    }
  } else {
    console.log('   ⚠️ structuredDataStorage no está disponible');
  }
}

// Función para generar IDs únicos de mensajes
function generateMessageId() {
  return 'test-msg-' + Math.random().toString(36).substring(2, 15);
}

// Test automático principal
function runAutomatedBubbleTest() {
  console.log('🚀 [BUBBLE-TEST] Ejecutando test automático completo...');
  
  // Test 1: Mensaje con logic simple
  const msg1 = generateMessageId();
  console.log('🧪 [BUBBLE-TEST] Test 1 - Logic simple');
  simulateStreamingBubble(msg1, [testContents[0]], 500);
  
  // Test 2: Mensaje con steps (después de 3 segundos)
  setTimeout(() => {
    const msg2 = generateMessageId();
    console.log('🧪 [BUBBLE-TEST] Test 2 - Steps');
    simulateStreamingBubble(msg2, [testContents[1]], 500);
  }, 3000);
  
  // Test 3: Streaming parcial → completo (después de 6 segundos)
  setTimeout(() => {
    const msg3 = generateMessageId();
    console.log('🧪 [BUBBLE-TEST] Test 3 - Streaming transition');
    simulateStreamingBubble(msg3, [testContents[3], testContents[0]], 1000);
  }, 6000);
  
  // Chequeo de storage cada 2 segundos
  const storageInterval = setInterval(() => {
    checkStorageState();
  }, 2000);
  
  // Parar el test después de 15 segundos
  setTimeout(() => {
    clearInterval(storageInterval);
    console.log('✅ [BUBBLE-TEST] Test automático completado');
  }, 15000);
}

// Funciones de utilidad para debugging manual
window.bubbleTestUtils = {
  runTest: runAutomatedBubbleTest,
  checkStorage: checkStorageState,
  simulateStreaming: simulateStreamingBubble,
  testContents: testContents,
  
  // Test específico para reproducir problema de desaparición
  reproduceDisappearance: function(messageId) {
    console.log('💥 [BUBBLE-TEST] Reproduciendo desaparición de burbujas...');
    
    // Simular: JSON válido → contenido cambia → burbuja desaparece
    const validJson = '{"logic": "Análisis inicial completo"}';
    const invalidContent = 'Respuesta final sin JSON';
    
    console.log('1. Enviando JSON válido...');
    simulateStreamingBubble(messageId || generateMessageId(), [validJson], 1000);
    
    setTimeout(() => {
      console.log('2. Enviando contenido no-JSON (aquí debería desaparecer la burbuja)...');
      simulateStreamingBubble(messageId || generateMessageId(), [invalidContent], 1000);
    }, 2000);
  }
};

console.log('✅ [BUBBLE-TEST] Script cargado. Usa window.bubbleTestUtils para testing manual');
console.log('📖 [BUBBLE-TEST] Comandos disponibles:');
console.log('   - bubbleTestUtils.runTest() - Test automático completo');
console.log('   - bubbleTestUtils.checkStorage() - Ver estado del storage');
console.log('   - bubbleTestUtils.reproduceDisappearance() - Reproducir problema'); 