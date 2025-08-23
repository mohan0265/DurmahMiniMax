import React, { useState } from 'react';
import { useChat } from '../hooks/useChat';

const Chat = () => {
  const { messages, sendMessage, isTyping } = useChat();
  const [text, setText] = useState('');

  const onSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await sendMessage(text.trim());
    setText('');
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">Chat</h1>
      <div className="border rounded p-3 h-80 overflow-auto mb-3">
        {messages.map(m => (
          <div key={m.id} className={`mb-2 ${m.sender === 'user' ? 'text-right' : 'text-left'}`}>
            <span className="inline-block px-3 py-2 rounded bg-gray-100">
              {m.text}
            </span>
          </div>
        ))}
        {isTyping && <div className="italic opacity-70">Durmah is typing…</div>}
      </div>
      <form onSubmit={onSend} className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
        />
        <button className="px-4 py-2 rounded bg-black text-white">Send</button>
      </form>
    </div>
  );
};

export default Chat;
