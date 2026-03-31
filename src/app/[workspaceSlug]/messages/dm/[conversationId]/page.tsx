"use client";

import { useParams } from "next/navigation";
import { useWorkspace, useCurrentUserId } from "@/lib/workspace/context";
import { useMessages } from "@/hooks/use-messages";
import { useTyping } from "@/hooks/use-typing";
import { usePresenceContext } from "@/lib/messages/presence-context";
import { MessageList } from "@/components/messages/message-list";
import { MessageComposer } from "@/components/messages/message-composer";
import { useEffect, useState } from "react";

export default function DmPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { workspace, members } = useWorkspace();
  const currentUserId = useCurrentUserId();
  const { isOnline } = usePresenceContext();

  const [otherUser, setOtherUser] = useState<{ id: string; fullName: string; email: string; avatarUrl: string | null } | null>(null);

  const { messages, loading, hasMore, loadMore, sendMessage, editMessage, deleteMessage } =
    useMessages({ targetId: conversationId, type: "dm", workspaceId: workspace.id });

  const currentMember = members.find((m) => m.userId === currentUserId);
  const { typingUsers, sendTypingEvent } = useTyping(conversationId, currentUserId);

  useEffect(() => {
    fetch(`/api/messages/conversations?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => {
        const convo = (data.conversations || []).find((c: any) => c.id === conversationId);
        if (convo) setOtherUser(convo.otherUser);
      });
  }, [conversationId, workspace.id]);

  useEffect(() => {
    if (messages.length > 0) {
      fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, lastReadAt: new Date().toISOString() }),
      });
    }
  }, [conversationId, messages.length]);

  const otherName = otherUser?.fullName || otherUser?.email || "Loading...";
  const otherOnline = otherUser ? isOnline(otherUser.id) : false;

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <div className="relative">
          <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
            {otherName[0]?.toUpperCase() || "?"}
          </div>
          {otherOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
          )}
        </div>
        <div>
          <span className="font-semibold text-sm">{otherName}</span>
          <span className="text-xs text-muted-foreground ml-2">{otherOnline ? "Online" : "Offline"}</span>
        </div>
      </div>
      <MessageList messages={messages} loading={loading} hasMore={hasMore} onLoadMore={loadMore} onEdit={editMessage} onDelete={deleteMessage} typingUsers={typingUsers} />
      <MessageComposer
        placeholder={`Message ${otherName}`}
        workspaceId={workspace.id}
        targetId={conversationId}
        onSend={sendMessage}
        onTyping={() => sendTypingEvent(currentMember?.fullName || "Someone")}
      />
    </div>
  );
}
