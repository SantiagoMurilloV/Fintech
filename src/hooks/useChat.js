/**
 * Chat state shared by the full agent view and the floating dock.
 *
 * Both surfaces talk to the same conversation, so a question asked from the
 * dock while browsing Órdenes is the same thread you find in Agente.
 */
import { useCallback, useState } from '../core/runtime.js';
import { api } from '../core/api.js';

export function useChat({ onConversationChanged, onDataChanged } = {}) {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  const reset = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setAttachments([]);
    setUploadError('');
  }, []);

  /** Load an existing conversation into the thread. */
  const open = useCallback(async (id) => {
    const conversation = await api.getConversation(id);
    setConversationId(conversation.id);
    setMessages(conversation.messages);
  }, []);

  const attach = useCallback(async (file) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await api.uploadAttachment(file);
      setAttachments((current) => [...current, uploaded]);
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments((current) => current.filter((file) => file.id !== id));
  }, []);

  /**
   * Send a message. `context` tells the backend which screen the user is on
   * so questions like "¿y esto?" resolve against what they are looking at.
   */
  const send = useCallback(async (text, context) => {
    const content = (text ?? '').trim();
    if ((!content && attachments.length === 0) || pending) return;

    const sent = attachments;
    const outgoing = [...messages, {
      role: 'user',
      content: content || 'Lee el archivo adjunto.',
      attachments: sent,
    }];
    setMessages(outgoing);
    setAttachments([]);
    setPending(true);

    try {
      const response = await api.sendMessage(
        conversationId, content, sent.map((file) => file.id), context);
      setMessages([...outgoing, {
        role: 'agent',
        content: response.reply,
        blocks: response.blocks,
      }]);
      // The backend opens a new conversation when the id is missing or stale.
      if (response.conversation_id !== conversationId) {
        setConversationId(response.conversation_id);
        onConversationChanged?.();
      }
      // A tool wrote to the database: refresh the open views right away.
      if (response.mutated) onDataChanged?.();
    } catch (error) {
      setMessages([...outgoing, { role: 'agent', content: `No pude responder: ${error.message}` }]);
    } finally {
      setPending(false);
    }
  }, [attachments, messages, pending, conversationId, onConversationChanged, onDataChanged]);

  return {
    conversationId, messages, pending, attachments, uploading, uploadError,
    send, attach, removeAttachment, reset, open, setConversationId,
  };
}
