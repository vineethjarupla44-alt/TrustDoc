import React, { useState, useEffect, useRef } from 'react';
import type { ApplicationDetail, ChatMessage, Language, SuggestedQuestionItem } from '../../types';
import { sendChatMessage, fetchChatHistory, fetchSuggestedQuestions, clearChatHistory } from '../../services/api';
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Languages,
  Trash2,
  Wrench
} from 'lucide-react';

interface ChatbotScreenProps {
  application: ApplicationDetail | null;
  language: Language;
  onNavigateToRule?: (ruleCode: string) => void;
}

export const ChatbotScreen: React.FC<ChatbotScreenProps> = ({
  application,
  language,
  onNavigateToRule,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [chatLang, setChatLang] = useState<Language>(language);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestionItem[]>([]);
  const [isCrossTenantError, setIsCrossTenantError] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fallback questions if dynamic fetch is unavailable
  const fallbackSuggestions: SuggestedQuestionItem[] = [
    {
      id: 'fb-1',
      question_text: 'What are the Fire Safety Certificate (Fire NOC) requirements under Chapter 3?',
      category: 'RAG_REQUIREMENT',
      related_rule_code: 'Clause 3.1',
    },
    {
      id: 'fb-2',
      question_text: 'What is the minimum land requirement for an Urban Engineering College?',
      category: 'RAG_REQUIREMENT',
      related_rule_code: 'Clause 1.1',
    },
    {
      id: 'fb-3',
      question_text: 'How can I fix missing mandatory documents on my application?',
      category: 'DEFICIENCY',
      related_rule_code: 'SYNTH-DOC-01',
    },
    {
      id: 'fb-4',
      question_text: 'What are the Council of Architecture (COA) registration criteria?',
      category: 'RAG_REQUIREMENT',
      related_rule_code: 'Clause 2.1',
    },
  ];

  useEffect(() => {
    if (application?.id) {
      loadHistory();
      loadSuggestedQuestions();
    }
  }, [application?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    if (!application?.id) return;
    setInitialLoading(true);
    setIsCrossTenantError(false);
    try {
      const history = await fetchChatHistory(application.id);
      if (history && history.length > 0) {
        setMessages(history);
      } else {
        resetWelcomeMessage();
      }
    } catch (err: any) {
      console.error('Failed to load chat history:', err);
      if (err?.response?.status === 403) {
        setIsCrossTenantError(true);
      } else {
        resetWelcomeMessage();
      }
    } finally {
      setInitialLoading(false);
    }
  };

  const resetWelcomeMessage = () => {
    setMessages([
      {
        id: 'welcome-1',
        sender: 'AI_ADVISOR',
        message_text: `Welcome to the TrustDoc Applicant Copilot! I am your interactive regulatory compliance advisor for Application **${application?.application_number ?? 'DRAFT'}**.\n\nI can explain specific regulatory norms from the official AICTE Approval Process Handbook (2026-2027), explain any deficiencies flagged on your application, and suggest concrete remediation steps.`,
        cited_rule_references: [
          { rule_code: 'Clause 1.1', title: 'Land & Infrastructure Norms', page_number: 4 },
          { rule_code: 'Clause 3.1', title: 'Fire Safety Certificate Norms', page_number: 18 }
        ],
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const loadSuggestedQuestions = async () => {
    if (!application?.id) return;
    try {
      const res = await fetchSuggestedQuestions(application.id);
      if (res && res.questions && res.questions.length > 0) {
        setSuggestedQuestions(res.questions);
      } else {
        setSuggestedQuestions(fallbackSuggestions);
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic suggestions, using fallback:', err);
      setSuggestedQuestions(fallbackSuggestions);
    }
  };

  const handleClearHistory = async () => {
    if (!application?.id || clearing) return;
    const confirmClear = window.confirm(
      'Are you sure you want to clear this advisory conversation history? This cannot be undone.'
    );
    if (!confirmClear) return;

    setClearing(true);
    try {
      await clearChatHistory(application.id);
      resetWelcomeMessage();
    } catch (err) {
      console.error('Failed to clear chat history:', err);
      alert('Could not clear chat history. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const handleSend = async (messageToSend?: string) => {
    const text = messageToSend || inputMessage;
    if (!text.trim() || !application?.id || loading) return;

    setIsCrossTenantError(false);

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: 'USER',
      message_text: text,
      cited_rule_references: [],
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!messageToSend) setInputMessage('');
    setLoading(true);

    try {
      const response = await sendChatMessage(application.id, text, chatLang);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      console.error('Chat error:', err);
      if (err?.response?.status === 403) {
        setIsCrossTenantError(true);
        const secMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'AI_ADVISOR',
          message_text: '⚠️ **Access Denied (Multi-Tenant Protection)**: You can only query compliance guidance for your own institution’s registered applications. Cross-tenant access is strictly blocked.',
          cited_rule_references: [],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, secMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'AI_ADVISOR',
          message_text: 'An error occurred while consulting the regulatory knowledge base. Please verify your connection and rephrase or retry your question.',
          cited_rule_references: [],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setLoading(false);
    }
  };

  const displayedSuggestions = suggestedQuestions.length > 0 ? suggestedQuestions : fallbackSuggestions;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-7xl mx-auto p-4 md:p-6">
      {/* Header & Statutory Disclaimer Banner */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-800 text-blue-200 flex items-center justify-center font-bold shadow-md shadow-blue-900/10 border border-blue-700/50">
              <Bot className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Applicant Compliance Copilot</h1>
                <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-600" />
                  Hybrid FAISS + BM25 RAG
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Active Application:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {application?.application_number ?? 'No application loaded'}
                </span>{' '}
                • {application?.program_name ?? 'General Category'} •{' '}
                <span className="text-slate-600">{application?.institution_type ?? 'Institution'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 shadow-xs">
              <Languages className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-slate-500 font-medium">Language:</span>
              <select
                aria-label="Select Advisor Language"
                value={chatLang}
                onChange={(e) => setChatLang(e.target.value as Language)}
                className="bg-transparent font-semibold text-blue-700 focus:outline-none cursor-pointer"
              >
                <option value="en">English (EN)</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="te">తెలుగు (Telugu)</option>
              </select>
            </div>

            {/* Clear History Button */}
            <button
              onClick={handleClearHistory}
              disabled={clearing || loading || !application?.id}
              title="Clear conversation history"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors shadow-xs flex items-center gap-1 text-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Reload History */}
            <button
              onClick={loadHistory}
              disabled={initialLoading || loading || !application?.id}
              title="Refresh conversation history"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${initialLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Regulatory & Guardrail Notice Banner */}
        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl flex items-start gap-3 text-xs text-amber-950 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-amber-900">Statutory Notice & Advisory Guardrails:</span>{' '}
            Responses are grounded deterministically in the{' '}
            <span className="font-semibold underline">AICTE Approval Process Handbook (2026-2027 v2026.1)</span>. The Copilot provides procedural guidance and deficiency explanations. It{' '}
            <span className="font-bold underline text-amber-900">cannot grant, guarantee, or promise accreditation approvals</span>, nor override deterministic validation checks or Scrutiny Committee findings.
          </div>
        </div>

        {isCrossTenantError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Multi-Tenant Isolation Triggered:</span> Cross-institutional access is prohibited. You can only consult records belonging to your assigned institution account.
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/60">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
              <p className="text-sm font-medium text-slate-600">Loading regulatory advisory session...</p>
              <p className="text-xs text-slate-400 mt-1">Connecting to handbook vector store</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAi = msg.sender === 'AI_ADVISOR' || msg.sender === 'SYSTEM';
              const isRefusal = isAi && (msg.message_text.includes('not explicitly covered') || msg.message_text.includes('does not cover'));
              const isApprovalRefusal = isAi && (msg.message_text.includes('cannot guarantee') || msg.message_text.includes('cannot promise') || msg.message_text.includes('official decision rests'));

              const timestampStr = msg.created_at || msg.timestamp || new Date().toISOString();

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${isAi ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-xs ${
                      isAi
                        ? 'bg-blue-900 text-blue-200 ring-2 ring-blue-100'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    {isAi ? <Bot className="w-4 h-4 text-blue-300" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-xs transition-all ${
                      isAi
                        ? isApprovalRefusal
                          ? 'bg-amber-50/90 text-slate-900 border border-amber-200 rounded-tl-none'
                          : isRefusal
                          ? 'bg-slate-50 text-slate-900 border border-slate-300 rounded-tl-none'
                          : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'
                        : 'bg-blue-700 text-white rounded-tr-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] opacity-80">
                      <span className="font-semibold flex items-center gap-1">
                        {isAi ? (
                          <>
                            <span>AI Compliance Copilot</span>
                            {isApprovalRefusal ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                Guardrail Active
                              </span>
                            ) : isRefusal ? (
                              <span className="bg-slate-200 text-slate-700 text-[10px] font-medium px-1.5 py-0.2 rounded">
                                Epistemic Admission
                              </span>
                            ) : (
                              <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-1.5 py-0.2 rounded border border-blue-200">
                                Handbook Grounded
                              </span>
                            )}
                          </>
                        ) : (
                          'Applicant Representative'
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(timestampStr).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="whitespace-pre-line text-inherit text-xs md:text-sm">
                      {msg.message_text}
                    </div>

                    {/* Cited Rule References */}
                    {isAi && msg.cited_rule_references && msg.cited_rule_references.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100/90 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Verified Handbook Reference Citations:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.cited_rule_references.map((citation, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 hover:bg-blue-100/70 transition-colors flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="font-mono font-bold text-xs text-blue-900">
                                    {citation.rule_code}
                                  </span>
                                  {citation.page_number && (
                                    <span className="text-[10px] bg-blue-200 text-blue-800 font-semibold px-1.5 py-0.2 rounded">
                                      Page {citation.page_number}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-slate-800 line-clamp-2">
                                  {citation.title}
                                </p>
                                {citation.source_name && (
                                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                                    {citation.source_name}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-blue-200/60 text-[11px]">
                                {onNavigateToRule && (
                                  <button
                                    onClick={() => onNavigateToRule(citation.rule_code)}
                                    className="text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1"
                                  >
                                    <span>Inspect Rule</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                                {citation.official_url && (
                                  <a
                                    href={citation.official_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-500 hover:text-slate-800 underline truncate max-w-[120px]"
                                  >
                                    Official Portal
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-full bg-blue-900 text-blue-200 flex items-center justify-center flex-shrink-0 ring-2 ring-blue-100">
                <Bot className="w-4 h-4 text-blue-300" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-600 flex items-center gap-2.5 shadow-xs">
                <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Searching Approval Handbook clauses & verifying citation integrity...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Contextual Suggestion Chips */}
        <div className="px-4 py-2.5 bg-slate-100/80 border-t border-slate-200">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 flex-shrink-0">
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Suggested Inquiries:
            </span>
            <div className="flex gap-2">
              {displayedSuggestions.map((item) => {
                const isDeficiency = item.category === 'DEFICIENCY';
                const isRAG = item.category === 'RAG_REQUIREMENT';
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSend(item.question_text)}
                    disabled={loading}
                    className={`text-xs rounded-full px-3 py-1 whitespace-nowrap transition-all shadow-2xs font-medium flex items-center gap-1.5 ${
                      isDeficiency
                        ? 'bg-amber-100/80 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        : isRAG
                        ? 'bg-white hover:bg-blue-50 text-blue-900 hover:text-blue-800 border border-blue-200 hover:border-blue-300'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isDeficiency ? (
                      <Wrench className="w-3 h-3 text-amber-700 flex-shrink-0" />
                    ) : isRAG ? (
                      <BookOpen className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    )}
                    <span>{item.question_text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about AICTE handbook requirements, fire safety validity, missing documents, or remediation steps..."
              disabled={loading || !application?.id}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading || !application?.id}
              className="bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors flex-shrink-0"
            >
              <span>Ask Copilot</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mt-1.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Grounded in AICTE Approval Process Handbook (2026-2027 v2026.1)</span>
            </div>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};
