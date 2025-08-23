// Client/src/contexts/ChatContext.jsx
import React, { createContext, useContext, useState } from "react";

const ChatContext = createContext(null);
export const useChatContext = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);

  const value = {
    conversations,
    setConversations,
    activeConversation,
    setActiveConversation,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
