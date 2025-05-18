import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Minimize2, Maximize2, Edit, Trash2, Paperclip } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ChatService, ChatMessage } from "@/services/ChatService";

export function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const chatService = ChatService.getInstance();

  useEffect(() => {
    // Subscribe to messages
    const unsubscribe = chatService.subscribeToMessages((updatedMessages) => {
      setMessages(updatedMessages);
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive, but only if not editing
    if (scrollRef.current && !editingMessageId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, editingMessageId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);

    try {
      console.log('Uploading file:', file.name);
      const fileDetails = await chatService.uploadFile(file, user.id);

      console.log('File uploaded, sending message with details:', fileDetails);
      await chatService.sendMessage(
        newMessage.trim() === '' ? undefined : newMessage.trim(),
        user.name || 'Anonymous',
        user.id,
        fileDetails.url,
        fileDetails.name,
        fileDetails.type
      );

      setNewMessage('');
      console.log('Message with attachment sent.');

    } catch (error) {
      console.error('Error uploading file or sending message:', error);
      // You might want to show an error toast here
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleAttachmentClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || isUploading) return;

    try {
      await chatService.sendMessage(
        newMessage.trim(),
        user.name || 'Anonymous',
        user.id
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      // You might want to show an error toast here
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isUploading) {
        if (editingMessageId) {
          handleSaveEdit();
        } else {
          if (newMessage.trim()) {
            handleSendMessage();
          }
        }
      }
    }
  };

  const handleEditClick = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingMessageText(message.text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingMessageText.trim()) {
        console.log("Save edit aborted: No message selected or text is empty.");
        return;
    }

    try {
      console.log(`Attempting to update message ${editingMessageId} with text: ${editingMessageText}`);
      await chatService.updateMessage(editingMessageId, editingMessageText);
      console.log("Message updated successfully.");
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving edit:', error);
      // You might want to show an error toast here to the user
    }
  };

  const handleDeleteClick = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      console.log(`Attempting to delete message with ID: ${messageId}`);
      await chatService.deleteMessage(messageId);
      console.log(`Message ${messageId} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting message:', error);
      // You might want to show an error toast to the user here
    }
  };

  return (
    <Card className={`w-80 shadow-lg transition-all duration-300 ${isMinimized ? 'h-12 bg-blue-500' : 'h-96'}`}>
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMinimized ? 'py-2' : 'pb-2'} px-4`}>
        <CardTitle className="text-base font-semibold truncate">Team Chat</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMinimized(!isMinimized)}
          className="flex-shrink-0 w-8 h-8"
        >
          {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {!isMinimized && (
        <CardContent className="flex flex-col h-[calc(100%-3rem)] p-4">
          <ScrollArea ref={scrollRef} className="flex-1 pr-4">
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center text-sm text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">No messages yet. Start the conversation!</div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    {editingMessageId === message.id ? (
                      <div className="flex flex-col w-full">
                        <Input
                          value={editingMessageText}
                          onChange={(e) => setEditingMessageText(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="mb-2"
                          autoFocus
                        />
                        <div className="flex justify-end space-x-2 text-xs">
                          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                          <Button variant="default" size="sm" onClick={handleSaveEdit} disabled={!editingMessageText.trim()}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`flex flex-col max-w-[80%] group relative ${
                          message.senderId === user?.id
                            ? 'bg-primary text-primary-foreground rounded-lg rounded-br-none'
                            : 'bg-muted rounded-lg rounded-tl-none'
                        } px-3 py-2 text-sm`}
                      >
                        <div className={`text-xs opacity-80 mb-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                          {message.sender}
                        </div>
                        <p className="break-words">{message.text}</p>
                        <div className={`text-xs opacity-60 mt-1 ${message.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                          {message.timestamp?.toDate().toLocaleTimeString()}
                        </div>
                        {message.senderId === user?.id && (
                          <div className={`absolute ${message.senderId === user?.id ? '-left-12' : '-right-12'} top-1/2 transform -translate-y-1/2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity items-center`}>
                            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleEditClick(message)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500 hover:text-red-700" onClick={() => handleDeleteClick(message.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center space-x-2 mt-auto pt-3 border-t">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAttachmentClick}
              className="flex-shrink-0"
              disabled={isUploading}
            >
              {isUploading ? (
                <span className="loading-spinner"></span>
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isUploading ? "Uploading..." : "Type a message..."}
              className="flex-grow"
              disabled={isUploading}
            />
            <Button type="submit" onClick={handleSendMessage} size="icon" disabled={!newMessage.trim() || isUploading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
} 