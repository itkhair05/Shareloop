import { createContext, useContext } from 'react';

export interface ChatImageLightboxRequest {
  imageUrl: string;
  caption: string | null;
  senderName: string;
  trigger: HTMLElement | null;
}

export interface ChatImageLightboxContextValue {
  openLightbox: (request: ChatImageLightboxRequest) => void;
}

export const ChatImageLightboxContext =
  createContext<ChatImageLightboxContextValue | null>(null);

export function useChatImageLightbox(): ChatImageLightboxContextValue {
  const context = useContext(ChatImageLightboxContext);

  if (!context) {
    throw new Error(
      'useChatImageLightbox must be used within a ChatImageLightboxProvider'
    );
  }

  return context;
}
