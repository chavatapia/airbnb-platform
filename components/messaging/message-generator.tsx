"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Message } from "@prisma/client";

type MessageType = "welcome" | "checkin" | "checkout" | "faq" | "special";

const MESSAGE_TYPES: { value: MessageType; label: string; emoji: string }[] = [
  { value: "welcome", label: "Bienvenida", emoji: "👋" },
  { value: "checkin", label: "Check-in", emoji: "🔑" },
  { value: "checkout", label: "Check-out", emoji: "🚪" },
  { value: "faq", label: "FAQ / Respuesta", emoji: "❓" },
  { value: "special", label: "Personalizado", emoji: "✏️" },
];

interface Props {
  reservationId: string;
  region: string;
  recentMessages: Message[];
}

export function MessageGenerator({ reservationId, region, recentMessages }: Props) {
  const [messageType, setMessageType] = useState<MessageType>("welcome");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setGenerated("");

    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId,
        messageType,
        customPrompt: messageType === "special" ? customPrompt : undefined,
      }),
    });

    const json = await res.json();
    setGenerated(json.message ?? json.error ?? "Error al generar el mensaje");
    setLoading(false);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Tipo de mensaje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MESSAGE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setMessageType(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  messageType === t.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>

          {messageType === "special" && (
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="mt-3 w-full border border-input rounded-md px-3 py-2 text-sm resize-none"
              placeholder="Escribe las instrucciones para el mensaje personalizado..."
            />
          )}

          <Button
            onClick={generate}
            disabled={loading || (messageType === "special" && !customPrompt)}
            className="mt-3"
          >
            {loading ? "Generando..." : "✨ Generar mensaje"}
          </Button>
        </CardContent>
      </Card>

      {/* Generated message */}
      {generated && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Mensaje generado</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {region === "MEXICO" ? "Espanol" : "Ingles"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              rows={8}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? "✓ Copiado" : "Copiar"}
              </Button>
              <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
                Regenerar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Historial reciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMessages.map((msg) => (
              <div key={msg.id} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">{msg.messageType}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleString("es-MX", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{msg.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
