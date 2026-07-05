import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import {
  BUCKET_LABEL,
  SLOTS_BY_BUCKET,
  type SlotBucket,
} from '@/lib/timeSlots';

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
};

const BUCKETS: SlotBucket[] = ['sat-am', 'sat-pm', 'wk-am', 'wk-pm'];

export function TimeSlotPicker({ value, onChange, label }: Props) {
  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}
      <div className="space-y-3">
        {BUCKETS.map((bucket) => (
          <div key={bucket}>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              {BUCKET_LABEL[bucket]}
            </div>
            <ToggleGroup
              type="multiple"
              value={value}
              onValueChange={onChange}
              variant="outline"
              size="sm"
              className="flex flex-wrap gap-1.5 justify-start"
            >
              {SLOTS_BY_BUCKET[bucket].map((slot) => (
                <ToggleGroupItem
                  key={slot.id}
                  value={slot.id}
                  className="text-xs h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {slot.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    </div>
  );
}
