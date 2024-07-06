import type { UIState } from '@/app/actions';

interface MessageProps {
  messages: UIState;
}

export function ChatList({ messages }: MessageProps) {
  if (!messages.length) return null;

  return (
    <div className="relative mx-auto max-w-2xl px-4">
      {messages.map((message, index) => (
        <div key={index} className="pb-4">
          {message.display}
        </div>
      ))}
    </div>
  );
}
