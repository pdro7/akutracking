import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gift, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { REFERRAL_CREDIT_COP_DEFAULT, isReferralConverted, formatCop, referralUrl } from '@/lib/referral';

type Row = {
  student_id: string;
  student_name: string;
  code: string;
  total: number;
  converted: number;
  credit_earned: number;
  credit_applied: number;
  balance: number;
};

export default function Referrals() {
  const navigate = useNavigate();

  const { data: creditCop = REFERRAL_CREDIT_COP_DEFAULT } = useQuery({
    queryKey: ['settings_referral_credit_cop'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('referral_credit_cop').maybeSingle();
      return (data?.referral_credit_cop as number) ?? REFERRAL_CREDIT_COP_DEFAULT;
    },
  });

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['referrals_all', creditCop],
    queryFn: async () => {
      const { data: codes, error: codesErr } = await supabase
        .from('referral_codes')
        .select('code, student_id, students!inner(id, name, archived)');
      if (codesErr) throw codesErr;
      const active = (codes ?? []).filter((c: any) => !c.students?.archived);
      if (active.length === 0) return [];

      const studentIds = active.map((c: any) => c.student_id);
      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, status, referred_by_student_id, referral_credit_applied_at')
        .in('referred_by_student_id', studentIds);
      if (leadsErr) throw leadsErr;

      const byStudent = new Map<string, { total: number; converted: number; applied: number }>();
      for (const l of leads ?? []) {
        const sid = (l as any).referred_by_student_id as string;
        const stats = byStudent.get(sid) ?? { total: 0, converted: 0, applied: 0 };
        stats.total += 1;
        if (isReferralConverted((l as any).status)) {
          stats.converted += 1;
          if ((l as any).referral_credit_applied_at) stats.applied += 1;
        }
        byStudent.set(sid, stats);
      }

      return active.map((c: any) => {
        const stats = byStudent.get(c.student_id) ?? { total: 0, converted: 0, applied: 0 };
        const credit_earned = stats.converted * creditCop;
        const credit_applied = stats.applied * creditCop;
        return {
          student_id: c.student_id,
          student_name: c.students?.name ?? '—',
          code: c.code,
          total: stats.total,
          converted: stats.converted,
          credit_earned,
          credit_applied,
          balance: credit_earned - credit_applied,
        } as Row;
      });
    },
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.balance - a.balance || b.converted - a.converted || a.student_name.localeCompare(b.student_name)),
    [rows],
  );

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, r) => ({
        parents: acc.parents + 1,
        total: acc.total + r.total,
        converted: acc.converted + r.converted,
        balance: acc.balance + r.balance,
      }),
      { parents: 0, total: 0, converted: 0, balance: 0 },
    );
  }, [sorted]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(referralUrl(code));
      toast.success('Link copiado');
    } catch { toast.error('No se pudo copiar'); }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift size={22} />
            Programa de referidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Padres que han compartido su link. Crédito por referido convertido: <span className="font-medium">{formatCop(creditCop)}</span>.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary">{totals.parents} padres con código</Badge>
          <Badge variant="secondary">{totals.total} leads referidos</Badge>
          <Badge variant="success">{totals.converted} inscritos</Badge>
          <Badge variant="info">{formatCop(totals.balance)} crédito pendiente</Badge>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Cargando…</Card>
      ) : sorted.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Aún no hay padres con código de referido generado. Genera uno desde la ficha de un alumno.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padre / alumno</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Referidos</TableHead>
                <TableHead className="text-right">Inscritos</TableHead>
                <TableHead className="text-right">Crédito ganado</TableHead>
                <TableHead className="text-right">Aplicado</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => navigate(`/student/${r.student_id}`)}
                    >
                      {r.student_name}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right">{r.converted}</TableCell>
                  <TableCell className="text-right">{formatCop(r.credit_earned)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCop(r.credit_applied)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {r.balance > 0 ? <span className="text-green-700">{formatCop(r.balance)}</span> : formatCop(r.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" title="Copiar link" onClick={() => copy(r.code)}>
                      <Copy size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
