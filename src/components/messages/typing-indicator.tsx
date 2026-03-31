interface TypingIndicatorProps {
  typingUsers: { userId: string; userName: string }[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].userName} is typing`
      : typingUsers.length === 2
        ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`
        : `${typingUsers.length} people are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
      </span>
      <span>{text}</span>
    </div>
  );
}
