"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CleaningStatus } from "@prisma/client";

interface Props {
  taskId: string;
  currentStatus: CleaningStatus;
  assignedTo?: string | null;
  userRole?: string;
  userEmail?: string;
}

export function CleaningTaskActions({ taskId, currentStatus, assignedTo, userRole, userEmail }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const isAdmin = userRole === "ADMIN";

  async function updateStatus(status: CleaningStatus, taskNotes?: string, completedBy?: string) {
    setLoading(true);
    await fetch(`/api/cleaning/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes: taskNotes, completedBy }),
    });
    setLoading(false);
    setShowNotes(false);
    router.refresh();
  }

  if (currentStatus === "PENDING") {
    return (
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          onClick={() => updateStatus("IN_PROGRESS")}
          disabled={loading}
        >
          Iniciar
        </Button>
      </div>
    );
  }

  if (currentStatus === "IN_PROGRESS") {
    return (
      <div className="flex flex-col gap-2 items-end">
        {isAdmin ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={() => updateStatus("DONE", undefined, assignedTo ?? undefined)}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-xs"
            >
              ✓ Juliia
            </Button>
            <Button
              size="sm"
              onClick={() => updateStatus("DONE", undefined, userEmail)}
              disabled={loading}
              variant="outline"
              className="text-xs text-green-700 border-green-300"
            >
              ✓ Yo
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => updateStatus("DONE", undefined, userEmail)}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            Lista ✓
          </Button>
        )}
        {showNotes ? (
          <div className="w-48 space-y-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-xs border rounded p-1 resize-none"
              placeholder="Describe el problema..."
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-7 flex-1"
                onClick={() => updateStatus("ISSUE", notes)}
                disabled={!notes || loading}
              >
                Reportar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => setShowNotes(false)}
              >
                X
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNotes(true)}
            className="text-xs text-red-600 border-red-200"
          >
            Problema
          </Button>
        )}
      </div>
    );
  }

  if (currentStatus === "ISSUE") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => updateStatus("DONE")}
        disabled={loading}
        className="text-xs text-gray-600 border-gray-300"
      >
        {loading ? "..." : "Cerrar ✓"}
      </Button>
    );
  }

  return null;
}
