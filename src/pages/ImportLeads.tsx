import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LEAD_FIELDS = [
  { key: 'child_name',      label: 'Nombre del niño/a',    required: true },
  { key: 'parent_name',     label: 'Nombre del padre/madre', required: true },
  { key: 'phone',           label: 'Teléfono',             required: true },
  { key: 'email',           label: 'Email',                required: false },
  { key: 'age',             label: 'Edad',                 required: false },
  { key: 'city',            label: 'Ciudad',               required: false },
  { key: 'course_interest', label: 'Curso de interés',     required: false },
];

type Mapping = Record<string, string>; // leadField -> csvColumn
type ParsedRow = Record<string, string>;
type RowResult = { row: ParsedRow; mapped: Record<string, string>; isExStudent: boolean; duplicate: boolean };

function normalizePhone(raw: string): string {
  let p = raw.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.length === 10 && p.startsWith('3')) p = '57' + p;
  return p;
}

export default function ImportLeads() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [results, setResults] = useState<RowResult[]>([]);
  const [importSummary, setImportSummary] = useState<{ inserted: number; skipped: number } | null>(null);

  // Fetch existing student phones and lead phones for duplicate detection
  const { data: existingPhones = { students: new Set<string>(), leads: new Set<string>() } } = useQuery({
    queryKey: ['existing_phones'],
    queryFn: async () => {
      const [{ data: students }, { data: leads }] = await Promise.all([
        supabase.from('students').select('phone'),
        supabase.from('leads').select('phone'),
      ]);
      return {
        students: new Set((students || []).map((s: any) => normalizePhone(s.phone))),
        leads: new Set((leads || []).map((l: any) => normalizePhone(l.phone))),
      };
    },
    enabled: step === 'preview',
  });

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? [];
        setCsvColumns(cols);
        setRows(result.data as ParsedRow[]);
        // Auto-map columns with similar names
        const autoMap: Mapping = {};
        for (const field of LEAD_FIELDS) {
          const match = cols.find((c) =>
            c.toLowerCase().includes(field.key.toLowerCase()) ||
            c.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
          );
          if (match) autoMap[field.key] = match;
        }
        setMapping(autoMap);
        setStep('map');
      },
      error: () => toast.error('Error leyendo el archivo CSV'),
    });
  };

  const buildPreview = () => {
    const preview: RowResult[] = rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const field of LEAD_FIELDS) {
        const col = mapping[field.key];
        if (col) mapped[field.key] = (row[col] ?? '').trim();
      }
      const phone = normalizePhone(mapped.phone ?? '');
      return {
        row,
        mapped,
        isExStudent: existingPhones.students.has(phone),
        duplicate: existingPhones.leads.has(phone),
      };
    });
    setResults(preview);
    setStep('preview');
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const toInsert = results.filter((r) => !r.duplicate && r.mapped.phone);
      let inserted = 0;
      let skipped = 0;

      for (const r of toInsert) {
        const phone = normalizePhone(r.mapped.phone);
        const { data: lead, error } = await supabase.from('leads').insert({
          child_name:      r.mapped.child_name || 'Sin nombre',
          parent_name:     r.mapped.parent_name || 'Sin nombre',
          phone,
          email:           r.mapped.email || null,
          age:             r.mapped.age || null,
          city:            r.mapped.city || null,
          course_interest: r.mapped.course_interest || null,
          source:          'reactivation' as any,
          status:          'new' as any,
        }).select('id').single();

        if (error) { skipped++; continue; }

        if (r.isExStudent && lead) {
          await supabase.from('lead_notes').insert({
            lead_id: lead.id,
            content: 'Ex-alumno/a — importado desde base de datos de clientes anteriores',
          });
        }
        inserted++;
      }

      return { inserted, skipped: skipped + results.filter((r) => r.duplicate).length };
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setStep('done');
      toast.success(`${summary.inserted} leads importados correctamente`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requiredMapped = LEAD_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);
  const validRows = results.filter((r) => !r.duplicate && r.mapped.phone).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-2 mb-6">
        <ArrowLeft size={16} />
        Volver a Leads
      </Button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Upload className="text-primary-foreground" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Importar leads desde CSV</h1>
          <p className="text-muted-foreground text-sm">Sube un archivo exportado desde Excel o cualquier hoja de cálculo</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {(['upload', 'map', 'preview', 'done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-primary text-primary-foreground' :
              (['upload', 'map', 'preview', 'done'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-muted text-muted-foreground'
            }`}>{i + 1}</div>
            <span className={step === s ? 'font-medium' : 'text-muted-foreground'}>
              {s === 'upload' ? 'Subir archivo' : s === 'map' ? 'Mapear columnas' : s === 'preview' ? 'Revisar' : 'Listo'}
            </span>
            {i < 3 && <span className="text-muted-foreground mx-1">→</span>}
          </div>
        ))}
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <Card
          className="p-12 border-2 border-dashed text-center cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <FileText size={40} className="mx-auto mb-4 text-muted-foreground" />
          <p className="font-medium mb-1">Arrastra tu archivo CSV aquí</p>
          <p className="text-sm text-muted-foreground mb-4">o haz clic para seleccionarlo</p>
          <p className="text-xs text-muted-foreground">Exporta tu Excel como CSV (UTF-8) antes de subir</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </Card>
      )}

      {/* STEP 2: Map columns */}
      {step === 'map' && (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Se encontraron <strong>{rows.length} filas</strong> y <strong>{csvColumns.length} columnas</strong>. Indica qué columna del CSV corresponde a cada campo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {LEAD_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="text-sm font-medium mb-1 block">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Select
                    value={mapping[field.key] ?? '__none__'}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field.key]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— No importar —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No importar —</SelectItem>
                      {csvColumns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep('upload')}>Atrás</Button>
            <Button onClick={buildPreview} disabled={!requiredMapped}>
              Previsualizar →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{validRows}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Se importarán</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-500">
                {results.filter((r) => r.isExStudent && !r.duplicate).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Ex-alumnos detectados</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {results.filter((r) => r.duplicate).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Ya existen (se omiten)</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Estado</th>
                    <th className="text-left px-3 py-2 font-medium">Niño/a</th>
                    <th className="text-left px-3 py-2 font-medium">Padre/madre</th>
                    <th className="text-left px-3 py-2 font-medium">Teléfono</th>
                    {mapping.city && <th className="text-left px-3 py-2 font-medium">Ciudad</th>}
                    {mapping.course_interest && <th className="text-left px-3 py-2 font-medium">Curso</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={`border-t ${r.duplicate ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2">
                        {r.duplicate ? (
                          <Badge variant="outline" className="text-xs">Duplicado</Badge>
                        ) : r.isExStudent ? (
                          <Badge variant="warning" className="text-xs">Ex-alumno</Badge>
                        ) : (
                          <Badge variant="success" className="text-xs">Nuevo</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{r.mapped.child_name || '—'}</td>
                      <td className="px-3 py-2">{r.mapped.parent_name || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{normalizePhone(r.mapped.phone || '')}</td>
                      {mapping.city && <td className="px-3 py-2">{r.mapped.city || '—'}</td>}
                      {mapping.course_interest && <td className="px-3 py-2">{r.mapped.course_interest || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {results.filter((r) => r.isExStudent && !r.duplicate).length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>Los ex-alumnos detectados se importarán con una nota automática indicando que son clientes anteriores.</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep('map')}>Atrás</Button>
            <Button onClick={() => importMutation.mutate()} disabled={validRows === 0 || importMutation.isPending}>
              {importMutation.isPending ? 'Importando...' : `Importar ${validRows} leads`}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Done */}
      {step === 'done' && importSummary && (
        <Card className="p-12 text-center">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-bold mb-2">¡Importación completada!</h2>
          <p className="text-muted-foreground mb-6">
            <strong>{importSummary.inserted}</strong> leads importados correctamente.
            {importSummary.skipped > 0 && ` ${importSummary.skipped} omitidos por duplicado o error.`}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { setStep('upload'); setResults([]); setRows([]); }}>
              Importar otro archivo
            </Button>
            <Button onClick={() => navigate('/leads')}>
              Ver leads →
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
