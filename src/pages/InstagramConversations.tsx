import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowLeft, Link as LinkIcon, Instagram } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  message_id?: string | null;
  attachments?: unknown;
  timestamp?: string;
};

type Conversation = {
  id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  messages: Message[];
  status: string;
  unread: boolean;
  lead_id: string | null;
  updated_at: string;
  leads: { child_name: string; parent_name: string } | null;
};

function lastMessagePreview(messages: Message[]): string {
  if (!messages?.length) return '—';
  const last = messages[messages.length - 1];
  if (!last?.content || last.content === '[Adjunto]') return '📷 Adjunto';
  return last.content.length > 50 ? last.content.slice(0, 50) + '…' : last.content;
}

function displayName(c: Conversation): string {
  if (c.leads?.child_name) return c.leads.child_name;
  if (c.instagram_username) return `@${c.instagram_username}`;
  return `IG ${c.instagram_user_id.slice(-6)}`;
}

export default function InstagramConversations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['instagram_conversations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('instagram_conversations')
        .select('id, instagram_user_id, instagram_username, messages, status, unread, lead_id, updated_at, leads(child_name, parent_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Conversation[];
    },
    refetchInterval: 15000,
  });

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('instagram_conversations')
        .update({ unread: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['instagram_conversations'] }),
  });

  const handleSelectConversation = (id: string, wasUnread: boolean) => {
    setSelectedId(id);
    setMobileView('chat');
    if (wasUnread) markReadMutation.mutate(id);
  };

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      {/* Left sidebar */}
      <div className={`flex-shrink-0 border-r flex flex-col bg-card w-full md:w-80 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Instagram size={18} className="text-pink-600" />
          <div>
            <h2 className="font-semibold text-base">Instagram · DMs</h2>
            <p className="text-xs text-muted-foreground">{conversations.length} conversaciones</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin conversaciones aún. Los DMs a @akumaya aparecerán aquí.
            </div>
          ) : (
            conversations.map((conv) => {
              const name = displayName(conv);
              const isActive = conv.id === selectedId;
              const msgs = Array.isArray(conv.messages) ? conv.messages : [];

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id, conv.unread)}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-accent/50 transition-colors flex gap-3 items-start ${
                    isActive ? 'bg-accent' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm truncate ${conv.unread ? 'font-bold' : 'font-medium'}`}>{name}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: false, locale: es })}
                      </span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${conv.unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {lastMessagePreview(msgs)}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {conv.unread && (
                        <Badge className="bg-pink-600 text-white text-[10px] px-1.5 py-0">Nuevo</Badge>
                      )}
                      {conv.lead_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Lead vinculado</Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className={`flex-1 flex-col bg-background ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white">
              <Instagram size={28} />
            </div>
            <p className="font-medium">Selecciona una conversación</p>
            <p className="text-sm">Elige un DM de la lista para ver los mensajes</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-card border-b px-3 py-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  className="md:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileView('list')}
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {displayName(selected).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{displayName(selected)}</p>
                  <p className="text-xs text-muted-foreground">ID: {selected.instagram_user_id}</p>
                </div>
              </div>
              {selected.lead_id && (
                <div className="flex flex-wrap gap-1.5 pl-10 md:pl-0">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2"
                    onClick={() => navigate(`/leads/${selected.lead_id}`)}>
                    <ExternalLink size={12} /> Ver lead
                  </Button>
                </div>
              )}
              {!selected.lead_id && (
                <div className="flex flex-wrap gap-1.5 pl-10 md:pl-0">
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7 px-2"
                    onClick={() => toast.info('Próximamente: enlazar con lead existente o crear uno nuevo')}>
                    <LinkIcon size={12} /> Enlazar con lead
                  </Button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {(Array.isArray(selected.messages) ? selected.messages : []).map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'assistant'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted rounded-bl-none'
                  }`}>
                    {msg.content && msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer note */}
            <div className="bg-card border-t px-4 py-2 text-center text-xs text-muted-foreground">
              Responde directamente desde la app de Instagram. El envío automatizado se implementará junto con Pablo.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
