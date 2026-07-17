import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const WELCOME =
  "Hello! Welcome to Omni-Musk Support. How can I help you navigate your portfolio or track your orders today?";

const FALLBACK =
  "I apologize, but I don't have the exact answer to that question. Please reach out to our dedicated support desk directly at +1 (956) 572-4292 so one of our representatives can assist you further.";

function reply(input: string): string {
  const q = input.toLowerCase();
  if (/(invest|stock|deposit)/.test(q))
    return "You can start tracking an asset by navigating to the main market section, selecting a company card, and clicking 'Invest Now'. Your active allocations will automatically update in your Portfolio.";
  if (/(car|vehicle|delivery)/.test(q))
    return "To track your vehicles, visit the 'Vehicle Orders' section of your Portfolio. Once payment verification completes (approx. 2 hours), you will be prompted to enter your shipping details.";
  if (/(password|login|reset)/.test(q))
    return "You can manage your account credentials via the Authentication screen or trigger a secure recovery link using the 'Forgot Password' flow.";
  return FALLBACK;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: uid(), role: "assistant", text: WELCOME }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { id: uid(), role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: reply(text) }]);
      setTyping(false);
    }, 1000);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-elevated transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[60] flex h-[540px] max-h-[85vh] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-neutral-100 shadow-elevated">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 text-sm font-semibold">
                  OM
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-900" />
              </div>
              <div>
                <div className="text-sm font-semibold">Omni-Musk Support</div>
                <div className="text-[11px] text-emerald-400">Online</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-white text-neutral-900"
                      : "rounded-bl-sm bg-neutral-800 text-neutral-100"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-neutral-800 px-3.5 py-2.5 text-xs text-neutral-400">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" />
                  </span>
                  <span className="ml-2">Assistant is typing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 bg-neutral-900 p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your message…"
                className="flex-1 rounded-full border border-white/10 bg-neutral-950 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={send}
                disabled={!input.trim() || typing}
                aria-label="Send message"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-900 transition disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
