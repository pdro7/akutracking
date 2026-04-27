import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type ConvStatus = 'active' | 'waiting' | 'escalated' | 'closed';

const COLUMNS: { status: ConvStatus; label: string; color: string }[] = [
  { status: 'active',    label: 'Activa',              color: 'bg-blue-50 border-blue-200' },
  { status: 'waiting',   label: 'Esperando respuesta', color: 'bg-yellow-50 border-yellow-200' },
  { status: 'escalated', label: 'Escalada',            color: 'bg-orange-50 border-orange-200' },
  { status: 'closed',    label: 'Cerrada',             color: 'bg-gray-50 border-gray-200' },
];

function lastMessage(messages: any[]): string {
  if (!messages?.length) return '—';
  const last = messages[messages.length - 1];
  if (!last?.content || last.content === '[Imagen]') return '📷 Imagen';
  return last.content.length > 80 ? last.content.slice(0, 80) + '…' : last.content;
}

function lastRole(messages: any[]): 'user' | 'assistant' | null {
  if (!messages?.length) return null;
  return messages[messages.length - 1]?.role ?? null;
}

export default function Conversations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['whatsapp_conversations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_conversations')
        .select('id, phone, messages, status, escalated, lead_id, updated_at, leads(child_name, parent_name)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        phone: string;
        messages: any[];
        status: ConvStatus;
        escalated: boolean;
        lead_id: string | null;
        updated_at: string;
        leads: { child_name: string; parent_name: string } | null;
      }>;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ConvStatus }) => {
      const { error } = await (supabase as any)
        .from('whatsapp_conversations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp_conversations'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = COLUMNS.reduce<Record<ConvStatus, typeof conversations>>((acc, col) => {
    acc[col.status] = conversations.filter((c) => c.status === col.status);
    return acc;
  }, { active: [], waiting: [], escalated: [], closed: [] });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
          <MessageCircle className="text-primary-foreground" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Pablo · Conversaciones</h1>
          <p className="text-muted-foreground">Conversaciones de WhatsApp gestionadas por el asistente</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Cargando...</div>
      ) : conversations.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No hay conversaciones aún</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div
              key={col.status}
              className="flex-shrink-0 w-72"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const convId = e.dataTransfer.getData('convId');
                if (convId) updateStatusMutation.mutate({ id: convId, status: col.status });
              }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {grouped[col.status].length}
                </span>
              </div>

              <div className={`min-h-24 rounded-xl border-2 p-2 space-y-2 ${col.color}`}>
                {grouped[col.status].map((conv) => {
                  const msgs = Array.isArray(conv.messages) ? conv.messages : [];
                  const role = lastRole(msgs);
                  const name = conv.leads?.child_name
                    ? `${conv.leads.child_name} (${conv.leads.parent_name})`
                    : conv.phone;

                  return (
                    <div
                      key={conv.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('convId', conv.id)}
                      onClick={() => conv.lead_id ? navigate(`/leads/${conv.lead_id}`) : undefined}
                      className={`bg-card border rounded-lg p-3 select-none transition-shadow hover:shadow-md ${
                        conv.lead_id ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">{name}</p>
                        {conv.escalated && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">Escalada</Badge>
                        )}
                      </div>

                      {conv.leads && (
                        <p className="text-xs text-muted-foreground mt-0.5">{conv.phone}</p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {role === 'assistant' && <span className="text-primary/70 font-medium">Pablo: </span>}
                        {lastMessage(msgs)}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {msgs.length} mensaje{msgs.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: es })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
