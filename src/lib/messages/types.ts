export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdBy: string;
  isDefault: boolean;
  createdAt: string;
}

export interface DirectConversation {
  id: string;
  workspaceId: string;
  createdAt: string;
  otherUser: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  workspaceId: string;
  channelId: string | null;
  conversationId: string | null;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  attachments: Attachment[];
  editedAt: string | null;
  createdAt: string;
}

export interface MessageRead {
  channelId?: string;
  conversationId?: string;
  lastReadAt: string;
}
