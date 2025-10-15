import { useState } from 'react';
import { mockSettings } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [packSize, setPackSize] = useState(mockSettings.defaultPackSize);
  const [classDay, setClassDay] = useState(mockSettings.classDay);

  const handleSave = () => {
    toast.success('Settings saved successfully!');
  };

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
