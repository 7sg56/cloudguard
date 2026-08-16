"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Finding, ChatMessage } from "@/lib/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { getRemediation, chatRemediation } from "@/lib/api";
import {
  AlertTriangle,
  Sparkles,
  Bot,
  MessageSquare,
  Check,
  X,
  Loader2,
  RefreshCw,
  Send,
  Copy,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  rescanLoading,
}: RemediationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"ai" | "chat" | "details">("ai");
  const [aiSteps, setAiSteps] = useState<{ steps: string; model: string; tokens_used?: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Auto-fetch remediation when finding opens
  useEffect(() => {
    if (!finding) {
      setAiSteps(null);
      setAiError(null);
      setChatMessages([]);
      setChatInput("");
      return;
    }

    let isMounted = true;
    const loadRemediation = async () => {
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
        if (isMounted) setAiSteps(data);
      } catch (err) {
        if (isMounted) setAiError((err as Error).message || "Failed to generate remediation.");
      } finally {
        if (isMounted) setAiLoading(false);
      }
    };

    loadRemediation();
    return () => {
      isMounted = false;
    };
  }, [finding?.id]);

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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleSendChat = useCallback(async () => {
    if (!finding || !chatInput.trim()) return;
    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const findingContext = `Title: ${finding.title}\nDescription: ${finding.description}\nService: ${finding.service}\nSeverity: ${finding.severity}\nResource: ${finding.resource_id}`;
      const data = await chatRemediation(findingContext, newMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to generate reply. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [finding, chatInput, chatMessages]);

  if (!finding) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px] animate-fade-in">
      <div
        ref={panelRef}
        className="w-full max-w-2xl bg-white h-full shadow-xl flex flex-col animate-slide-in-right overflow-hidden border-l border-slate-200"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <SeverityBadge severity={finding.severity} />
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">
                  {finding.service}
                </span>
                {finding.region && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {finding.region}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-slate-900 leading-snug" title={finding.title}>
                {finding.title}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate" title={finding.resource_id}>
                {finding.resource_id}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 mt-4 pt-2 border-t border-slate-100 text-xs">
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "ai"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Remediation
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              Ask AI ({chatMessages.length})
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "details"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Event Details
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {activeTab === "ai" && (
            <div className="space-y-4">
              {/* Finding Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Risk Overview
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {finding.description || "No description provided."}
                </p>
                {finding.recommendation && (
                  <div className="pt-2 border-t border-slate-200/60 text-slate-600">
                    <span className="font-semibold text-slate-800">Recommendation:</span>{" "}
                    {finding.recommendation}
                  </div>
                )}
              </div>

              {/* AI Steps */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Bot className="w-4 h-4 text-brand-600" />
                    <span>Resolution Steps</span>
                  </div>
                  {aiSteps && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(aiSteps.steps)}
                      className="h-7 text-[11px] gap-1 text-slate-600"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {aiLoading ? (
                  <div className="p-8 border border-slate-200 rounded-lg bg-slate-50/50 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
                    <p className="font-medium text-slate-800">Generating Resolution Guide...</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Querying Groq AI for CLI commands and Terraform fixes.
                    </p>
                  </div>
                ) : aiError ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                    {aiError}
                  </div>
                ) : aiSteps ? (
                  <div className="prose prose-xs max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-3 prose-code:text-brand-700 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono">
                    <ReactMarkdown>{aiSteps.steps}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex-1 space-y-2.5 min-h-[260px]">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Bot className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-medium text-slate-700">Ask a question about this finding</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Need help applying this fix or understanding IAM roles?
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex text-xs ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-lg max-w-[85%] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" /> Generating response...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="pt-2 border-t border-slate-200 flex gap-2">
                <Input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Ask a question about this fix..."
                  className="h-8 text-xs bg-white"
                />
                <Button
                  size="sm"
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="h-8 px-3"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">Check ID:</span>
                  <span className="font-mono text-slate-800 font-medium">{finding.check_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status:</span>
                  <span className="capitalize font-medium text-slate-800">{finding.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Region:</span>
                  <span className="font-mono text-slate-800">{finding.region || "global"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Resource Type:</span>
                  <span className="text-slate-800">{finding.resource_type || "AWS Resource"}</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Raw Finding JSON:</span>
                <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-80">
                  {JSON.stringify(finding.raw_data || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => onRescan(finding)}
            disabled={rescanLoading || finding.status === "rescanning"}
            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {rescanLoading || finding.status === "rescanning" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" /> Verify Fix & Rescan
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
