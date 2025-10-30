import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle();
      
      if (error) throw error;
      return data || { default_pack_size: 8, class_day: 'Saturday', payment_methods: ['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi'] };
    }
  });

  const [packSize, setPackSize] = useState(settings?.default_pack_size || 8);
  const [classDay, setClassDay] = useState(settings?.class_day || 'Saturday');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(settings?.payment_methods || ['Cash', 'Bancololombia', 'Davivienda', 'Wompi', 'Nequi']);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({
            default_pack_size: packSize,
            class_day: classDay,
            payment_methods: paymentMethods,
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({
            default_pack_size: packSize,
            class_day: classDay,
            payment_methods: paymentMethods,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleSave = () => {
    updateSettingsMutation.mutate();
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure academy preferences and defaults</p>
      </div>

      <div className="max-w-2xl">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <SettingsIcon className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">General Settings</h2>
              <p className="text-sm text-muted-foreground">Academy-wide configuration</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <Label htmlFor="packSize" className="text-base mb-2 block">
                Default Pack Size
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Number of classes included in a standard tuition pack
              </p>
              <Input
                id="packSize"
                type="number"
                min="1"
                value={packSize}
                onChange={(e) => setPackSize(Number(e.target.value))}
                className="max-w-xs"
              />
            </div>

            <div>
              <Label htmlFor="classDay" className="text-base mb-2 block">
                Class Day
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Day of the week when classes typically occur
              </p>
              <Select value={classDay} onValueChange={setClassDay}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monday">Monday</SelectItem>
                  <SelectItem value="Tuesday">Tuesday</SelectItem>
                  <SelectItem value="Wednesday">Wednesday</SelectItem>
                  <SelectItem value="Thursday">Thursday</SelectItem>
                  <SelectItem value="Friday">Friday</SelectItem>
                  <SelectItem value="Saturday">Saturday</SelectItem>
                  <SelectItem value="Sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base mb-2 block">
                Payment Methods
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Manage available payment methods for student payments
              </p>
              <div className="space-y-2">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={method} readOnly className="max-w-xs" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== index))}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="New payment method"
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                    className="max-w-xs"
                    maxLength={100}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPaymentMethod.trim()) {
                        if (newPaymentMethod.trim().length > 100) {
                          toast.error('Payment method name must be less than 100 characters');
                          return;
                        }
                        setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                        setNewPaymentMethod('');
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (newPaymentMethod.trim()) {
                        if (newPaymentMethod.trim().length > 100) {
                          toast.error('Payment method name must be less than 100 characters');
                          return;
                        }
                        setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                        setNewPaymentMethod('');
                      }
                    }}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={handleSave} className="gap-2">
                <Save size={20} />
                Save Settings
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-2">About</h3>
          <p className="text-sm text-muted-foreground">
            RoboAcademy Attendance Tracker v1.0
          </p>
        </Card>
      </div>
    </div>
  );
}
