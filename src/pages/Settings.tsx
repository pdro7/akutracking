import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Save } from 'lucide-react';
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
      return data || { default_pack_size: 8, class_day: 'Saturday' };
    }
  });

  const [packSize, setPackSize] = useState(settings?.default_pack_size || 8);
  const [classDay, setClassDay] = useState(settings?.class_day || 'Saturday');

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
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({
            default_pack_size: packSize,
            class_day: classDay,
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
              <Input
                id="classDay"
                type="text"
                value={classDay}
                onChange={(e) => setClassDay(e.target.value)}
                className="max-w-xs"
              />
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
