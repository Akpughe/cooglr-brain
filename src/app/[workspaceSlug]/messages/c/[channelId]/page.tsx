"use client";

import { useParams } from "next/navigation";
import { useWorkspace, useCurrentUserId } from "@/lib/workspace/context";
import { useMessages } from "@/hooks/use-messages";
import { useTyping } from "@/hooks/use-typing";
import { MessageList } from "@/components/messages/message-list";
import { MessageComposer } from "@/components/messages/message-composer";
import { useEffect, useState } from "react";
import { Hash } from "lucide-react";

export default function ChannelPage() {
  const params = useParams<{ channelId: string }>();
  const channelId = params.channelId;
  const { workspace, members } = useWorkspace();
  const currentUserId = useCurrentUserId();

  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");

  const { messages, loading, hasMore, loadMore, sendMessage, editMessage, deleteMessage } =
    useMessages({ targetId: channelId, type: "channel", workspaceId: workspace.id });

  const currentMember = members.find((m) => m.userId === currentUserId);
  const { typingUsers, sendTypingEvent } = useTyping(channelId, currentUserId);

  useEffect(() => {
    fetch(`/api/messages/channels?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => {
        const ch = (data.channels || []).find((c: any) => c.id === channelId);
        if (ch) { setChannelName(ch.name); setChannelDescription(ch.description || ""); }
      });
  }, [channelId, workspace.id]);

  useEffect(() => {
    if (messages.length > 0) {
      fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, lastReadAt: new Date().toISOString() }),
      });
    }
  }, [channelId, messages.length]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
        <Hash className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">{channelName}</span>
        {channelDescription && <span className="text-xs text-muted-foreground ml-2">{channelDescription}</span>}
      </div>
      <MessageList messages={messages} loading={loading} hasMore={hasMore} onLoadMore={loadMore} onEdit={editMessage} onDelete={deleteMessage} typingUsers={typingUsers} />
      <MessageComposer
        placeholder={`Message #${channelName}`}
        workspaceId={workspace.id}
        targetId={channelId}
        onSend={sendMessage}
        onTyping={() => sendTypingEvent(currentMember?.fullName || "Someone")}
      />
    </div>
  );
}
