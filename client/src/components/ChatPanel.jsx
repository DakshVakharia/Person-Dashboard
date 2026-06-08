import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { chat } from '../services/api.js';

export default function ChatPanel({ horizontal = false }) {
  const { chatMessages, setChatMessages } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (loaded) return;
    chat.history(20).then(rows => {
      setChatMessages(rows.map(r => ({ ...r, id: r.id })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [loaded, setChatMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loading]);

  const sendMessage = async (message, imageBase64) => {
    if (!message && !imageBase64) return;
    setChatMessages(prev => [...prev, { role: 'user', content: message || '📷 Photo', id: Date.now() }]);
    setInput('');
    setLoading(true);
    try {
      const { reply } = await chat.send(message, imageBase64 || null);
      setChatMessages(prev => [...prev, { role: 'model', content: reply, id: Date.now() + 1 }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'model', content: `⚠️ ${e.message}`, id: Date.now() + 1 }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.trim()); }
  };

  const handlePhoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => sendMessage('', ev.target.result.split(',')[1]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (horizontal) {
    return (
      <div className="chat-h-wrap">
        {/* Scrolling messages */}
        <div className="chat-h-messages">
          {chatMessages.slice(-6).map(msg => (
            <div key={msg.id || Math.random()} className={`chat-h-msg ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {loading && <div className="chat-h-msg typing">Thinking…</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="chat-h-input">
          <div className="chat-h-label">Gemini</div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything… log meals, set reminders, edit calendar"
            rows={2}
            disabled={loading}
          />
          <div className="chat-h-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={loading} title="Photo">📷</button>
            <button className="btn btn-primary btn-sm" onClick={() => sendMessage(input.trim())} disabled={loading || !input.trim()}>↑</button>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
      </div>
    );
  }

  // Vertical (portrait)
  return (
    <>
      <div className="chat-header">
        <h3>Gemini</h3>
        <button className="btn btn-ghost btn-sm" onClick={async () => { if (!confirm('Clear history?')) return; await chat.clear(); setChatMessages([]); }}>✕</button>
      </div>
      <div className="chat-messages">
        {chatMessages.length === 0 && <div className="chat-msg system">Say hello or log a meal…</div>}
        {chatMessages.map(msg => (
          <div key={msg.id || Math.random()} className={`chat-msg ${msg.role}`}>{msg.content}</div>
        ))}
        {loading && <div className="chat-typing">Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Message…" rows={1} disabled={loading} />
        <div className="chat-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={loading}>📷</button>
          <button className="btn btn-primary btn-sm" onClick={() => sendMessage(input.trim())} disabled={loading || !input.trim()}>↑</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
    </>
  );
}
