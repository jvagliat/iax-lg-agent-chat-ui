import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/providers/Stream";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { MessageContentComplex } from "@langchain/core/messages";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";
import * as Accordion from "@radix-ui/react-accordion";
import '@/styles/accordion.css'; // 可选，样式部分
import { ChevronDownIcon } from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";

// ===== DEBUGGING SIMPLE PARA BURBUJAS =====
const bubbleDebug = {
  log: (msg: string, data?: any) => console.log(`🧠 [BUBBLE] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`💥 [BUBBLE] ${msg}`, data || ''),
  track: (action: string, messageId: string, details?: any) => {
    console.log(`🎯 [BUBBLE-TRACK] ${action}`, {
      msgId: messageId.substring(0, 8),
      time: new Date().toISOString().substring(11, 23),
      ...details
    });
  }
};

// ===== SISTEMA DE PERSISTENCIA DE BURBUJAS DURANTE STREAMING =====
interface BubbleState {
  type: 'logic' | 'steps' | 'reasoning';
  data: any;
  timestamp: number;
  messageId: string;
}

// Colección global para mantener TODAS las burbujas activas de la conversación
const activeBubbles = new Map<string, BubbleState>();
let conversationStartTime = Date.now();

// Función para limpiar burbujas antiguas (más de 30 segundos)
function cleanupOldBubbles() {
  const now = Date.now();
  for (const [id, bubble] of activeBubbles.entries()) {
    if (now - bubble.timestamp > 30000) {
      activeBubbles.delete(id);
      bubbleDebug.track('CLEANED_OLD_BUBBLE', id, { age: now - bubble.timestamp });
    }
  }
}

// Función para detectar y crear burbujas proactivamente desde JSON incompleto
function detectAndCreateIncompleteJSONBubble(content: string, messageId: string): BubbleState | null {
  const trimmed = content.trim();
  
  console.log("🔍 DETECTING INCOMPLETE JSON:");
  console.log("MessageId:", messageId);
  console.log("Content length:", content.length);
  console.log("Content preview:", content.substring(0, 100));
  
  // Verificar si ya existe una burbuja para este mensaje
  const existingBubble = activeBubbles.get(messageId);
  if (existingBubble) {
    console.log("🔄 ACTUALIZANDO BURBUJA EXISTENTE:", existingBubble.type);
  } else {
    console.log("🆕 CREANDO NUEVA BURBUJA para:", messageId);
  }
  
  // Intentar extraer campos completos de JSON incompleto
  try {
    // MEJORADA: Detectar campo logic completo - ahora maneja JSONs con campos adicionales
    const logicMatch = trimmed.match(/"logic"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    if (logicMatch) {
      const logicContent = logicMatch[1];
      console.log("✅ LOGIC DETECTED:", logicContent.substring(0, 50) + "...");
      
      // NUEVA LÓGICA: Actualizar contenido existente o crear nuevo
      const bubbleState: BubbleState = {
        type: 'logic',
        data: { logic: logicContent },
        timestamp: existingBubble ? existingBubble.timestamp : Date.now(), // Mantener timestamp original
        messageId
      };
      
      activeBubbles.set(messageId, bubbleState);
      
      if (existingBubble) {
        bubbleDebug.track('BUBBLE_CONTENT_UPDATED', messageId, { 
          type: 'logic',
          contentLength: content.length,
          newLogic: logicContent.substring(0, 50) + '...'
        });
      } else {
        bubbleDebug.track('PROACTIVE_LOGIC_BUBBLE_CREATED', messageId, { 
          contentLength: content.length,
          extractedLogic: logicContent.substring(0, 50) + '...'
        });
      }
      
      return bubbleState;
    }
    
    // MEJORADA: Detectar array de steps - mejorado para JSONs con campos adicionales
    const stepsMatch = trimmed.match(/"steps"\s*:\s*\[(.*)/s);
    if (stepsMatch) {
      console.log("✅ STEPS DETECTED:", stepsMatch[1].substring(0, 50) + "...");
      
      // Intentar parsear los steps que tengamos hasta ahora
      let stepsContent = ['Preparando pasos de investigación...'];
      try {
        // Intentar extraer steps individuales con regex
        const stepMatches = stepsMatch[1].match(/"([^"]*(?:\\.[^"]*)*)"/g);
        if (stepMatches && stepMatches.length > 0) {
          stepsContent = stepMatches.map(step => step.slice(1, -1)); // Remover comillas
        }
      } catch (e) {
        // Si falla, usar contenido por defecto
      }
      
      // NUEVA LÓGICA: Actualizar contenido existente o crear nuevo
      const bubbleState: BubbleState = {
        type: 'steps',
        data: { steps: stepsContent },
        timestamp: existingBubble ? existingBubble.timestamp : Date.now(),
        messageId
      };
      
      activeBubbles.set(messageId, bubbleState);
      
      if (existingBubble) {
        bubbleDebug.track('BUBBLE_CONTENT_UPDATED', messageId, { 
          type: 'steps',
          contentLength: content.length,
          stepsCount: stepsContent.length
        });
      } else {
        bubbleDebug.track('PROACTIVE_STEPS_BUBBLE_CREATED', messageId, { 
          contentLength: content.length,
          stepsCount: stepsContent.length
        });
      }
      
      return bubbleState;
    }
    
    // MEJORADA: Detectar campo reasoning completo
    const reasoningMatch = trimmed.match(/"reasoning"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    if (reasoningMatch) {
      const reasoningContent = reasoningMatch[1];
      console.log("✅ REASONING DETECTED:", reasoningContent.substring(0, 50) + "...");
      
      // NUEVA LÓGICA: Actualizar contenido existente o crear nuevo
      const bubbleState: BubbleState = {
        type: 'reasoning',
        data: { reasoning: reasoningContent },
        timestamp: existingBubble ? existingBubble.timestamp : Date.now(),
        messageId
      };
      
      activeBubbles.set(messageId, bubbleState);
      
      if (existingBubble) {
        bubbleDebug.track('BUBBLE_CONTENT_UPDATED', messageId, { 
          type: 'reasoning',
          contentLength: content.length,
          newReasoning: reasoningContent.substring(0, 50) + '...'
        });
      } else {
        bubbleDebug.track('PROACTIVE_REASONING_BUBBLE_CREATED', messageId, { 
          contentLength: content.length,
          extractedReasoning: reasoningContent.substring(0, 50) + '...'
        });
      }
      
      return bubbleState;
    }
    
  } catch (e) {
    bubbleDebug.error('Error extracting from incomplete JSON', e);
  }
  
  console.log("❌ NO PATTERN MATCHED for messageId:", messageId);
  console.log("Available patterns tested:");
  console.log("- Logic pattern: /\"logic\"\\s*:\\s*\"([^\"]*(?:\\\\.[^\"]*)*)\"/");
  console.log("- Steps pattern: /\"steps\"\\s*:\\s*\\[(.*)/");
  console.log("- Reasoning pattern: /\"reasoning\"\\s*:\\s*\"([^\"]*(?:\\\\.[^\"]*)*)\"/");
  
  // Fallback: detectar solo el inicio del JSON como antes
  if (trimmed.match(/\{".*"logic":\s*"/)) {
    console.log("🔄 FALLBACK: Logic pattern start detected");
    const bubbleState: BubbleState = {
      type: 'logic',
      data: { logic: 'Analizando la consulta...' },
      timestamp: existingBubble ? existingBubble.timestamp : Date.now(),
      messageId
    };
    activeBubbles.set(messageId, bubbleState);
    bubbleDebug.track('PROACTIVE_LOGIC_BUBBLE_CREATED_FALLBACK', messageId, { contentLength: content.length });
    return bubbleState;
  }
  
  if (trimmed.match(/\{".*"steps":\s*\[/)) {
    console.log("🔄 FALLBACK: Steps pattern start detected");
    const bubbleState: BubbleState = {
      type: 'steps',
      data: { steps: ['Preparando pasos de investigación...'] },
      timestamp: existingBubble ? existingBubble.timestamp : Date.now(),
      messageId
    };
    activeBubbles.set(messageId, bubbleState);
    bubbleDebug.track('PROACTIVE_STEPS_BUBBLE_CREATED_FALLBACK', messageId, { contentLength: content.length });
    return bubbleState;
  }
  
  if (trimmed.match(/\{".*"reasoning":\s*"/)) {
    console.log("🔄 FALLBACK: Reasoning pattern start detected");
    const bubbleState: BubbleState = {
      type: 'reasoning',
      data: { reasoning: 'Procesando razonamiento...' },
      timestamp: existingBubble ? existingBubble.timestamp : Date.now(),
      messageId
    };
    activeBubbles.set(messageId, bubbleState);
    bubbleDebug.track('PROACTIVE_REASONING_BUBBLE_CREATED_FALLBACK', messageId, { contentLength: content.length });
    return bubbleState;
  }
  
  console.log("❌ NO FALLBACK PATTERNS MATCHED");
  return null;
}

// Función para detectar si el contenido parece JSON incompleto
function isIncompleteJSON(content: string): boolean {
  const trimmed = content.trim();
  
  console.log("🔍 isIncompleteJSON - Analizando:");
  console.log("  Longitud:", trimmed.length);
  console.log("  Empieza con '{':", trimmed.startsWith('{'));
  console.log("  Empieza con '[':", trimmed.startsWith('['));
  console.log("  Preview:", trimmed.substring(0, 50));
  
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    console.log("❌ isIncompleteJSON: No empieza con { o [");
    return false;
  }
  
  // Contar llaves y corchetes
  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  
  console.log("🔍 Conteo de llaves/corchetes:");
  console.log("  Llaves abiertas:", openBraces);
  console.log("  Llaves cerradas:", closeBraces);
  console.log("  Corchetes abiertos:", openBrackets);
  console.log("  Corchetes cerrados:", closeBrackets);
  
  const isIncomplete = openBraces !== closeBraces || openBrackets !== closeBrackets;
  console.log("🔍 isIncompleteJSON resultado:", isIncomplete);
  
  return isIncomplete;
}

// Función para renderizar todas las burbujas activas
function renderActiveBubbles(): React.ReactElement[] {
  cleanupOldBubbles();
  const bubbles = Array.from(activeBubbles.values())
    .sort((a, b) => a.timestamp - b.timestamp);
  
  console.log("🎬 RENDERIZANDO BURBUJAS ACTIVAS:");
  console.log(`  Total burbujas: ${bubbles.length}`);
  bubbles.forEach((bubble, index) => {
    console.log(`  ${index + 1}. ${bubble.type} (${bubble.messageId}) - ${new Date(bubble.timestamp).toISOString().substring(11, 23)}`);
  });
  
  bubbleDebug.log(`Renderizando ${bubbles.length} burbujas activas`);
  
  return bubbles.map((bubble, index) => {
    const key = `bubble-${bubble.messageId}-${bubble.type}-${index}`;
    console.log(`🎯 Renderizando burbuja: ${key}`);
    
    switch (bubble.type) {
      case 'logic':
        bubbleDebug.track('RENDERING_JSON_LOGIC', 'current', { messageId: bubble.messageId, key });
        return renderJsonLogicBubble(bubble.data, key);
      case 'steps':
        bubbleDebug.track('RENDERING_JSON_STEPS', 'current', { messageId: bubble.messageId, count: bubble.data.steps?.length || 0, key });
        return renderJsonStepsBubble(bubble.data, key);
      case 'reasoning':
        bubbleDebug.track('RENDERING_JSON_REASONING', 'current', { messageId: bubble.messageId, key });
        return renderJsonReasoningBubble(bubble.data, key);
      default:
        console.warn(`⚠️ Tipo de burbuja desconocido: ${bubble.type}`);
        return <div key={key}>Burbuja desconocida: {bubble.type}</div>;
    }
  });
}

function renderContentWithThinkBubbles(contentString: string, messageType: string | undefined, messageId?: string) {
  // DEBUGGING: Track content analysis
  bubbleDebug.log('Analyzing content', { 
    length: contentString.length, 
    type: messageType,
    hasThinkTags: contentString.includes('<think>'),
    preview: contentString.substring(0, 100)
  });

  // ===== LOGGING COMPLETO DEL CONTENIDO CRUDO =====
  console.log("🔍 RAW CONTENT START ================");
  console.log("Longitud:", contentString.length);
  console.log("Tipo:", messageType);
  console.log("Contenido completo:");
  console.log(contentString);
  console.log("🔍 RAW CONTENT END ==================");

  // ===== LÓGICA DE PERSISTENCIA DE BURBUJAS MÚLTIPLES =====
  const msgId = messageId || 'unknown';
  
  // Limpiar burbujas antiguas periódicamente
  cleanupOldBubbles();
  
  // ===== DESESCAPAR CONTENIDO JSON =====
  // El contenido viene escapado desde el backend: {\"logic\":\"...\"} 
  // Necesitamos convertirlo a: {"logic":"..."}
  function unescapeJSONContent(content: string): string {
    // Reemplazar \" por " pero mantener \\" como \"
    return content.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  
  const unescapedContent = unescapeJSONContent(contentString);
  
  console.log("🔧 CONTENIDO DESESCAPADO:");
  console.log("MessageId:", msgId);
  console.log("Original:", contentString.substring(0, 100));
  console.log("Desescapado:", unescapedContent.substring(0, 100));
  
  // Verificar si es JSON (usando contenido desescapado)
  let isValidJSON = false;
  let parsedContent = null;
  try {
    parsedContent = JSON.parse(unescapedContent.trim());
    isValidJSON = true;
    console.log("✅ ES JSON VÁLIDO:");
    console.log("Campos disponibles:", Object.keys(parsedContent));
    console.log("JSON parseado:", parsedContent);
  } catch (e) {
    console.log("❌ NO ES JSON VÁLIDO - Error:", e.message);
    
    // LOGGING DETALLADO: ¿Es JSON incompleto?
    const isIncomplete = isIncompleteJSON(unescapedContent);
    console.log("🔍 ¿ES JSON INCOMPLETO?", isIncomplete);
    console.log("🔍 Contenido para análisis:", unescapedContent.substring(0, 150));
    
    // Verificar si parece JSON incompleto durante streaming (usando contenido desescapado)
    if (isIncomplete) {
      console.log("🔄 DETECTADO JSON INCOMPLETO - MOSTRANDO BURBUJAS ACTIVAS");
      console.log(`📊 Burbujas activas disponibles: ${activeBubbles.size}`);
      
      // NUEVA LÓGICA PROACTIVA: Intentar crear burbuja desde JSON incompleto (usando contenido desescapado)
      const proactiveBubble = detectAndCreateIncompleteJSONBubble(unescapedContent, msgId);
      if (proactiveBubble) {
        console.log(`✅ BURBUJA PROACTIVA CREADA: ${proactiveBubble.type}`);
  } else {
        console.log(`❌ NO SE PUDO CREAR BURBUJA PROACTIVA para ${msgId}`);
      }
    } else {
      console.log("❌ NO ES JSON INCOMPLETO - No se intentará crear burbuja");
    }
  }

  // ===== DETECTAR CONTENIDO JSON ESTRUCTURADO =====
  if (isValidJSON && parsedContent && typeof parsedContent === 'object') {
    console.log("🎯 PROCESANDO JSON VÁLIDO COMPLETO");
    
    // Detectar logic
    if (parsedContent.logic) {
      console.log("🟡 CREANDO BURBUJA LOGIC desde JSON completo");
      const bubbleState: BubbleState = {
        type: 'logic',
        data: parsedContent,
        timestamp: Date.now(),
        messageId: msgId
      };
      activeBubbles.set(msgId, bubbleState);
      
      bubbleDebug.track('JSON_LOGIC_DETECTED', msgId, { 
        type: parsedContent.type || 'general',
        logicPreview: parsedContent.logic.substring(0, 50),
        totalActiveBubbles: activeBubbles.size
      });
      return renderJsonLogicBubble(parsedContent);
    }
    
    // Detectar steps
    if (parsedContent.steps && Array.isArray(parsedContent.steps)) {
      console.log("🟢 CREANDO BURBUJA STEPS desde JSON completo");
      const bubbleState: BubbleState = {
        type: 'steps',
        data: parsedContent,
        timestamp: Date.now(),
        messageId: msgId
      };
      activeBubbles.set(msgId, bubbleState);
      
      bubbleDebug.track('JSON_STEPS_DETECTED', msgId, { 
        count: parsedContent.steps.length,
        totalActiveBubbles: activeBubbles.size
      });
      return renderJsonStepsBubble(parsedContent);
    }
    
    // Detectar reasoning
    if (parsedContent.reasoning) {
      console.log("🟣 CREANDO BURBUJA REASONING desde JSON completo");
      const bubbleState: BubbleState = {
        type: 'reasoning',
        data: parsedContent,
        timestamp: Date.now(),
        messageId: msgId
      };
      activeBubbles.set(msgId, bubbleState);
      
      bubbleDebug.track('JSON_REASONING_DETECTED', msgId, { 
        reasoningPreview: parsedContent.reasoning.substring(0, 50),
        totalActiveBubbles: activeBubbles.size
      });
      return renderJsonReasoningBubble(parsedContent);
    }
  }

  // ===== DETECTAR CONTENIDO FINAL (TEXTO PLANO) =====
  // Este puede ser el lugar donde se limpian las burbujas incorrectamente
  if (!isValidJSON && !isIncompleteJSON(unescapedContent)) {
    console.log("📝 DETECTADO CONTENIDO FINAL (TEXTO PLANO)");
    console.log("Content preview:", unescapedContent.substring(0, 100));
    console.log("🧹 Estado de burbujas ANTES de procesar texto final:");
    console.log(`  Burbujas activas: ${activeBubbles.size}`);
    Array.from(activeBubbles.entries()).forEach(([id, bubble]) => {
      console.log(`  - ${bubble.type} (${id.substring(0, 8)}): ${new Date(bubble.timestamp).toISOString().substring(11, 23)}`);
    });
    
    // CRÍTICO: ¿Aquí es donde se están limpiando las burbujas?
    // Por ahora, NO limpiar automáticamente - dejar que el usuario vea el contenido final + burbujas
    if (unescapedContent.trim().length > 50) { // Solo para respuestas sustanciales
      console.log("⚠️ RESPUESTA FINAL SUSTANCIAL - EVALUANDO SI LIMPIAR BURBUJAS");
      console.log("Longitud del contenido final:", unescapedContent.length);
      
      // TEMPORAL: No limpiar automáticamente, solo loggear
      bubbleDebug.track('FINAL_RESPONSE_DETECTED', msgId, {
        contentLength: unescapedContent.length,
        activeBubblesBeforeCleanup: activeBubbles.size,
        bubbleTypes: Array.from(activeBubbles.values()).map(b => b.type)
      });
      
      // DECIDIR: ¿Limpiar burbujas aquí o mantenerlas?
      // Por ahora MANTENER para debugging
      console.log("🚫 NO LIMPIANDO BURBUJAS (modo debugging)");
    }
  }

  const parts = contentString.split(/(<think>[\s\S]*?<\/think>)/);
  
  // DEBUGGING: Track what parts were found
  const thinkParts = parts.filter(part => part.includes('<think>'));
  if (thinkParts.length > 0) {
    bubbleDebug.track('THINK_BUBBLES_DETECTED', msgId, { 
      count: thinkParts.length,
      totalParts: parts.length 
    });
  }

  if (!messageType) {
    messageType = ''
  }
  const defaultSet: Set<string> = new Set()
  return parts.map((part, index) => {
    const isPartEffectivelyEmpty = part.trim() === "";
    if (isPartEffectivelyEmpty) {
      return null;
    }
    if (index % 2 === 1) {
      defaultSet.add(`item-${index}`)
      
      // DEBUGGING: Track bubble render
      bubbleDebug.track('BUBBLE_RENDERING', 'current', { 
        index, 
        contentPreview: part.substring(0, 50),
        accordionValue: `item-${index}`
      });
      
      // 这部分是 <think>标签内的内容
      return (
        <Accordion.Root type="multiple" key={index} defaultValue={[...defaultSet]} className="p-2 my-2 text-xs bg-gray-100 border border-gray-200 rounded-lg italic text-gray-400">
          <Accordion.Item value={`item-${index}`}>
            <Accordion.Header className="flex items-center justify-between w-full">
              <Accordion.Trigger className="AccordionTrigger text-gray-400 w-full flex items-center justify-between font-semibold text-sm cursor-pointer">
                <div className="text-sm font-semibold not-italic">思考过程...</div>
                <ChevronDownIcon className="AccordionChevron" aria-hidden />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="AccordionContent">
              <MarkdownText>{part}</MarkdownText>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      );
    } else {
      if (['tool', 'tool_call'].includes(messageType) && !contentString) {
        return null;
      }
      // 普通内容
      return <MarkdownText key={index}>{part}</MarkdownText>;
    }
  });
}

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter((c) => c.type === "tool_use" && c.id);

  return toolCallContents.map((tc) => {
    const toolCall = tc as Record<string, any>;
    let json: Record<string, any> = {};
    if (toolCall?.input) {
      try {
        json = parsePartialJson(toolCall.input) ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: toolCall.name ?? "",
      id: toolCall.id ?? "",
      args: json,
      type: "tool_call",
    };
  });
}

// ===== FUNCIONES DE RENDERIZADO JSON =====

function renderJsonLogicBubble(jsonData: any, key?: string) {
  const { logic, type = 'general' } = jsonData;
  
  bubbleDebug.track('RENDERING_JSON_LOGIC', 'current', { type });
  
  return (
           <Accordion.Root 
             type="multiple" 
      defaultValue={['json-logic-item']}
      className="border border-yellow-200 rounded-lg"
      key={key}
    >
      <Accordion.Item value="json-logic-item">
              <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-yellow-50 transition-colors">
                  <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-yellow-100 text-yellow-800">
                Razonamiento
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                Proceso de análisis
                    </span>
                  </div>
                  <ChevronDownIcon className="AccordionChevron" aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0">
            <div className="bg-yellow-50 p-3 rounded text-sm">
              <MarkdownText>{logic}</MarkdownText>
                    </div>
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
  );
}

function renderJsonStepsBubble(jsonData: any, key?: string) {
  const { steps, type = 'steps' } = jsonData;
  
  bubbleDebug.track('RENDERING_JSON_STEPS', 'current', { count: steps.length });
  
  return (
        <Accordion.Root 
          type="multiple" 
      defaultValue={['json-steps-item']}
      className="border border-green-200 rounded-lg"
      key={key}
        >
      <Accordion.Item value="json-steps-item">
            <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-green-50 transition-colors">
                <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-green-100 text-green-800">
                Pasos ({steps.length})
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                Proceso paso a paso
                  </span>
                </div>
                <ChevronDownIcon className="AccordionChevron" aria-hidden />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="AccordionContent">
              <div className="p-3 pt-0">
            <div className="bg-green-50 p-3 rounded text-sm">
              <ol className="list-decimal list-inside space-y-1">
                {steps.map((step: string, index: number) => (
                  <li key={index} className="text-gray-700">
                    <MarkdownText>{step}</MarkdownText>
                  </li>
                ))}
              </ol>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
  );
}

function renderJsonReasoningBubble(jsonData: any, key?: string) {
  const { reasoning, type = 'reasoning' } = jsonData;
  
  bubbleDebug.track('RENDERING_JSON_REASONING', 'current', { type });
  
  return (
        <Accordion.Root 
          type="multiple" 
      defaultValue={['json-reasoning-item']}
      className="border border-purple-200 rounded-lg"
      key={key}
        >
      <Accordion.Item value="json-reasoning-item">
            <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-purple-50 transition-colors">
                <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-purple-100 text-purple-800">
                Análisis
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                Razonamiento detallado
                  </span>
                </div>
                <ChevronDownIcon className="AccordionChevron" aria-hidden />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="AccordionContent">
              <div className="p-3 pt-0">
            <div className="bg-purple-50 p-3 rounded text-sm">
              <MarkdownText>{reasoning}</MarkdownText>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
  );
}

function renderPersistentBubble(bubbleState: BubbleState) {
  const { type, data, timestamp } = bubbleState;
  const age = Date.now() - timestamp;

  let bubbleColorClass = '';
  let bubbleIcon = ChevronDownIcon;
  let bubbleTitle = '';

  switch (type) {
    case 'logic':
      bubbleColorClass = 'bg-blue-50 border-blue-200';
      bubbleIcon = ChevronDownIcon;
      bubbleTitle = 'Razonamiento';
      break;
    case 'steps':
      bubbleColorClass = 'bg-green-50 border-green-200';
      bubbleIcon = ChevronDownIcon;
      bubbleTitle = 'Pasos';
      break;
    case 'reasoning':
      bubbleColorClass = 'bg-purple-50 border-purple-200';
      bubbleIcon = ChevronDownIcon;
      bubbleTitle = 'Análisis';
      break;
  }

  return (
        <Accordion.Root 
          type="multiple" 
      defaultValue={['persistent-bubble']}
      className={`border border-gray-200 rounded-lg ${bubbleColorClass}`}
    >
      <Accordion.Item value="persistent-bubble">
        <Accordion.Header className="flex items-center justify-between w-full">
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-gray-100 text-gray-800">
                {bubbleTitle}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                {age < 1000 ? `${age}ms` : `${age / 1000}s`}
                  </span>
                </div>
                <ChevronDownIcon className="AccordionChevron" aria-hidden />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="AccordionContent">
              <div className="p-3 pt-0">
            <MarkdownText>{data.logic || data.steps || data.reasoning}</MarkdownText>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
  );
}

interface InterruptProps {
  interruptValue?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interruptValue,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  console.log(
    `12345Interrupt: ${JSON.stringify(interruptValue)} \n isLastMessage: ${isLastMessage} \n hasNoAIOrToolMessages: ${hasNoAIOrToolMessages}`,
  );
  return (
    <>
      {isAgentInboxInterruptSchema(interruptValue) &&
        (isLastMessage || hasNoAIOrToolMessages) && (
          <ThreadView interrupt={interruptValue} />
        )}
      {/* Todo: @Shubham removed this to avoid duplicate rendering of Interrupt */}
      {/* {interruptValue &&
      !isAgentInboxInterruptSchema(interruptValue) &&
      isLastMessage ? (
        <GenericInterruptView interrupt={interruptValue} />
      ) : null} */}
    </>
  );
}

export function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
}) {
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );

  const thread = useStreamContext();

  // DEBUGGING: Track component renders and content changes
  const messageId = message?.id || 'no-id';
  bubbleDebug.track('COMPONENT_RENDER', messageId, {
    contentLength: contentString.length,
    isLoading,
    hasThinkTags: contentString.includes('<think>'),
    contentPreview: contentString.substring(0, 100)
  });

  console.log(`$$$$$$$$$ Message : ${JSON.stringify(message)}`);

  const isLastMessage =
    thread.messages.length > 0 &&
    thread.messages[thread.messages.length - 1]?.id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = Array.isArray(content)
    ? parseAnthropicStreamedToolCalls(content)
    : undefined;

  const hasToolCalls =
    message &&
    "tool_calls" in message &&
    message.tool_calls &&
    message.tool_calls.length > 0;
  const toolCallsHaveContents =
    hasToolCalls &&
    message.tool_calls?.some(
      (tc) => tc.args && Object.keys(tc.args).length > 0,
    );
  const hasAnthropicToolCalls = !!anthropicStreamedToolCalls?.length;
  const isToolResult = message?.type === "tool";

  if (isToolResult && hideToolCalls) {
    return null;
  }

  return (
    <div className="group mr-auto flex items-start gap-2 w-full">
      <div className="flex flex-col gap-2 w-full">
        {isToolResult ? (
          <>
            <ToolResult message={message} />
            <Interrupt
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
          </>
        ) : (
          <>
            {contentString.length > 0 && (
              <div className="py-1 w-full">
                {renderContentWithThinkBubbles(contentString, message?.type, message?.id)}
              </div>
            )}

            {!hideToolCalls && (
              <>
                {(hasToolCalls && toolCallsHaveContents && (
                  <ToolCalls toolCalls={message.tool_calls} />
                )) ||
                  (hasAnthropicToolCalls && (
                    <ToolCalls toolCalls={anthropicStreamedToolCalls} />
                  )) ||
                  (hasToolCalls && (
                    <ToolCalls toolCalls={message.tool_calls} />
                  ))}
              </>
            )}

            {message && (
              <CustomComponent
                message={message}
                thread={thread}
              />
            )}
            <div
              className={cn(
                "mr-auto flex items-center gap-2 transition-opacity",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
              )}
            >
              {!hasToolCalls && 
                <>
                  <BranchSwitcher
                    branch={meta?.branch}
                    branchOptions={meta?.branchOptions}
                    onSelect={(branch) => thread.setBranch(branch)}
                    isLoading={isLoading}
                  />
                  <CommandBar
                    content={contentString}
                    isLoading={isLoading}
                    isAiMessage={true}
                    handleRegenerate={() => handleRegenerate(parentCheckpoint)}
                  />
                </>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantMessageLoading() {
  return (
    <div className="mr-auto flex items-start gap-2">
      <div className="bg-muted flex h-8 items-center gap-1 rounded-2xl px-4 py-2">
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
        <div className="bg-foreground/50 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
      </div>
    </div>
  );
}
