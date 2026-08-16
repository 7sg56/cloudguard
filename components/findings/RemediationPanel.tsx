"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Finding, ChatMessage } from "@/lib/types";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { getRemediation, chatRemediation, getFinding } from "@/lib/api";
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
  Terminal,
  Code2,
  FileText,
} from "lucide-react";

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
        { role: "assistant", content: "Failed to generate reply. Please verify connection and try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [finding, chatInput, chatMessages]);

  if (!finding) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px] animate-fade-in">
      <div
        ref={panelRef}
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border-l border-slate-200"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <SeverityBadge severity={finding.severity} />
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase tracking-wider">
                  {finding.service}
                </span>
                {finding.region && (
                  <span className="text-xs text-slate-400 font-mono">
                    {finding.region}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white leading-snug truncate" title={finding.title}>
                {finding.title}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1 truncate" title={finding.resource_id}>
                {finding.resource_id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-5 pt-3 border-t border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "ai"
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Remediation
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "chat"
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask AI ({chatMessages.length})
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "details"
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Event Details
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "ai" && (
            <div className="space-y-6">
              {/* Finding Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Risk Overview
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {finding.description || "No description provided."}
                </p>
                {finding.recommendation && (
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Recommendation:</span>{" "}
                    {finding.recommendation}
                  </div>
                )}
              </div>

              {/* AI Output Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Step-by-Step Resolution Guide
                    </h3>
                  </div>
                  {aiSteps && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {aiSteps.model}
                      </span>
                      <button
                        onClick={() => handleCopy(aiSteps.steps)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 p-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        {copiedText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {aiLoading ? (
                  <div className="p-10 border border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
                    <p className="text-sm font-semibold text-slate-800">
                      Generating Tailored Remediation...
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Analyzing AWS security finding with Groq LLaMA 3.3 to construct CLI commands and Terraform fixes.
                    </p>
                  </div>
                ) : aiError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    {aiError}
                  </div>
                ) : aiSteps ? (
                  <div className="prose prose-sm max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-pre:bg-slate-950 prose-pre:text-slate-100 prose-pre:rounded-xl prose-pre:p-4 prose-code:text-brand-700 prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs">
                    <ReactMarkdown>{aiSteps.steps}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === "chat" && (
            <div className="flex flex-col h-full space-y-4">
              <div className="flex-1 space-y-3 min-h-[300px]">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Bot className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">
                      Ask Groq AI about this finding
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Need help customizing the CLI commands or understanding compliance requirements? Ask below.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 text-xs ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`p-3.5 rounded-xl max-w-[85%] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-800 border border-slate-200/60"
                        }`}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Groq AI is typing...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="pt-3 border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Ask a question about this fix..."
                  className="flex-1 px-3.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-800"
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3.5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block">Check ID:</span>
                    <span className="font-mono text-slate-800 font-semibold">{finding.check_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span className="capitalize font-semibold text-slate-800">{finding.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Region:</span>
                    <span className="font-mono text-slate-800">{finding.region || "Global"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Resource Type:</span>
                    <span className="text-slate-800">{finding.resource_type || "AWS Resource"}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Raw Event JSON
                </h4>
                <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-96">
                  {JSON.stringify(finding.raw_data || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close Panel
          </button>
          <button
            onClick={() => onRescan(finding)}
            disabled={rescanLoading || finding.status === "rescanning"}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {rescanLoading || finding.status === "rescanning" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Fix...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" /> Verify Fix & Rescan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
