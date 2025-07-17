# Documentación de Tipos de Mensajes - Sistema de Burbujas

## ✨ **NUEVA FUNCIONALIDAD: Debug Integration**
**Todas las burbujas ahora incluyen información de debug completa:**
- **Message ID**: Identificador único del mensaje procesado
- **JSON Raw**: Datos JSON formateados y legibles para debugging
- **Sección expandible**: Información técnica separada visualmente del contenido principal

---

## Tipos de Mensajes Implementados

### 1. **Streaming JSON Messages**
#### 1.1 Logic (`logic`)
- **Icono**: 🧠
- **Título**: "Razonamiento"
- **Color**: Amarillo
- **Estructura**: `{"logic": "texto del razonamiento"}`
- **Función**: `renderLogicBubble()`
- **✅ Debug**: MessageId + JSON raw incluido

#### 1.2 Legal (`legal`) ⚖️ **NUEVO**
- **Icono**: ⚖️
- **Título**: "Análisis Jurídico"
- **Color**: Índigo
- **Estructura**: `{"type": "legal", "logic": "análisis jurídico"}`
- **Función**: `renderLegalBubble()`
- **Detección**: Se activa cuando encuentra el patrón `{"type": "legal"}`
- **✅ Debug**: MessageId + JSON raw incluido

#### 1.3 Steps (`steps`)
- **Icono**: 📋
- **Título**: "Pasos de Investigación"
- **Color**: Verde
- **Estructura**: `{"steps": ["paso1", "paso2", ...]}`
- **Función**: `renderStepsBubble()`
- **✅ Debug**: MessageId + JSON raw incluido

#### 1.4 Reasoning (`reasoning`)
- **Icono**: 🔍
- **Título**: "Análisis Detallado"
- **Color**: Púrpura
- **Estructura**: `{"reasoning": "texto detallado"}`
- **Función**: `renderReasoningBubble()`
- **✅ Debug**: MessageId + JSON raw incluido

#### 1.5 Analysis (`analysis`)
- **Icono**: 📊
- **Título**: "Análisis"
- **Color**: Azul
- **Estructura**: `{"analysis": "análisis específico"}`
- **Función**: `renderAnalysisBubble()`
- **✅ Debug**: MessageId + JSON raw incluido

#### 1.6 Sources (`sources`)
- **Icono**: 📄
- **Título**: "Fuentes"
- **Color**: Naranja
- **Estructura**: `{"sources": ["fuente1", "fuente2"]}`
- **Función**: `renderSourcesBubble()`
- **✅ Debug**: MessageId + JSON raw incluido

### 2. **LangGraph Backend Messages**
#### 2.1 Analyze and Route Query (`analyze_and_route_query`)
- **Icono**: 🎯
- **Título**: "Analizando Consulta"
- **Color**: Amarillo
- **Función**: `renderAnalyzeQueryBubble()`
- **Estructura**: `{"router": {"type": "...", "logic": "..."}}`
- **✅ Debug**: MessageId + JSON raw incluido

#### 2.2 Create Research Plan (`create_research_plan`)
- **Icono**: 📋
- **Título**: "Plan de Investigación"
- **Color**: Verde
- **Función**: `renderResearchPlanBubble()`
- **Estructura**: `{"steps": [...], "documents": "..."}`
- **✅ Debug**: MessageId + JSON raw incluido

#### 2.3 Conduct Research (`conduct_research`)
- **Icono**: 🔬
- **Título**: "Investigación"
- **Color**: Azul
- **Función**: `renderConductResearchBubble()`
- **Estructura**: `{"documents": [...]}`
- **✅ Debug**: MessageId + JSON raw incluido

#### 2.4 Respond (`respond`)
- **Icono**: 💬
- **Título**: "Respuesta"
- **Color**: Púrpura
- **Función**: `renderRespondBubble()`
- **Estructura**: `{"messages": [{"content": "...", "response_metadata": {...}}]}`
- **✅ Debug**: MessageId + JSON raw incluido

### 3. **Legacy JSON Functions** 🔄
#### 3.1 JSON Logic Bubble
- **Función**: `renderJsonLogicBubble()`
- **Uso**: Compatibilidad con formato JSON legacy
- **✅ Debug**: JSON raw incluido

#### 3.2 JSON Steps Bubble
- **Función**: `renderJsonStepsBubble()`
- **Uso**: Renderizado de pasos en formato legacy
- **✅ Debug**: JSON raw incluido

#### 3.3 JSON Reasoning Bubble
- **Función**: `renderJsonReasoningBubble()`
- **Uso**: Análisis en formato legacy
- **✅ Debug**: JSON raw incluido

---

## 🔧 **Información de Debug en Burbujas**

### **Estructura de la Sección Debug:**
```tsx
{/* Información de debug */}
<div className="border-t pt-3 space-y-2">
  <div className="text-xs">
    <span className="font-semibold text-gray-600">Message ID:</span>
    <div className="font-mono text-gray-500 bg-gray-50 p-2 rounded mt-1 break-all">
      {bubbleState.messageId}
    </div>
  </div>
  
  <div className="text-xs">
    <span className="font-semibold text-gray-600">JSON Data:</span>
    <pre className="font-mono text-gray-500 bg-gray-50 p-2 rounded mt-1 overflow-x-auto text-xs whitespace-pre-wrap">
      {JSON.stringify(bubbleState.data, null, 2)}
    </pre>
  </div>
</div>
```

### **Características del Debug:**
- **✅ Separación Visual**: Línea divisoria clara entre contenido y debug
- **✅ Message ID**: Identificador único del mensaje con fuente monoespaciada
- **✅ JSON Pretty-Print**: Formato indentado y legible del JSON raw
- **✅ Scroll Horizontal**: Para JSON extenso sin cortar líneas
- **✅ Estilo Consistente**: Fondo gris, texto pequeño, fuente mono

### **Beneficios para Debugging:**
1. **Trazabilidad**: Cada burbuja muestra su messageId único
2. **Transparencia**: Ver exactamente qué datos procesó cada burbuja
3. **Debugging Rápido**: Identificar problemas de parsing o detección
4. **Verificación**: Confirmar que el JSON se procesó correctamente
5. **Development**: Facilitar desarrollo y mantenimiento del sistema

---

## ✅ **Problemas Resueltos**

### **🔧 Análisis de Logs Múltiples**

#### **✅ RESUELTO: Función renderLegalBubble() Faltante**
- **Problema**: Error al renderizar burbujas de tipo "legal"
- **Solución**: Implementada función completa con estilo índigo y icono ⚖️
- **Estado**: Funcional y con debug integrado

#### **✅ RESUELTO: Detección del Tipo Legal**
- **Problema**: Mensajes `{"type": "legal"}` no generaban burbujas
- **Solución**: Agregado patrón regex específico en `detectStreamingJSON` y `detectCompleteJSON`
- **Estado**: Detecta correctamente ambos formatos streaming y completo

#### **🔄 MEJORADO: JSON Mal Formateado**
- **Problema**: JSON fragmentado aparecía como texto plano
- **Solución**: Mejoradas regex de detección y validación defensiva
- **Estado**: Mejor detección de patrones JSON incompletos

#### **✅ RESUELTO: Logs Innecesarios de Validación**
- **Problema**: Intentos repetidos de parsear contenido no-JSON
- **Solución**: Filtros preventivos que evitan parsing de texto claramente no-JSON
- **Estado**: Reducción significativa de logs innecesarios

#### **🔄 OPTIMIZADO: Rendimiento de Renders**
- **Problema**: Repeticiones excesivas de procesamiento
- **Solución**: Sistema de cache con `processedMessages` y `NON_JSON_CACHE`
- **Estado**: Filtros implementados para evitar procesamiento redundante

---

## 📊 **Estado Actual del Sistema**

### **✅ Funcionalidades Implementadas:**
- **10 Tipos de Mensaje**: Todos detectados y renderizados correctamente
- **14 Funciones de Renderizado**: Todas con debug integrado
- **Sistema Acumulativo**: Burbujas permanentes sin borrado automático
- **Debug Completo**: MessageId + JSON raw en todas las burbujas
- **Optimización de Rendimiento**: Cache y filtros implementados
- **Detección Robusta**: Patrones mejorados para JSON fragmentado

### **🎯 Métricas de Calidad:**
- **Cobertura de Tipos**: 100% (10/10 tipos implementados)
- **Debug Coverage**: 100% (14/14 funciones con debug)
- **Error Handling**: Validación defensiva implementada
- **Performance**: Filtros de cache implementados
- **Maintainability**: Código documentado y estructurado

### **📈 Mejoras de Rendimiento:**
- **Cache de Mensajes**: Evita reprocesamiento de contenido idéntico
- **Filtros Preventivos**: Evita parsing de contenido claramente no-JSON
- **Optimización de Regex**: Patrones más eficientes para detección
- **Validación Temprana**: Detección rápida de contenido inválido

### **🛠️ Herramientas de Debugging:**
- **Debug Section**: Información técnica en cada burbuja
- **Console Logging**: Logs estructurados para seguimiento
- **JSON Expansion**: Script `json-expander.js` para consola
- **Bubble Tracking**: Sistema de seguimiento de estado

---

## 🔮 **Arquitectura del Sistema**

### **Flujo de Procesamiento:**
1. **Detección**: `detectStreamingJSON()` y `detectCompleteJSON()`
2. **Validación**: Filtros preventivos y cache de rendimiento
3. **Creación**: `BubbleState` con timestamp y messageId único
4. **Almacenamiento**: `permanentBubbles` Map para persistencia
5. **Renderizado**: Funciones específicas con debug integrado
6. **Display**: Accordion components con información técnica

### **Componentes Clave:**
- **🔄 Cache System**: `processedMessages` + `NON_JSON_CACHE`
- **🎯 Detection Engine**: Regex patterns + JSON validation
- **💾 Persistent Storage**: `permanentBubbles` Map
- **🎨 Render System**: 14 specialized render functions
- **🐛 Debug Integration**: Universal debug sections

### **Patrones de Diseño:**
- **Factory Pattern**: Creación de BubbleState específico por tipo
- **Observer Pattern**: Sistema de tracking y logging
- **Strategy Pattern**: Diferentes renderizadores por tipo de mensaje
- **Singleton Pattern**: Cache global y storage persistente

---

## 🎯 **Roadmap y Mejoras Futuras**

### **📋 Próximas Mejoras:**
1. **🔄 Performance Tuning**: Optimización adicional de renders
2. **🛡️ Error Recovery**: Manejo más robusto de JSON malformado
3. **📊 Analytics**: Métricas de uso y rendimiento
4. **🎨 UI Enhancement**: Mejoras visuales en burbujas
5. **🧪 Testing**: Suite de pruebas automatizadas

### **🔧 Mantenimiento:**
- **Monitoring**: Logs de rendimiento y errores
- **Documentation**: Mantener docs actualizadas
- **Refactoring**: Mejora continua del código
- **Optimization**: Análisis periódico de performance

---

## 📚 **Referencias Técnicas**

### **Archivos Principales:**
- `src/components/thread/messages/ai.tsx`: Implementación principal
- `BUBBLE_MESSAGE_TYPES.md`: Esta documentación
- `bubble-monitor.js`: Script de monitoreo (si existe)
- `json-expander.js`: Herramienta de expansión para consola

### **Logs de Análisis:**
- `full_conversation_multi_type_intermedios_pasos_2025-07-17-0325.txt`
- `full_conversation_multi_type_intermedios_pasos_2025-07-17-0349.txt`

### **Funciones de Detección:**
- `detectStreamingJSON()`: Detección de JSON en streaming
- `detectCompleteJSON()`: Detección de JSON completo
- `detectLangGraphUpdate()`: Detección de updates de LangGraph

### **Utilidades:**
- `renderDebugSection()`: Helper para información de debug
- `createContentHash()`: Función de hashing para cache
- `shouldProcessMessage()`: Filtro de procesamiento

---

**📅 Última Actualización**: 2025-01-17  
**🔧 Versión**: 2.0 - Debug Integration Complete  
**👨‍💻 Estado**: Funcional y optimizado con debug completo 