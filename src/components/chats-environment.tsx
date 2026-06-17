"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function ChatsEnvironment() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [chats, setChats] = useState<any[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setUser(data.session.user);
      loadChats();
    });
  }, [router]);

  async function loadChats() {
    setIsLoadingChats(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && data.chats) {
        setChats(data.chats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingChats(false);
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f5ef] px-6 text-[#20231f]">
        <p className="border border-[#d9d2c2] bg-white px-5 py-4 text-sm font-medium">
          Cargando entorno de chats...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f5ef] text-[#20231f]">
      <header className="border-b border-[#d9d2c2] bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium uppercase text-[#6c8f5e]">
                Entorno
              </p>
              <h1 className="text-2xl font-semibold">Chats WhatsApp</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="break-all text-sm text-[#5f625c]">{user?.email}</p>
            <Link
              href="/dashboard"
              className="flex h-10 items-center justify-center border border-[#20231f] px-4 text-sm font-semibold transition hover:bg-[#20231f] hover:text-white"
            >
              Volver a Dashboard
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 border border-[#20231f] px-4 text-sm font-semibold transition hover:bg-[#20231f] hover:text-white"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10">
        <div className="flex h-[calc(100vh-180px)] min-h-[500px] overflow-hidden border border-[#d9d2c2] bg-white shadow-sm">
          {/* Sidebar list of chats */}
          <div className="flex w-1/3 flex-col border-r border-[#d9d2c2] bg-[#fdfdfc]">
            <div className="flex items-center justify-between border-b border-[#d9d2c2] p-4 bg-white">
              <h2 className="text-base font-semibold">Conversaciones</h2>
              <button onClick={loadChats} className="text-xs text-[#5f625c] hover:underline">Refrescar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingChats ? (
                <p className="p-4 text-center text-sm text-[#5f625c]">Cargando chats...</p>
              ) : chats.length === 0 ? (
                <p className="p-4 text-center text-sm text-[#5f625c]">No hay conversaciones aún.</p>
              ) : (
                chats.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPhone(c.phone_number)}
                    className={`mb-1 flex w-full flex-col items-start gap-1 p-3 text-left transition hover:bg-[#f0ede6] ${
                      selectedPhone === c.phone_number ? "bg-[#ebe6db] border-l-4 border-[#6c8f5e]" : ""
                    }`}
                  >
                    <p className="text-sm font-semibold">{c.phone_number}</p>
                    <p className="w-full truncate text-xs text-[#5f625c]">{c.message_body}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Active chat panel */}
          <div className="flex flex-1 flex-col bg-[#ece5dd]">
            {selectedPhone ? (
              <ChatPanel phone={selectedPhone} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-[#5f625c]">
                <div className="text-center">
                  <p className="text-lg font-medium">Selecciona un chat</p>
                  <p className="text-sm">Para ver los mensajes de la conversación</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ChatPanel({ phone }: { phone: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadMessages();
    loadAiState();
    const interval = setInterval(loadMessages, 5000); // Polling every 5s
    return () => clearInterval(interval);
  }, [phone]);

  async function loadAiState() {
    try {
      const res = await fetch(`/api/whatsapp/ai-toggle?phone=${phone}`);
      const data = await res.json();
      if (res.ok) setAiEnabled(data.ai_enabled);
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleAi() {
    setIsTogglingAi(true);
    const newState = !aiEnabled;
    try {
      const res = await fetch("/api/whatsapp/ai-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, ai_enabled: newState }),
      });
      if (res.ok) {
        setAiEnabled(newState);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingAi(false);
    }
  }

  async function loadMessages() {
    try {
      const res = await fetch(`/api/whatsapp/messages?phone=${phone}&t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    
    setIsSending(true);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, text: replyText }),
      });
      if (res.ok) {
        setReplyText("");
        await loadMessages();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#075e54] p-4 text-white">
        <div className="flex items-center gap-4">
          <p className="font-semibold text-lg">{phone}</p>
          <div className="flex items-center gap-2 border-l border-white/30 pl-4">
            <span className="text-sm font-medium">Agente IA</span>
            <button
              type="button"
              onClick={toggleAi}
              disabled={isTogglingAi}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiEnabled ? "bg-[#25d366]" : "bg-[#8f928b]"
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && messages.length === 0 ? (
          <p className="text-center text-sm text-[#5f625c]">Cargando mensajes...</p>
        ) : (
          messages.map((m) => {
            const isOutbound = m.direction === "outbound";
            return (
              <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-md p-3 text-sm shadow-sm ${
                    isOutbound ? "bg-[#dcf8c6] text-black" : "bg-white text-black"
                  }`}
                >
                  <p>{m.message_body}</p>
                  <p className="mt-1 text-right text-[10px] text-gray-500">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="bg-[#f0f0f0] p-4 flex gap-3 border-t border-[#d9d2c2]">
        <input
          type="text"
          className="flex-1 rounded-full border border-[#d9d2c2] px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#075e54]"
          placeholder="Escribe un mensaje..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSending || !replyText.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#128c7e] text-white disabled:opacity-50 hover:bg-[#0f776a] transition"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
