# Problema Principal: Persistencia de Burbujas de Pensamiento en Streaming

## Descripción del Proyecto

Este es un proyecto de frontend que interactúa con un **backend de LangGraph**. El sistema recibe un **stream de eventos** que representan los pasos intermedios de un agente de IA durante el procesamiento de consultas.

**Arquitectura del Sistema:**
- **Frontend**: React/Next.js con componentes para renderizar mensajes de chat
- **Backend**: LangGraph que envía eventos de streaming con pasos intermedios del agente
- **Comunicación**: Stream de eventos que incluye pasos de razonamiento y respuestas finales

**Historial del Proyecto:**
El proyecto ya tuvo un problema similar donde los pasos intermedios desaparecían, que se solucionó implementando:
- Un `messageReducer` en `src/providers/Stream.tsx` para acumular mensajes
- Captura de eventos `on_chain_start` y `on_chain_end` 
- Renderizado de mensajes de tipo `stream` para mostrar el proceso de razonamiento

**Contexto del Problema Actual:**
Aunque el problema de desaparición de pasos intermedios ya fue resuelto previamente, ahora enfrentamos un **nuevo desafío específico**: el backend de LangGraph está enviando el **proceso de razonamiento del agente** (el campo `logic`) en mensajes JSON separados del contenido final, causando que las "burbujas de pensamiento" (acordeones que muestran el razonamiento) desaparezcan cuando llega la respuesta final.

## ¿Qué está pasando?

Tenemos un componente React (`src/components/thread/messages/ai.tsx`) que renderiza mensajes de AI con "burbujas de pensamiento" colapsables (acordeones) que muestran el proceso de razonamiento del AI.

**Comportamiento Problemático:**
- Durante el streaming, cuando llega contenido JSON parcial como `{"type":"more-info","logic":"La consulta no especifica..."}`, las burbujas se muestran correctamente
- **PERO** cuando llega la respuesta final (texto normal), las burbujas desaparecen

## Causa Raíz (hipotetica, supuesta por Claude-4 Sonnet)

El backend crea **dos mensajes separados con IDs diferentes**:

1. **Mensaje 1**: `run--5ffa8220-e297-486c-8558-96ea30497c40` (contiene el JSON con el razonamiento)
2. **Mensaje 2**: `run--526bb9d2-235d-4b41-8849-116d5f91734e` (contiene la respuesta final)

## Implementación Actual

### ✅ Funciones que SÍ Funcionan:
- Detección de JSON parcial (`isPartialJson: true`)
- Almacenamiento en `partialJsonStorage` Map
- Renderizado de contenido JSON con campo `logic`
- Funciones implementadas:
  - `renderPartialJsonLogic()` - maneja JSON incompleto
  - `renderCombinedContent()` - combina razonamiento almacenado con contenido final
  - `renderJsonLogic()` - renderiza JSON completo con lógica

### ❌ Problemas Identificados:
- La lógica de búsqueda temporal para combinar datos de diferentes mensajes NO se ejecuta
- La respuesta final no encuentra los datos del razonamiento y usa el renderizador básico de "think tags"
- Falta el log esperado: "🔍 [DEBUG] Found recent partial JSON data, combining with final content"

## Problemas Adicionales

### Rendimiento:
- Violaciones de rendimiento (handlers que toman >400ms)
- Logs repetitivos sugiriendo re-renderizados excesivos
- Ejemplo: `[Violation] 'input' handler took 410ms`

### Logs Problemáticos:
```
$$$$$$$$$ 0 Assist : [{"id":"eab4fcbc-d895-4bc4-ad28-284a6547441b","type":"human",...}]
```
Se repite múltiples veces, indicando posibles re-renderizados innecesarios.

## Objetivo

Que cuando llegue la respuesta final, el sistema encuentre automáticamente el razonamiento almacenado del mensaje anterior y los combine en una vista unificada con las burbujas de pensamiento visibles.

## Flujo Esperado

1. **Mensaje JSON Parcial** → Detectar → Almacenar en `partialJsonStorage` → Mostrar burbuja parcial
2. **Mensaje Final** → Buscar datos almacenados → Combinar → Mostrar burbuja completa + contenido final
3. **Limpieza** → Remover datos usados del storage

## Línea de Código Problemática

Archivo: `src/components/thread/messages/ai.tsx`
Línea aproximada: 222 (dentro de la función de búsqueda temporal)

## Estado del Debug

- ✅ Logs de detección JSON parcial funcionan
- ✅ Logs de almacenamiento funcionan  
- ❌ Logs de búsqueda temporal no aparecen
- ❌ La respuesta final va directo a "🔍 [DEBUG] Using think tags renderer"

## Próximos Pasos

1. Revisar la lógica de búsqueda temporal en la función `renderContentWithThinkBubbles`
2. Verificar por qué no se ejecuta el bloque de código que busca datos recientes
3. Optimizar el rendimiento para evitar re-renderizados excesivos
4. Asegurar limpieza correcta del `partialJsonStorage`

---

**Fecha de creación**: Diciembre 2024  
**Archivo de referencia**: `src/components/thread/messages/ai.tsx`  
**Función principal afectada**: `renderContentWithThinkBubbles()` 

---

**Actualización (17 de julio de 2025, 12:02)**  
**Análisis Reciente de Logs:**  
- Los logs confirman que el storage (partialJsonStorage) permanece vacío porque el JSON con 'logic' llega completo (no parcial), por lo que no se activa el almacenamiento. Esto causa que la búsqueda temporal falle (logs muestran 'Direct lookup result: undefined' y no 'Found recent'), llevando al fallback a think tags sin burbujas persistentes.  
- Re-renders excesivos confirmados por repetición de logs, contribuyendo a violaciones de rendimiento.  

**Cambios Realizados en src/components/thread/messages/ai.tsx:**  
- Agregado almacenamiento en el bloque hasJsonLogic para guardar type y logic incluso en JSON completo, asegurando data disponible para combinación.  
- Ajustado renderCombinedContent para mostrar logic como completo (sin '...' ni nota 'parcial').  
- Optimizaciones de rendimiento: Envolvió AssistantMessage con React.memo para evitar re-renders innecesarios; usó useMemo en renderContentWithThinkBubbles para memoizar análisis y parseo.  
- Corregidos errores de linter relacionados con tipos (e.g., messageType undefined).  

**Estado Actual:**  
- Los cambios deberían persistir las burbujas al combinar logic con contenido final. Prueba con queries que generen JSON y texto streamed. Si persisten issues, revisar backend para IDs de mensajes o agregar más debugs. Listo para continuar en sesiones futuras.  

---

**Actualización (17 de julio de 2025, 14:30) - ANÁLISIS EXHAUSTIVO COMPLETADO**

**Investigación Profunda Realizada:**
Se realizó un análisis completo del codebase utilizando semantic search, grep, y lectura de archivos críticos para entender completamente el problema.

**ESTADO REAL ACTUAL DEL CÓDIGO:**

**✅ CORRECCIONES YA IMPLEMENTADAS:**
Las principales correcciones del almacenamiento ya están implementadas en `src/components/thread/messages/ai.tsx`:

```javascript
// Líneas 44-53: Almacenamiento de JSON completo CON logic
if (hasJsonLogic) {
  console.log('🔍 [DEBUG] Processing as JSON with logic field');
  // Store the full parsed JSON data for potential combination with final content
  if (messageId) {
    partialJsonStorage.set(messageId, {
      type: parsedJson.type || null,
      logic: parsedJson.logic || null,
      timestamp: Date.now()
    });
    console.log('🔍 [DEBUG] Stored full JSON for message:', messageId);
  }
  return { content: renderJsonLogic(parsedJson), wasCombined: false };
}

// Líneas 88-102: Búsqueda temporal IMPLEMENTADA
if (!foundStoredData) {
  console.log('🔍 [DEBUG] No direct match, searching for recent partial JSON data...');
  const recentThreshold = Date.now() - (5 * 60 * 1000);
  
  for (const [storedMessageId, data] of partialJsonStorage.entries()) {
    if (data.timestamp > recentThreshold) {
      console.log('🔍 [DEBUG] Found recent partial JSON data, combining with final content');
      foundStoredData = data;
      partialJsonStorage.delete(storedMessageId);
      break;
    }
  }
}

// Líneas 109-117: Renderizado combinado IMPLEMENTADO
if (foundStoredData) {
  const combined = renderCombinedContent(foundStoredData, contentString);
  return { content: combined, wasCombined: true, cleanId };
}
```

**✅ OPTIMIZACIONES YA IMPLEMENTADAS:**
- **React.memo** envuelve AssistantMessage (línea 674)
- **useMemo** para análisis de contenido (líneas 800-803)
- **useEffect** para persistencia sin loops (líneas 807-816)
- **Limpieza correcta** del storage (líneas 818-823)

**❌ PROBLEMAS QUE PERSISTEN:**
1. **Logs Repetitivos**: Todavía presentes en `thread/index.tsx` líneas 631 y 641:
   ```javascript
   console.log(`$$$$$$$$$ 0 Assist : ${JSON.stringify(messages)}`),
   console.log(`$$$$$$$$$ 1 Assist : ${JSON.stringify(messages)}`),
   ```
2. **Posibles Violaciones de Performance**: Re-renders por logs en renderizado
3. **Burbujas Aún Desaparecen**: A pesar de las correcciones, el problema podría persistir

**Flujo del Backend Confirmado (server_response_stream_example.txt):**
1. **Mensaje JSON**: `{"type":"general","logic":"El usuario pregunta sobre diferentes épocas..."}` (ID: `run--e7b64f7f-...`)
2. **Mensaje Final**: `"¡Hola! 😊 Soy tu Asistente Legal..."` (ID: `run--9fcd6dbd-...`)

**Arquitectura del Sistema Confirmada:**
- **Frontend**: React/Next.js con providers para Stream y Thread
- **Backend**: LangGraph enviando eventos separados con IDs únicos
- **Comunicación**: Stream de eventos con `on_chain_start`, `on_chain_end`, y mensajes finales

**PRÓXIMOS PASOS REALES:**
1. **Eliminar Logs Repetitivos**: Remover logs de `thread/index.tsx` líneas 631 y 641
2. **Investigar Por Qué Persiste**: Si burbujas siguen desapareciendo, necesitamos logs de debug reales
3. **Verificar Funcionamiento**: Probar con queries reales para ver si las correcciones funcionan
4. **Optimizar Performance**: Mejorar re-renders si es necesario

**ESTADO ACTUAL:**
- ✅ Almacenamiento de JSON completo: **IMPLEMENTADO**
- ✅ Búsqueda temporal: **IMPLEMENTADA**
- ✅ Renderizado combinado: **IMPLEMENTADO**
- ✅ Optimizaciones básicas: **IMPLEMENTADAS**
- ❌ Logs repetitivos: **PENDIENTE DE REMOVER**
- ❓ Funcionamiento real: **NECESITA VERIFICACIÓN**

**Próximo Paso Recomendado:**
Eliminar logs repetitivos y verificar si las correcciones ya implementadas resuelven el problema de las burbujas desaparecidas. 