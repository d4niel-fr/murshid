import { Suspense } from 'react';
import { ChatView } from '@/components/chat/chat-view';

export const metadata = { title: 'Ask Murshid' };

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  );
}
