'use client';
import { useState, useRef, useEffect } from 'react';
import { Pick, ChatMessage } from '@/types';

interface Props {
  picks: Pick[];
}

const SUGGESTIONS = [
  "What's my best prop type?",
  'Which players am I most profitable on?',
  'Is home or away better for my picks?',
  'Give me a betting strategy based on my data',
];

export default function ChatTab({ picks }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setShowSuggestions(false);
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, picks }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${String(err)}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function clearChat() {
    setMessages([]);
    setShowSuggestions(true);
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '600px' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700' }}>✦ Pick Prophet AI</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>Ask anything about your picks, players, props, or betting strategy</div>
        </div>
        <button
          onClick={clearChat}
          style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
          onMouseOver={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--text3)')}
        >
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Welcome */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ maxWidth: '78%', padding: '12px 16px', borderRadius: '14px', borderTopLeftRadius: '4px', background: 'var(--card2)', border: '1px solid var(--border)', fontSize: '14px', lineHeight: '1.65' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)', marginBottom: '6px' }}>Pick Prophet AI</div>
            Hey! I&apos;m your sports betting analyst. I have access to all your training picks and win rates. Ask me anything — pick advice, player analysis, whether a line has value, or strategy questions.
            <br /><br />
            <span style={{ color: 'var(--text3)', fontSize: '12px' }}>Try: &quot;Should I take Salah over 3.5 shots tonight?&quot; or &quot;What&apos;s my best performing prop type?&quot;</span>
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%', padding: '12px 16px',
              borderRadius: '14px',
              borderTopLeftRadius: m.role === 'assistant' ? '4px' : '14px',
              borderTopRightRadius: m.role === 'user' ? '4px' : '14px',
              background: m.role === 'user' ? 'var(--green)' : 'var(--card2)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              color: m.role === 'user' ? '#000' : 'var(--text)',
              fontWeight: m.role === 'user' ? '500' : 'normal',
              fontSize: '14px', lineHeight: '1.65',
            }}>
              {m.role === 'assistant' && (
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)', marginBottom: '6px' }}>Pick Prophet AI</div>
              )}
              {m.content.split('\n').map((line, j) => (
                <span key={j}>{line}{j < m.content.split('\n').length - 1 ? <br /> : ''}</span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '14px', borderTopLeftRadius: '4px', background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)', marginBottom: '6px' }}>Pick Prophet AI</div>
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {showSuggestions && messages.length === 0 && (
        <div style={{ padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '99px', padding: '6px 14px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              onMouseOver={e => { const el = e.currentTarget; el.style.borderColor = 'var(--green)'; el.style.color = 'var(--green)'; el.style.background = 'var(--green-dim)'; }}
              onMouseOut={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text2)'; el.style.background = 'var(--card2)'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', flexShrink: 0, background: 'var(--card)' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask about a pick, player, prop, or strategy..."
          rows={1}
          style={{ flex: 1, minHeight: '42px', maxHeight: '120px', resize: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', lineHeight: '1.5', fontFamily: 'inherit' }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{ background: 'var(--green)', color: '#000', border: 'none', borderRadius: '10px', padding: '0 18px', fontSize: '18px', cursor: 'pointer', fontWeight: '700', flexShrink: 0, transition: 'opacity 0.2s', opacity: loading || !input.trim() ? 0.35 : 1 }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
