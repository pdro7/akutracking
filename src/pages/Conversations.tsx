import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type Message = { role: 'user' | 'assistant'; content: string; image_url?: string };

type Conversation = {
  id: string;
  phone: string;
  messages: Message[];
  escalated: boolean;
  lead_id: string | null;
  updated_at: string;
  leads: { child_name: string; parent_name: string } | null;
};

function lastMessagePreview(messages: Message[]): string {
  if (!messages?.length) return '—';
  const last = messages[messages.length - 1];
  if (!last?.content || last.content === '[Imagen]') return '📷 Imagen';
  return last.content.length > 50 ? last.content.slice(0, 50) + '…' : last.content;
}

export default function Conversations() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['whatsapp_conversations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_conversations')
        .select('id, phone, messages, escalated, lead_id, updated_at, leads(child_name, parent_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Conversation[];
    },
  });

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      {/* Left sidebar — conversation list */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-base">Pablo · Conversaciones</h2>
          <p className="text-xs text-muted-foreground">{conversations.length} conversaciones</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Sin conversaciones aún</div>
          ) : (
            conversations.map((conv) => {
              const name = conv.leads?.child_name
                ? `${conv.leads.child_name}`
                : conv.phone;
              const sub = conv.leads?.child_name ? conv.phone : null;
              const isActive = conv.id === selectedId;
              const msgs = Array.isArray(conv.messages) ? conv.messages : [];
              const lastRole = msgs.length ? msgs[msgs.length - 1].role : null;

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b hover:bg-accent/50 transition-colors flex gap-3 items-start ${
                    isActive ? 'bg-accent' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-700 font-semibold text-sm">
                    {name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium text-sm truncate">{name}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: false, locale: es })}
                      </span>
                    </div>
                    {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastRole === 'assistant' && <span className="text-primary/70">Pablo: </span>}
                      {lastMessagePreview(msgs)}
                    </p>
                    {conv.escalated && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mt-1">Escalada</Badge>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — chat view */}
      <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-background">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl">💬</div>
            <p className="font-medium">Selecciona una conversación</p>
            <p className="text-sm">Elige un chat de la lista para ver los mensajes</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-card border-b px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
                {(selected.leads?.child_name ?? selected.phone).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm leading-tight">
                  {selected.leads?.child_name ?? selected.phone}
                </p>
                {selected.leads && (
                  <p className="text-xs text-muted-foreground">{selected.phone}</p>
                )}
              </div>
              {selected.lead_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate(`/leads/${selected.lead_id}`)}
                >
                  <ExternalLink size={13} />
                  Ver lead
                </Button>
              )}
              {selected.escalated && (
                <Badge variant="destructive" className="text-xs">Escalada</Badge>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
              {(Array.isArray(selected.messages) ? selected.messages : []).map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      msg.role === 'assistant'
                        ? 'bg-[#d9fdd3] dark:bg-primary text-foreground rounded-br-none'
                        : 'bg-card text-foreground rounded-bl-none'
                    }`}
                  >
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="imagen"
                        className="max-w-full rounded-lg mb-1 max-h-60 object-contain"
                      />
                    )}
                    {msg.content && msg.content !== '[Imagen]' && (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="bg-card border-t px-4 py-2 text-center text-xs text-muted-foreground">
              Las respuestas las envía Pablo automáticamente por WhatsApp
            </div>
          </>
        )}
      </div>
    </div>
  );
}
