// ===== BUBBLE MONITOR SCRIPT =====
// Ejecutar en la consola del navegador para monitorear burbujas

console.log('🎯 [BUBBLE-MONITOR] Script de monitoreo iniciado');

// Monitor para filtrar y seguir logs específicos de burbujas
window.bubbleMonitor = {
  enabled: true,
  logs: [],
  
  // Interceptar console.log para capturar logs de burbujas
  start() {
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      // Capturar logs de burbujas específicos
      if (args[0] && (args[0].includes('[BUBBLE]') || args[0].includes('[BUBBLE-TRACK]'))) {
        this.logs.push({
          type: 'log',
          timestamp: new Date().toISOString(),
          args: args
        });
        
        // Log con estilo destacado
        originalLog('🎯', ...args);
        
        // Análisis automático
        this.analyze(args);
      } else {
        originalLog(...args);
      }
    };
    
    console.error = (...args) => {
      if (args[0] && args[0].includes('[BUBBLE]')) {
        this.logs.push({
          type: 'error', 
          timestamp: new Date().toISOString(),
          args: args
        });
        
        originalError('💥🎯', ...args);
      } else {
        originalError(...args);
      }
    };
    
    console.log('✅ [BUBBLE-MONITOR] Interceptores activados');
  },
  
  // Análisis automático de patrones
  analyze(args) {
    const logText = args[0];
    
    if (logText.includes('THINK_BUBBLES_DETECTED')) {
      console.log('🟢 [MONITOR] ¡Burbujas detectadas!', args[1]);
    }
    
    if (logText.includes('BUBBLE_RENDERING')) {
      console.log('🟡 [MONITOR] Renderizando burbuja', args[1]);
    }
    
    if (logText.includes('COMPONENT_RENDER')) {
      const data = args[2];
      if (data && data.hasThinkTags) {
        console.log('🔵 [MONITOR] Componente con think tags renderizado', {
          msgId: args[1].substring(0, 8),
          contentLength: data.contentLength
        });
      }
    }
  },
  
  // Ver resumen de actividad
  summary() {
    console.log('📊 [BUBBLE-MONITOR] RESUMEN:');
    console.log(`   📝 Total logs: ${this.logs.length}`);
    
    const detections = this.logs.filter(l => l.args[0].includes('THINK_BUBBLES_DETECTED'));
    console.log(`   🧠 Detecciones de burbujas: ${detections.length}`);
    
    const renders = this.logs.filter(l => l.args[0].includes('BUBBLE_RENDERING'));
    console.log(`   🎨 Renders de burbujas: ${renders.length}`);
    
    const componentRenders = this.logs.filter(l => l.args[0].includes('COMPONENT_RENDER'));
    console.log(`   🔄 Renders de componente: ${componentRenders.length}`);
    
    // Últimas 5 actividades
    console.log('📋 Últimas 5 actividades:');
    this.logs.slice(-5).forEach((log, i) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`   ${i+1}. [${time}] ${log.args[0]}`);
    });
  },
  
  // Limpiar logs
  clear() {
    this.logs = [];
    console.log('🧹 [BUBBLE-MONITOR] Logs limpiados');
  },
  
  // Buscar patrones específicos
  findPattern(pattern) {
    const matches = this.logs.filter(l => 
      JSON.stringify(l.args).toLowerCase().includes(pattern.toLowerCase())
    );
    console.log(`🔍 [BUBBLE-MONITOR] Encontradas ${matches.length} coincidencias para "${pattern}"`);
    return matches;
  },
  
  // Detectar problemas automáticamente
  detectIssues() {
    console.log('🔍 [BUBBLE-MONITOR] Analizando problemas...');
    
    // ¿Hay detecciones sin renders?
    const detections = this.logs.filter(l => l.args[0].includes('THINK_BUBBLES_DETECTED'));
    const renders = this.logs.filter(l => l.args[0].includes('BUBBLE_RENDERING'));
    
    if (detections.length > renders.length) {
      console.warn('⚠️ [PROBLEMA] Más detecciones que renders - posibles burbujas perdidas');
    }
    
    // ¿Hay muchos renders del componente?
    const componentRenders = this.logs.filter(l => l.args[0].includes('COMPONENT_RENDER'));
    if (componentRenders.length > 10) {
      console.warn('⚠️ [PROBLEMA] Muchos renders del componente - posible loop');
    }
    
    // ¿Hay cambios frecuentes de contenido?
    const recentLogs = this.logs.slice(-10);
    const contentChanges = recentLogs.filter(l => l.args[0].includes('contentLength'));
    if (contentChanges.length > 5) {
      console.warn('⚠️ [PROBLEMA] Cambios frecuentes de contenido - posible streaming problemático');
    }
  }
};

// Comandos rápidos
console.log('📖 [BUBBLE-MONITOR] Comandos disponibles:');
console.log('   bubbleMonitor.start() - Iniciar monitoreo');
console.log('   bubbleMonitor.summary() - Ver resumen');
console.log('   bubbleMonitor.detectIssues() - Detectar problemas');
console.log('   bubbleMonitor.clear() - Limpiar logs');

// Auto-start
window.bubbleMonitor.start(); 


// Pegar esto en la consola de Chrome/Edge:
console.clear();
console.log("=== EMPEZANDO CAPTURA COMPLETA ===");

// Interceptar console.log para expandir objetos automáticamente
const originalLog = console.log;
console.log = function(...args) {
  args.forEach(arg => {
    if (typeof arg === 'object' && arg !== null) {
      originalLog(JSON.stringify(arg, null, 2));
    } else {
      originalLog(arg);
    }
  });
};

// Hacer la pregunta ahora y todos los objetos saldrán expandidos