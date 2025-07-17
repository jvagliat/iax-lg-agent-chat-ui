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
import '@/styles/accordion.css';
import { ChevronDownIcon } from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";

// ===== DEBUGGING AVANZADO PARA BURBUJAS =====
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

// ===== SISTEMA ACUMULATIVO DE BURBUJAS =====
interface BubbleState {
  type: 'logic' | 'steps' | 'reasoning' | 'analysis' | 'sources' | 'analyze_query' | 'research_plan' | 'conduct_research' | 'respond';
  data: any;
  timestamp: number;
  messageId: string;
  title: string;
  color: string;
}

// Colección PERMANENTE de burbujas - NUNCA se limpia automáticamente
const permanentBubbles = new Map<string, BubbleState>();
let globalBubbleCounter = 0;

// ===== SISTEMA DE OPTIMIZACIÓN DE RENDIMIENTO =====
const processedMessages = new Map<string, { hash: string, lastProcessed: number }>();
const NON_JSON_CACHE = new Set<string>();
const PROCESSING_COOLDOWN = 100; // 100ms entre procesamiento del mismo mensaje

// Función para crear hash del contenido del mensaje
function createContentHash(content: string): string {
  return content.substring(0, 50) + content.length + (content.includes('{') ? 'json' : 'text');
}

// Función para verificar si debemos procesar el mensaje
function shouldProcessMessage(messageId: string, content: string): boolean {
  const contentHash = createContentHash(content);
  const now = Date.now();
  
  // Verificar si ya procesamos este contenido recientemente
  const previousProcessing = processedMessages.get(messageId);
  if (previousProcessing) {
    if (previousProcessing.hash === contentHash && 
        (now - previousProcessing.lastProcessed) < PROCESSING_COOLDOWN) {
      return false; // Skip procesamiento repetitivo
    }
  }
  
  // Verificar si es contenido que sabemos que no es JSON
  if (NON_JSON_CACHE.has(contentHash)) {
    return false;
  }
  
  // Si el contenido es muy largo y no tiene estructura JSON, probablemente no es JSON
  const trimmed = content.trim();
  if (trimmed.length > 1000 && 
      !trimmed.includes('{') && 
      !trimmed.includes('"type":') && 
      !trimmed.includes('"logic":') && 
      !trimmed.includes('"steps":')) {
    NON_JSON_CACHE.add(contentHash);
    return false;
  }
  
  // Actualizar registro de procesamiento
  processedMessages.set(messageId, { hash: contentHash, lastProcessed: now });
  return true;
}

// ===== FUNCIONES DE DETECCIÓN MEJORADAS =====

// Detectar actualizaciones de LangGraph backend
function detectLangGraphUpdate(content: string, messageId: string): BubbleState | null {
  // Primero intentar detectar el patrón completo (para logs)
  const langGraphMatch = content.match(/LangGraph backend full update:\s*(\{.*\})/s);
  let jsonContent = null;
  
  if (langGraphMatch) {
    try {
      jsonContent = JSON.parse(langGraphMatch[1]);
      console.log("🏗️ LANGGRAPH UPDATE DETECTED (con patrón):", jsonContent);
    } catch (e) {
      console.log("❌ Error parsing LangGraph JSON (con patrón):", e);
    }
  } else {
    // Si no hay patrón, intentar parsear directamente como JSON solo si parece JSON
    const trimmed = content.trim();
    
    // Evitar intentar parsear contenido que claramente no es JSON
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }
    
    // Si es demasiado largo y no tiene estructura LangGraph, probablemente es texto normal
    if (trimmed.length > 1000 && !trimmed.includes('analyze_and_route_query') && !trimmed.includes('create_research_plan') && !trimmed.includes('conduct_research') && !trimmed.includes('respond')) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(trimmed);
      console.log("🔍 INTENTANDO DETECTAR JSON DIRECTO:", parsed);
      
      // Verificar si es una actualización de LangGraph
      if (parsed.analyze_and_route_query || parsed.create_research_plan || parsed.conduct_research || parsed.respond) {
        jsonContent = parsed;
        console.log("🏗️ LANGGRAPH UPDATE DETECTED (JSON directo):", jsonContent);
      }
    } catch (e) {
      // No es JSON válido, continuar silenciosamente
      return null;
    }
  }
  
  if (!jsonContent) return null;
  
  try {
    // Detectar tipo específico de update
    if (jsonContent.analyze_and_route_query) {
      return {
        type: 'analyze_query',
        data: jsonContent.analyze_and_route_query,
        timestamp: Date.now(),
        messageId: `langgraph-analyze-${globalBubbleCounter++}`,
        title: "🎯 Analizando Consulta",
        color: "yellow"
      };
    }
    
    if (jsonContent.create_research_plan) {
      return {
        type: 'research_plan',
        data: jsonContent.create_research_plan,
        timestamp: Date.now(),
        messageId: `langgraph-plan-${globalBubbleCounter++}`,
        title: "📋 Creando Plan de Investigación",
        color: "green"
      };
    }
    
    if (jsonContent.conduct_research) {
      return {
        type: 'conduct_research',
        data: jsonContent.conduct_research,
        timestamp: Date.now(),
        messageId: `langgraph-research-${globalBubbleCounter++}`,
        title: "🔍 Investigando Documentos",
        color: "blue"
      };
    }
    
    if (jsonContent.respond) {
      return {
        type: 'respond',
        data: jsonContent.respond,
        timestamp: Date.now(),
        messageId: `langgraph-respond-${globalBubbleCounter++}`,
        title: "✍️ Preparando Respuesta",
        color: "purple"
      };
    }
  } catch (e) {
    console.log("❌ Error procesando actualización LangGraph:", e);
  }
  
  return null;
}

// Detectar JSON streaming con regex mejoradas y optimización
function detectStreamingJSON(content: string, messageId: string): BubbleState | null {
  // ===== FILTROS DE OPTIMIZACIÓN =====
  const contentHash = content.substring(0, 50) + content.length;
  const now = Date.now();
  
  // Skip procesamiento repetitivo del mismo contenido
  const previousProcessing = processedMessages.get(messageId);
  if (previousProcessing && 
      previousProcessing.hash === contentHash && 
      (now - previousProcessing.lastProcessed) < 100) {
    return null; // Skip procesamiento repetitivo
  }
  
  // Skip contenido que sabemos que no es JSON
  if (NON_JSON_CACHE.has(contentHash)) {
    return null;
  }
  
  // Si el contenido es muy largo y claramente no es JSON, cachearlo y salir
  const trimmed = content.trim();
  if (trimmed.length > 1000 && 
      !trimmed.includes('{') && 
      !trimmed.includes('"type":') && 
      !trimmed.includes('"logic":')) {
    NON_JSON_CACHE.add(contentHash);
    return null;
  }
  
  // Solo hacer log si es contenido potencialmente JSON
  if (content.includes('{') || content.includes('"')) {
    console.log("🔍 DETECTING STREAMING JSON:");
    console.log("MessageId:", messageId);
    console.log("Content:", content.substring(0, 200));
  }
  
  // Actualizar registro de procesamiento
  processedMessages.set(messageId, { hash: contentHash, lastProcessed: now });
  
  // Desescapar contenido
  const unescaped = content.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  
  // NUEVA REGEX MEJORADA: Detectar campos específicos sin requerir comillas de cierre
  
  // 1. Detectar logic (con o sin type)
  const logicMatch = unescaped.match(/\{\s*(?:"[^"]+"\s*:\s*[^,}]+,\s*)*"logic"\s*:\s*"([^"]*)/);
  if (logicMatch) {
    console.log("✅ LOGIC DETECTED:", logicMatch[1]);
    return {
      type: 'logic',
      data: { logic: logicMatch[1] },
      timestamp: Date.now(),
      messageId: `stream-logic-${messageId}`,
      title: "🧠 Razonamiento",
      color: "yellow"
    };
  }
  
  // 1b. Detectar tipo legal (específico para consultas jurídicas)
  const legalMatch = unescaped.match(/\{\s*"type"\s*:\s*"legal"(?:\s*,\s*"logic"\s*:\s*"([^"]*)")?/);
  if (legalMatch) {
    console.log("✅ LEGAL TYPE DETECTED:", legalMatch[1] || "Análisis jurídico");
    return {
      type: 'legal',
      data: { type: 'legal', logic: legalMatch[1] || 'Análisis jurídico iniciado' },
      timestamp: Date.now(),
      messageId: `stream-legal-${messageId}`,
      title: "⚖️ Análisis Jurídico",
      color: "indigo"
    };
  }
  
  // 2. Detectar steps array 
  const stepsMatch = unescaped.match(/\{\s*(?:"[^"]+"\s*:\s*[^,}]+,\s*)*"steps"\s*:\s*\[(.*)/s);
  if (stepsMatch) {
    console.log("✅ STEPS DETECTED:", stepsMatch[1]);
    // Extraer pasos individuales
    const stepPattern = /"([^"]+)"/g;
    const steps = [];
    let stepMatch;
    while ((stepMatch = stepPattern.exec(stepsMatch[1])) !== null) {
      steps.push(stepMatch[1]);
    }
    
    return {
      type: 'steps',
      data: { steps: steps.length > 0 ? steps : ['Preparando pasos...'] },
      timestamp: Date.now(),
      messageId: `stream-steps-${messageId}`,
      title: `📋 Pasos de Investigación (${steps.length})`,
      color: "green"
    };
  }
  
  // 3. Detectar reasoning
  const reasoningMatch = unescaped.match(/\{\s*(?:"[^"]+"\s*:\s*[^,}]+,\s*)*"reasoning"\s*:\s*"([^"]*)/);
  if (reasoningMatch) {
    console.log("✅ REASONING DETECTED:", reasoningMatch[1]);
    return {
      type: 'reasoning',
      data: { reasoning: reasoningMatch[1] },
      timestamp: Date.now(),
      messageId: `stream-reasoning-${messageId}`,
      title: "🔍 Análisis Detallado",
      color: "purple"
    };
  }
  
  // 4. Detectar analysis
  const analysisMatch = unescaped.match(/\{\s*(?:"[^"]+"\s*:\s*[^,}]+,\s*)*"analysis"\s*:\s*"([^"]*)/);
  if (analysisMatch) {
    console.log("✅ ANALYSIS DETECTED:", analysisMatch[1]);
    return {
      type: 'analysis',
      data: { analysis: analysisMatch[1] },
      timestamp: Date.now(),
      messageId: `stream-analysis-${messageId}`,
      title: "📊 Análisis",
      color: "blue"
    };
  }
  
  // 5. Detectar sources array
  const sourcesMatch = unescaped.match(/\{\s*(?:"[^"]+"\s*:\s*[^,}]+,\s*)*"sources"\s*:\s*\[(.*)/s);
  if (sourcesMatch) {
    console.log("✅ SOURCES DETECTED:", sourcesMatch[1]);
    const sourcePattern = /"([^"]+)"/g;
    const sources = [];
    let sourceMatch;
    while ((sourceMatch = sourcePattern.exec(sourcesMatch[1])) !== null) {
      sources.push(sourceMatch[1]);
    }
    
    return {
      type: 'sources',
      data: { sources: sources.length > 0 ? sources : ['Buscando fuentes...'] },
      timestamp: Date.now(),
      messageId: `stream-sources-${messageId}`,
      title: `📚 Fuentes Consultadas (${sources.length})`,
      color: "orange"
    };
  }
  
  console.log("❌ NO STREAMING JSON PATTERN MATCHED");
  return null;
}

// Detectar JSON completo válido
function detectCompleteJSON(content: string, messageId: string): BubbleState | null {
  // Evitar intentar parsear contenido que claramente no es JSON
  const trimmed = content.trim();
  
  // Si no comienza con { o [, muy probablemente no es JSON
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  
  // Si es demasiado largo y no tiene estructura JSON, probablemente es texto normal
  if (trimmed.length > 1000 && !trimmed.includes('"type":') && !trimmed.includes('"logic":') && !trimmed.includes('"steps":')) {
    return null;
  }
  
  try {
    const unescaped = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const parsed = JSON.parse(unescaped);
    console.log("✅ COMPLETE JSON DETECTED:", parsed);
    
    if (parsed.logic) {
      return {
        type: 'logic',
        data: parsed,
        timestamp: Date.now(),
        messageId: `complete-logic-${messageId}`,
        title: "🧠 Razonamiento",
        color: "yellow"
      };
    }
    
    // Detectar tipo legal completo
    if (parsed.type === 'legal' && parsed.logic) {
      return {
        type: 'legal',
        data: parsed,
        timestamp: Date.now(),
        messageId: `complete-legal-${messageId}`,
        title: "⚖️ Análisis Jurídico",
        color: "indigo"
      };
    }
    
    if (parsed.steps && Array.isArray(parsed.steps)) {
      return {
        type: 'steps',
        data: parsed,
        timestamp: Date.now(),
        messageId: `complete-steps-${messageId}`,
        title: `📋 Pasos de Investigación (${parsed.steps.length})`,
        color: "green"
      };
    }
    
    if (parsed.reasoning) {
      return {
        type: 'reasoning',
        data: parsed,
        timestamp: Date.now(),
        messageId: `complete-reasoning-${messageId}`,
        title: "🔍 Análisis Detallado",
        color: "purple"
      };
    }
    
    if (parsed.analysis) {
      return {
        type: 'analysis',
        data: parsed,
        timestamp: Date.now(),
        messageId: `complete-analysis-${messageId}`,
        title: "📊 Análisis",
        color: "blue"
      };
    }
    
    if (parsed.sources && Array.isArray(parsed.sources)) {
      return {
        type: 'sources',
        data: parsed,
        timestamp: Date.now(),
        messageId: `complete-sources-${messageId}`,
        title: `📚 Fuentes Consultadas (${parsed.sources.length})`,
        color: "orange"
      };
    }
  } catch (e) {
    // No es JSON válido, continuar
  }
  
  return null;
}

// Función helper para generar la sección de debug
function renderDebugSection(bubbleState: BubbleState) {
  return (
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
  );
}

// ===== FUNCIONES DE RENDERIZADO ESPECÍFICAS =====

function renderLogicBubble(bubbleState: BubbleState, key: string) {
  const { logic, type } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['logic-item']}
      className="border border-yellow-200 rounded-lg mb-2"
      key={key}
    >
      <Accordion.Item value="logic-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-yellow-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-yellow-100 text-yellow-800">
                🧠 Razonamiento
              </span>
              <span className="text-sm font-medium text-gray-700">
                {type || 'Análisis'}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0 space-y-3">
            {/* Contenido principal */}
            <div className="bg-yellow-50 p-3 rounded text-sm">
              <MarkdownText>{logic}</MarkdownText>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderLegalBubble(bubbleState: BubbleState, key: string) {
  const { type, logic } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['legal-item']}
      className="border border-indigo-200 rounded-lg mb-2"
      key={key}
    >
      <Accordion.Item value="legal-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-indigo-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-indigo-100 text-indigo-800">
                ⚖️ Análisis Jurídico
              </span>
              <span className="text-sm font-medium text-gray-700">
                {type}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0 space-y-3">
            {/* Contenido principal */}
            <div className="bg-indigo-50 p-3 rounded text-sm">
              <MarkdownText>{logic}</MarkdownText>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderStepsBubble(bubbleState: BubbleState, key: string) {
  const { steps } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['steps-item']}
      className="border border-green-200 rounded-lg mb-2"
      key={key}
    >
      <Accordion.Item value="steps-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-green-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-green-100 text-green-800">
                📋 Pasos ({steps.length})
              </span>
              <span className="text-sm font-medium text-gray-700">
                Plan de investigación
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0 space-y-3">
            {/* Contenido principal */}
            <div className="bg-green-50 p-3 rounded text-sm">
              <ol className="list-decimal list-inside space-y-2">
                {steps.map((step: string, index: number) => (
                  <li key={index} className="text-gray-700">
                    <span className="font-medium">{index + 1}.</span> <MarkdownText>{step}</MarkdownText>
                  </li>
                ))}
              </ol>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderReasoningBubble(bubbleState: BubbleState, key: string) {
  const { reasoning } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['reasoning-item']}
      className="border border-purple-200 rounded-lg mb-2"
      key={key}
    >
      <Accordion.Item value="reasoning-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-purple-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-purple-100 text-purple-800">
                🔍 Análisis Detallado
              </span>
              <span className="text-sm font-medium text-gray-700">
                Razonamiento profundo
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0 space-y-3">
            {/* Contenido principal */}
            <div className="bg-purple-50 p-3 rounded text-sm">
              <MarkdownText>{reasoning}</MarkdownText>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderAnalysisBubble(bubbleState: BubbleState, key: string) {
  const { analysis } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['analysis-item']}
      className="border border-blue-200 rounded-lg mb-2"
      key={key}
    >
      <Accordion.Item value="analysis-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-blue-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-blue-100 text-blue-800">
                📊 Análisis
              </span>
              <span className="text-sm font-medium text-gray-700">
                Análisis de datos
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0 space-y-3">
            {/* Contenido principal */}
            <div className="bg-blue-50 p-3 rounded text-sm">
              <MarkdownText>{analysis}</MarkdownText>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderSourcesBubble(bubbleState: BubbleState, key: string) {
  const { sources } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['sources-item']}
      className="border border-orange-200 rounded-lg mb-2"
      key={key}
    >
      <Accordion.Item value="sources-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-orange-50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-orange-100 text-orange-800">
                📚 Fuentes ({sources.length})
              </span>
              <span className="text-sm font-medium text-gray-700">
                Referencias consultadas
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0 space-y-3">
            {/* Contenido principal */}
            <div className="bg-orange-50 p-3 rounded text-sm">
              <ul className="list-disc list-inside space-y-1">
                {sources.map((source: string, index: number) => (
                  <li key={index} className="text-gray-700">
                    <MarkdownText>{source}</MarkdownText>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderAnalyzeQueryBubble(bubbleState: BubbleState, key: string) {
  const { router } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['analyze-item']}
      className="border border-yellow-300 rounded-lg mb-2 bg-yellow-25"
      key={key}
    >
      <Accordion.Item value="analyze-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-yellow-75 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-yellow-200 text-yellow-900">
                🎯 Analizando Consulta
              </span>
              <span className="text-sm font-medium text-gray-700">
                Tipo: {router.type || 'general'}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0">
            <div className="bg-yellow-75 p-3 rounded text-sm">
              <div className="space-y-2">
                <div><strong>Tipo de consulta:</strong> {router.type || 'No especificado'}</div>
                {router.logic && (
                  <div>
                    <strong>Lógica de análisis:</strong>
                    <div className="mt-1 p-2 bg-white/50 rounded"><MarkdownText>{router.logic}</MarkdownText></div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderResearchPlanBubble(bubbleState: BubbleState, key: string) {
  const { steps, documents } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['plan-item']}
      className="border border-green-300 rounded-lg mb-2 bg-green-25"
      key={key}
    >
      <Accordion.Item value="plan-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-green-75 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-green-200 text-green-900">
                📋 Plan de Investigación
              </span>
              <span className="text-sm font-medium text-gray-700">
                {steps ? steps.length : 0} pasos definidos
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0">
            <div className="bg-green-75 p-3 rounded text-sm">
              {steps && Array.isArray(steps) && (
                <div className="space-y-2">
                  <strong>Pasos del plan:</strong>
                  <ol className="list-decimal list-inside space-y-2 mt-2">
                    {steps.map((step: string, index: number) => (
                      <li key={index} className="text-gray-700">
                        <MarkdownText>{step}</MarkdownText>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {documents && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <strong>Estado de documentos:</strong> {documents}
                </div>
              )}
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderConductResearchBubble(bubbleState: BubbleState, key: string) {
  const { documents } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['research-item']}
      className="border border-blue-300 rounded-lg mb-2 bg-blue-25"
      key={key}
    >
      <Accordion.Item value="research-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-blue-75 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-blue-200 text-blue-900">
                🔍 Investigando Documentos
              </span>
              <span className="text-sm font-medium text-gray-700">
                {documents && Array.isArray(documents) ? documents.length : 0} documentos encontrados
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0">
            <div className="bg-blue-75 p-3 rounded text-sm max-h-96 overflow-y-auto">
              {documents && Array.isArray(documents) && (
                <div className="space-y-3">
                  <strong>Documentos encontrados:</strong>
                  {documents.map((doc: any, index: number) => (
                    <div key={index} className="border border-blue-200 rounded p-2 bg-white/50">
                      <div className="space-y-1">
                        {doc.metadata?.ius && (
                          <div><strong>IUS:</strong> {doc.metadata.ius}</div>
                        )}
                        {doc.metadata?.rubro && (
                          <div><strong>Rubro:</strong> {doc.metadata.rubro}</div>
                        )}
                        {doc.metadata?.localizacion && (
                          <div><strong>Localización:</strong> {doc.metadata.localizacion}</div>
                        )}
                        {doc.page_content && (
                          <div>
                            <strong>Contenido:</strong>
                            <div className="mt-1 p-2 bg-white/75 rounded text-xs max-h-32 overflow-y-auto">
                              <MarkdownText>{doc.page_content.substring(0, 500)}...</MarkdownText>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function renderRespondBubble(bubbleState: BubbleState, key: string) {
  const { messages } = bubbleState.data;
  
  return (
    <Accordion.Root 
      type="multiple" 
      defaultValue={['respond-item']}
      className="border border-purple-300 rounded-lg mb-2 bg-purple-25"
      key={key}
    >
      <Accordion.Item value="respond-item">
        <Accordion.Header>
          <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-3 text-left hover:bg-purple-75 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs font-mono bg-purple-200 text-purple-900">
                ✍️ Preparando Respuesta
              </span>
              <span className="text-sm font-medium text-gray-700">
                Respuesta final
              </span>
              <span className="text-xs text-gray-500">
                {new Date(bubbleState.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <ChevronDownIcon className="AccordionChevron" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="AccordionContent">
          <div className="p-3 pt-0">
            <div className="bg-purple-75 p-3 rounded text-sm">
              {messages && Array.isArray(messages) && messages.length > 0 && (
                <div className="space-y-2">
                  <strong>Respuesta preparada:</strong>
                  <div className="mt-2 p-3 bg-white/50 rounded">
                    <MarkdownText>{messages[0].content}</MarkdownText>
                  </div>
                  {messages[0].response_metadata && (
                    <div className="mt-2 pt-2 border-t border-purple-200 text-xs text-gray-600">
                      <div>Modelo: {messages[0].response_metadata.model_name}</div>
                      <div>Estado: {messages[0].response_metadata.finish_reason}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Información de debug */}
            {renderDebugSection(bubbleState)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

// ===== FUNCIÓN PRINCIPAL DE RENDERIZADO =====
function renderAllBubbles(): React.ReactElement[] {
  const allBubbles = Array.from(permanentBubbles.values())
    .sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`🎬 RENDERIZANDO TODAS LAS BURBUJAS ACUMULADAS: ${allBubbles.length}`);
  allBubbles.forEach((bubble, index) => {
    console.log(`  ${index + 1}. ${bubble.type} - ${bubble.title} (${new Date(bubble.timestamp).toLocaleTimeString()})`);
  });
  
  return allBubbles.map((bubble, index) => {
    const key = `bubble-${bubble.messageId}-${index}`;
    
    switch (bubble.type) {
      case 'logic':
        return renderLogicBubble(bubble, key);
      case 'legal':
        return renderLegalBubble(bubble, key);
      case 'steps':
        return renderStepsBubble(bubble, key);
      case 'reasoning':
        return renderReasoningBubble(bubble, key);
      case 'analysis':
        return renderAnalysisBubble(bubble, key);
      case 'sources':
        return renderSourcesBubble(bubble, key);
      case 'analyze_query':
        return renderAnalyzeQueryBubble(bubble, key);
      case 'research_plan':
        return renderResearchPlanBubble(bubble, key);
      case 'conduct_research':
        return renderConductResearchBubble(bubble, key);
      case 'respond':
        return renderRespondBubble(bubble, key);
      default:
        console.warn(`⚠️ Tipo de burbuja desconocido: ${bubble.type}`);
        return <div key={key}>Burbuja desconocida: {bubble.type}</div>;
    }
  });
}

// ===== FUNCIÓN PRINCIPAL DE PROCESAMIENTO =====
function renderContentWithThinkBubbles(contentString: string, messageType: string | undefined, messageId?: string) {
  // Validación defensiva para asegurar que contentString sea una string
  const safeContentString = typeof contentString === 'string' ? contentString : String(contentString || '');
  
  console.log("🔍 [DEBUG] Content analysis:", {
    length: safeContentString.length,
    type: messageType,
    hasThinkTags: safeContentString.includes('<think>'),
    preview: safeContentString.substring(0, 100)
  });

  const msgId = messageId || `msg-${Date.now()}`;
  
  // ===== 1. DETECTAR ACTUALIZACIONES LANGGRAPH =====
  const langGraphBubble = detectLangGraphUpdate(safeContentString, msgId);
  if (langGraphBubble) {
    console.log(`✅ LANGGRAPH BUBBLE CREATED: ${langGraphBubble.type}`);
    permanentBubbles.set(langGraphBubble.messageId, langGraphBubble);
    bubbleDebug.track('LANGGRAPH_BUBBLE_ADDED', langGraphBubble.messageId, { 
      type: langGraphBubble.type,
      totalBubbles: permanentBubbles.size 
    });
  }
  
  // ===== 2. DETECTAR JSON COMPLETO =====
  const completeBubble = detectCompleteJSON(safeContentString, msgId);
  if (completeBubble) {
    console.log(`✅ COMPLETE JSON BUBBLE CREATED: ${completeBubble.type}`);
    permanentBubbles.set(completeBubble.messageId, completeBubble);
    bubbleDebug.track('COMPLETE_JSON_BUBBLE_ADDED', completeBubble.messageId, { 
      type: completeBubble.type,
      totalBubbles: permanentBubbles.size 
    });
  }
  
  // ===== 3. DETECTAR JSON STREAMING =====
  const streamingBubble = detectStreamingJSON(safeContentString, msgId);
  if (streamingBubble) {
    console.log(`✅ STREAMING JSON BUBBLE CREATED: ${streamingBubble.type}`);
    permanentBubbles.set(streamingBubble.messageId, streamingBubble);
    bubbleDebug.track('STREAMING_JSON_BUBBLE_ADDED', streamingBubble.messageId, { 
      type: streamingBubble.type,
      totalBubbles: permanentBubbles.size 
    });
  }
  
  // ===== 4. RENDERIZAR TODAS LAS BURBUJAS + CONTENIDO =====
  const bubbles = renderAllBubbles();
  
  // ===== 5. PROCESAR THINK TAGS (contenido original) =====
  const parts = safeContentString.split(/(<think>[\s\S]*?<\/think>)/);
  const thinkParts = parts.filter(part => part.includes('<think>'));
  
  if (thinkParts.length > 0) {
    bubbleDebug.track('THINK_BUBBLES_DETECTED', msgId, { 
      count: thinkParts.length,
      totalParts: parts.length 
    });
  }

  const defaultSet: Set<string> = new Set();
  const renderedParts = parts.map((part, index) => {
    const isPartEffectivelyEmpty = part.trim() === "";
    if (isPartEffectivelyEmpty) {
      return null;
    }
    if (index % 2 === 1) {
      defaultSet.add(`item-${index}`);
      
      bubbleDebug.track('BUBBLE_RENDERING', 'current', { 
        index, 
        contentPreview: part.substring(0, 50),
        accordionValue: `item-${index}`
      });
      
      return (
        <Accordion.Root type="multiple" key={index} defaultValue={[...defaultSet]} className="p-2 my-2 text-xs bg-gray-100 border border-gray-200 rounded-lg italic text-gray-400">
          <Accordion.Item value={`item-${index}`}>
            <Accordion.Header>
              <Accordion.Trigger className="AccordionTrigger w-full flex items-center justify-between p-2 text-left hover:bg-gray-200 transition-colors">
                <span className="text-gray-600">🤔 Pensamiento interno</span>
                <ChevronDownIcon className="AccordionChevron" aria-hidden />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="AccordionContent">
              <div className="p-2">
                <MarkdownText>{part.slice(7, -8)}</MarkdownText>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      );
    } else {
      // Contenido normal
      return (
        <div key={index}>
          <MarkdownText>{part}</MarkdownText>
        </div>
      );
    }
  }).filter(Boolean);

  // ===== 6. RETORNAR BURBUJAS + CONTENIDO =====
  return (
    <div>
      {/* BURBUJAS ACUMULATIVAS SIEMPRE VISIBLES */}
      {bubbles.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="text-xs text-gray-500 font-medium">
            💭 Burbujas de Pensamiento ({bubbles.length})
          </div>
          {bubbles}
        </div>
      )}
      
      {/* CONTENIDO ORIGINAL */}
      <div>{renderedParts}</div>
    </div>
  );
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
            
            {/* Información de debug */}
            <div className="border-t pt-3 space-y-2 mt-3">
              <div className="text-xs">
                <span className="font-semibold text-gray-600">JSON Data:</span>
                <pre className="font-mono text-gray-500 bg-gray-50 p-2 rounded mt-1 overflow-x-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              </div>
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
            
            {/* Información de debug */}
            <div className="border-t pt-3 space-y-2 mt-3">
              <div className="text-xs">
                <span className="font-semibold text-gray-600">JSON Data:</span>
                <pre className="font-mono text-gray-500 bg-gray-50 p-2 rounded mt-1 overflow-x-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              </div>
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
            
            {/* Información de debug */}
            <div className="border-t pt-3 space-y-2 mt-3">
              <div className="text-xs">
                <span className="font-semibold text-gray-600">JSON Data:</span>
                <pre className="font-mono text-gray-500 bg-gray-50 p-2 rounded mt-1 overflow-x-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              </div>
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
                
                {/* Información de debug */}
                {renderDebugSection(bubbleState)}
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
  
  // Validación defensiva para asegurar que contentString sea una string
  const safeContentString = typeof contentString === 'string' ? contentString : String(contentString || '');
  
  bubbleDebug.track('COMPONENT_RENDER', messageId, {
    contentLength: safeContentString.length,
    isLoading,
    hasThinkTags: safeContentString.includes('<think>'),
    contentPreview: safeContentString.substring(0, 100)
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
            {safeContentString.length > 0 && (
              <div className="py-1 w-full">
                {renderContentWithThinkBubbles(safeContentString, message?.type, message?.id)}
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
                    content={safeContentString}
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
