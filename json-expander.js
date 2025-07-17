// ===== JSON EXPANDER SCRIPT =====
// Script seguro para expandir automáticamente objetos en la consola

console.clear();
console.log("=== INICIANDO EXPANSIÓN AUTOMÁTICA DE JSON ===");

// Interceptor seguro para console.log
window.jsonExpander = {
  isActive: false,
  originalLog: null,
  originalError: null,
  originalWarn: null,
  
  start() {
    if (this.isActive) {
      console.log("⚠️ JSON Expander ya está activo");
      return;
    }
    
    // Guardar referencias originales
    this.originalLog = console.log;
    this.originalError = console.error; 
    this.originalWarn = console.warn;
    
    // IMPORTANTE: Usar referencias directas para evitar bucles
    const origLog = this.originalLog;
    const origError = this.originalError;
    const origWarn = this.originalWarn;
    
    // Interceptar console.log
    console.log = (...args) => {
      const expandedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            // Expandir objeto como JSON pretty-printed
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            // Si no se puede convertir a JSON, devolver original
            return arg;
          }
        }
        return arg;
      });
      
      // Usar referencia original directamente
      origLog(...expandedArgs);
    };
    
    // Interceptar console.error
    console.error = (...args) => {
      const expandedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return arg;
          }
        }
        return arg;
      });
      
      origError(...expandedArgs);
    };
    
    // Interceptar console.warn  
    console.warn = (...args) => {
      const expandedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return arg;
          }
        }
        return arg;
      });
      
      origWarn(...expandedArgs);
    };
    
    this.isActive = true;
    // Usar referencia original para evitar bucle
    origLog("✅ JSON Expander activado - Todos los objetos se expandirán automáticamente");
  },
  
  stop() {
    if (!this.isActive) {
      console.log("⚠️ JSON Expander no está activo");
      return;
    }
    
    // Restaurar funciones originales
    console.log = this.originalLog;
    console.error = this.originalError;
    console.warn = this.originalWarn;
    
    this.isActive = false;
    this.originalLog("⏹️ JSON Expander desactivado");
  },
  
  // Función para expandir manualmente un objeto específico
  expand(obj) {
    if (typeof obj === 'object' && obj !== null) {
      try {
        this.originalLog(JSON.stringify(obj, null, 2));
      } catch (e) {
        this.originalLog("Error expandiendo objeto:", obj);
      }
    } else {
      this.originalLog(obj);
    }
  }
};

// Comandos disponibles
console.log("📖 Comandos disponibles:");
console.log("   jsonExpander.start() - Activar expansión automática");
console.log("   jsonExpander.stop() - Desactivar expansión automática");
console.log("   jsonExpander.expand(objeto) - Expandir objeto específico");

console.log("\n🚀 Para activar la expansión automática, ejecuta:");
console.log("   jsonExpander.start()"); 