import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, DollarSign } from 'lucide-react';
import { formatCOP } from '@/lib/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Navigate } from 'react-router-dom';

export default function Payments() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Check user role
  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      return data?.role;
    }
  });

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments-summary', selectedYear, selectedMonth],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('amount, payment_method, payment_date');

      // Filter by year
      const yearStart = `${selectedYear}-01-01`;
      const yearEnd = `${selectedYear}-12-31`;
      query = query.gte('payment_date', yearStart).lte('payment_date', yearEnd);

      // Filter by month if selected
      if (selectedMonth !== 'all') {
        const monthPadded = selectedMonth.padStart(2, '0');
        const monthStart = `${selectedYear}-${monthPadded}-01`;
        const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
        const monthEnd = `${selectedYear}-${monthPadded}-${lastDay}`;
        query = query.gte('payment_date', monthStart).lte('payment_date', monthEnd);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by payment method
      const grouped = data.reduce((acc: any, payment: any) => {
        const method = payment.payment_method || 'Unknown';
        if (!acc[method]) {
          acc[method] = { method, totalAmount: 0, count: 0 };
        }
        acc[method].totalAmount += Number(payment.amount);
        acc[method].count += 1;
        return acc;
      }, {});

      return Object.values(grouped);
    }
  });

  const totalAmount = (paymentsData as any[])?.reduce((sum: number, item: any) => sum + item.totalAmount, 0) || 0;
  const totalTransactions = (paymentsData as any[])?.reduce((sum: number, item: any) => sum + item.count, 0) || 0;

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 'all', label: 'All Year' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const colors = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

  // Show loading while checking role
  if (roleLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Redirect non-admin users
  if (userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Summary</h1>
        <p className="text-muted-foreground">Overview of payments by payment method</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 mb-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCOP(totalAmount)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {totalTransactions} transaction{totalTransactions !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Payments by Method</CardTitle>
          <CardDescription>Distribution of payments across different payment methods</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsData && paymentsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paymentsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="method" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{payload[0].payload.method}</p>
                          <p className="text-sm text-muted-foreground">
                            Amount: {formatCOP(payload[0].value as number)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Transactions: {payload[0].payload.count}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="totalAmount" radius={[8, 8, 0, 0]}>
                  {(paymentsData as any[]).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No payment data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paymentsData?.map((item: any, index: number) => (
          <Card key={item.method}>
            <CardHeader>
              <CardTitle className="text-lg">{item.method}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold">{formatCOP(item.totalAmount)}</p>
                  <p className="text-sm text-muted-foreground">Total amount</p>
                </div>
                <div>
                  <p className="text-xl font-semibold">{item.count}</p>
                  <p className="text-sm text-muted-foreground">Transaction{item.count !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-lg font-medium">{formatCOP(item.totalAmount / item.count)}</p>
                  <p className="text-sm text-muted-foreground">Average per transaction</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
