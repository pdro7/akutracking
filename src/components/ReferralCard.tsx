import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gift, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { generateReferralCode, referralUrl, REFERRAL_CREDIT_COP_DEFAULT, isReferralConverted, formatCop } from '@/lib/referral';

type Props = {
  studentId: string;
  studentName: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' }> = {
  new: { label: 'Nuevo', variant: 'secondary' },
  contacted: { label: 'Contactado', variant: 'default' },
  interested: { label: 'Interesado', variant: 'info' },
  trial_scheduled: { label: 'Trial agendada', variant: 'warning' },
  trial_attended: { label: 'Trial asistió', variant: 'warning' },
  trial_no_show: { label: 'No asistió', variant: 'destructive' },
  trial_cancelled: { label: 'Trial cancelada', variant: 'outline' },
  enrolled: { label: 'Inscrito ✓', variant: 'success' },
  lost: { label: 'Perdido', variant: 'destructive' },
};

export function ReferralCard({ studentId, studentName }: Props) {
  const queryClient = useQueryClient();

  const { data: creditCop = REFERRAL_CREDIT_COP_DEFAULT } = useQuery({
    queryKey: ['settings_referral_credit_cop'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('referral_credit_cop').maybeSingle();
      return (data?.referral_credit_cop as number) ?? REFERRAL_CREDIT_COP_DEFAULT;
    },
  });

  const { data: referral } = useQuery({
    queryKey: ['referral_code', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('referral_codes')
        .select('id, code, is_active, created_at')
        .eq('student_id', studentId)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: referredLeads = [] } = useQuery({
    queryKey: ['referred_leads', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, child_name, parent_name, status, created_at, referral_credit_applied_at')
        .eq('referred_by_student_id', studentId)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateReferralCode();
        const { data, error } = await supabase
          .from('referral_codes')
          .insert({ code, student_id: studentId })
          .select('id, code, is_active, created_at')
          .maybeSingle();
        if (!error && data) return data;
        // 23505 unique violation → retry with a fresh code
        if (error && (error as any).code !== '23505') throw error;
      }
      throw new Error('No se pudo generar un código único, inténtalo de nuevo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral_code', studentId] });
      toast.success('Código de referido creado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCreditMutation = useMutation({
    mutationFn: async ({ leadId, currentlyApplied }: { leadId: string; currentlyApplied: boolean }) => {
      const { error } = await supabase
        .from('leads')
        .update({ referral_credit_applied_at: currentlyApplied ? null : new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referred_leads', studentId] });
      queryClient.invalidateQueries({ queryKey: ['referrals_all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const total = referredLeads.length;
    const converted = referredLeads.filter((l: any) => isReferralConverted(l.status)).length;
    const applied = referredLeads.filter((l: any) => isReferralConverted(l.status) && l.referral_credit_applied_at).length;
    const earned = converted * creditCop;
    const appliedCop = applied * creditCop;
    return { total, converted, earned, appliedCop, balance: earned - appliedCop };
  }, [referredLeads, creditCop]);

  const copyLink = async () => {
    if (!referral?.code) return;
    try {
      await navigator.clipboard.writeText(referralUrl(referral.code));
      toast.success('Link copiado al portapapeles');
    } catch { toast.error('No se pudo copiar'); }
  };

  const shareWhatsApp = () => {
    if (!referral?.code) return;
    const msg = `¡Hola! Te comparto AKUMAYA Educación — les enseñan a los peques programación, IA y robótica. Si te animas a probar, usa mi link: ${referralUrl(referral.code)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Gift size={16} className="text-primary" />
            Referidos
          </h2>
          <p className="text-xs text-muted-foreground">Link único para que {studentName} recomiende AKU. Crédito: {formatCop(creditCop)} por inscripción.</p>
        </div>
        {!referral && (
          <Button
            size="sm"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? 'Generando…' : 'Generar código'}
          </Button>
        )}
      </div>

      {referral && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-md bg-muted/40">
            <span className="text-xs text-muted-foreground">Código:</span>
            <span className="font-mono font-semibold text-sm">{referral.code}</span>
            <span className="text-xs text-muted-foreground ml-2 truncate max-w-[220px]" title={referralUrl(referral.code)}>
              {referralUrl(referral.code)}
            </span>
            <div className="ml-auto flex gap-1">
              <Button variant="outline" size="sm" className="gap-1" onClick={copyLink}>
                <Copy size={12} /> Copiar
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={shareWhatsApp}>
                <ExternalLink size={12} /> WhatsApp
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mb-4">
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Referidos</div>
              <div className="text-lg font-semibold">{stats.total}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Inscritos</div>
              <div className="text-lg font-semibold text-green-700">{stats.converted}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Crédito ganado</div>
              <div className="text-sm font-semibold">{formatCop(stats.earned)}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className={`text-sm font-semibold ${stats.balance > 0 ? 'text-green-700' : ''}`}>{formatCop(stats.balance)}</div>
            </div>
          </div>

          {referredLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Todavía no hay leads que hayan llegado con este link.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Niño</TableHead>
                  <TableHead>Padre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referredLeads.map((l: any) => {
                  const cfg = STATUS_LABEL[l.status] ?? { label: l.status, variant: 'secondary' as const };
                  const eligible = isReferralConverted(l.status);
                  const applied = !!l.referral_credit_applied_at;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{l.child_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.parent_name}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!eligible ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : applied ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => toggleCreditMutation.mutate({ leadId: l.id, currentlyApplied: true })}
                          >
                            Aplicado ✓ (deshacer)
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleCreditMutation.mutate({ leadId: l.id, currentlyApplied: false })}
                          >
                            Marcar aplicado
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Card>
  );
}
