"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Finding, ChatMessage } from "@/lib/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { getRemediation, chatRemediation, getFinding } from "@/lib/api";
import {
  AlertTriangle,
  Ban,
  XCircle,
  Globe,
  Bot,
  MessageSquare,
  Check,
  X,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";

function FindingStatusBadge({ status }: { status: string }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Check className="w-3 h-3" /> Resolved
      </span>
    );
  }
  if (status === "rescanning") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
        <Loader2 className="w-3 h-3 animate-spin" /> Rescanning
      </span>
    );
  }
  if (status === "manual") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700 border border-yellow-200">
        <AlertTriangle className="w-3 h-3" /> Manual
      </span>
    );
  }
  if (status === "not_found") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-slate-200 text-slate-600 border border-slate-300">
        <Ban className="w-3 h-3" /> Not Found
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3" /> Failing
    </span>
  );
}

interface RemediationPanelProps {
  finding: Finding | null;
  onClose: () => void;
  onRescan: (finding: Finding) => void;
  onFindingUpdate?: (updated: Finding) => void;
  rescanLoading: boolean;
}

export function RemediationPanel({
  finding,
  onClose,
  onRescan,
  onFindingUpdate,
  rescanLoading,
}: RemediationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [aiSteps, setAiSteps] = useState<{ steps: string; model: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Reset state when finding changes
  useEffect(() => {
    setAiSteps(null);
    setAiError(null);
    setChatMessages([]);
    setChatInput("");
  }, [finding?.id]);

  // Poll finding status while rescanning
  useEffect(() => {
    if (!finding || finding.status !== "rescanning") return;
    const interval = setInterval(async () => {
      try {
        const updated = await getFinding(finding.id);
        if (updated.status !== "rescanning") {
          onFindingUpdate?.(updated);
        }
      } catch {
        // Silently retry
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [finding, onFindingUpdate]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (finding) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [finding, onClose]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleGetRemediation = useCallback(async () => {
    if (!finding) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await getRemediation({
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation,
        severity: finding.severity,
        service: finding.service,
        resource_type: finding.resource_type,
        resource_id: finding.resource_id,
        region: finding.region,
      });
      setAiSteps(data);
    } catch (err) {
      setAiError((err as Error).message || "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }, [finding]);

  const handleSendChat = useCallback(async () => {
    if (!finding || !chatInput.trim()) return;
    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const findingContext = `Title: ${finding.title}\nDescription: ${finding.description}\nService: ${finding.service}\nSeverity: ${finding.severity}`;
      const data = await chatRemediation(findingContext, newMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }, [finding, chatInput, chatMessages]);

  if (!finding) return null;

  return (
    <>
      <div className="fixed inset-0 bg-transparent z-40" />
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-slide-in-right"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 leading-tight truncate">{finding.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <SeverityBadge severity={finding.severity} />
                <FindingStatusBadge status={finding.status} />
                <span className="text-xs text-slate-500 capitalize">{finding.service}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Resource info */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide">Resource</h3>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="font-mono text-xs text-slate-600 break-all">{finding.resource_id}</div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span>{finding.resource_type}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {finding.region === "global" ? "Global" : finding.region}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide">Description</h3>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {finding.description || "No description provided."}
            </p>
          </div>

          {/* Recommendation */}
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide">Recommendation</h3>
            <div className="text-sm text-slate-700 leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100 prose prose-sm max-w-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-slate-900">
              <ReactMarkdown>{finding.recommendation || "No recommendation provided."}</ReactMarkdown>
            </div>
          </div>

          {/* Resolution Banner */}
          {finding.status === "pass" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-sm text-emerald-800">
                <span className="font-semibold">Remediation verified!</span> This finding has been resolved.
                {finding.raw_data?.last_rescan_at && (
                  <span className="text-emerald-600 ml-1">
                    (rescanned {new Date(finding.raw_data.last_rescan_at).toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          )}

          {finding.status === "fail" && finding.raw_data?.last_rescan_at && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="text-sm text-red-800">
                <span className="font-semibold">Verification failed.</span> The issue persists.
                <span className="text-red-600 ml-1">
                  (rescanned {new Date(finding.raw_data.last_rescan_at).toLocaleString()})
                </span>
              </div>
            </div>
          )}

          {finding.status === "not_found" && (
            <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-2">
              <Ban className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="text-sm text-slate-700">
                <span className="font-semibold">Resource not found.</span> The resource may have been deleted. The security risk no longer applies.
              </div>
            </div>
          )}

          {/* AI Remediation Steps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide flex items-center gap-1">
                <Bot className="w-4 h-4" /> AI Remediation
              </h3>
              {aiSteps && (
                <span className="text-[10px] text-indigo-400 font-mono bg-indigo-100 px-2 py-0.5 rounded-full">{aiSteps.model}</span>
              )}
            </div>

            {!aiSteps && !aiLoading && !aiError && (
              <button onClick={handleGetRemediation} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md">
                <Bot className="w-4 h-4" />
                Get AI Remediation Steps
              </button>
            )}

            {aiLoading && (
              <div className="flex items-center gap-2 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="text-sm text-indigo-700">Generating remediation steps...</span>
              </div>
            )}

            {aiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
                <span><AlertTriangle className="w-4 h-4 inline mr-1" /> {aiError}</span>
                <button onClick={handleGetRemediation} className="text-xs text-red-600 hover:text-red-800 underline ml-2">Retry</button>
              </div>
            )}

            {aiSteps && (
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="text-slate-700 text-sm leading-relaxed bg-white/80 p-4 rounded-lg border border-indigo-100 prose prose-sm max-w-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1.5 [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:mb-2 [&_strong]:text-slate-900">
                  <ReactMarkdown>{aiSteps.steps}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Follow-up Chat */}
          {aiSteps && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wide flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Follow-up Questions
              </h3>

              {chatMessages.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`text-sm rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-blue-50 border border-blue-100 text-blue-900 ml-6"
                          : "bg-slate-50 border border-slate-200 text-slate-700 mr-6 prose prose-sm max-w-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_strong]:text-slate-900 [&_p]:mb-1"
                      }`}
                    >
                      {msg.role === "user" ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mr-6">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-200">
            <span>Updated: {new Date(finding.updated_at).toLocaleString()}</span>
            <span className="font-mono">ID: {finding.check_id}</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 shrink-0 flex items-center gap-3">
          <button
            onClick={() => onRescan(finding)}
            disabled={finding.status === "rescanning" || rescanLoading}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${
              finding.status === "pass"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-slate-800 text-white hover:bg-slate-900"
            }`}
          >
            {finding.status === "rescanning" || rescanLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rescanning...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {finding.status === "pass" ? "Rescan Again" : "Verify Fix"}
              </>
            )}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
