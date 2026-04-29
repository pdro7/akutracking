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

type ImportType = 'leads' | 'students';

const LEAD_FIELDS = [
  { key: 'child_name',      label: 'Nombre del niño/a',      required: true },
  { key: 'parent_name',     label: 'Nombre del padre/madre',  required: true },
  { key: 'phone',           label: 'Teléfono',                required: true },
  { key: 'email',           label: 'Email',                   required: false },
  { key: 'age',             label: 'Edad',                    required: false },
  { key: 'city',            label: 'Ciudad',                  required: false },
  { key: 'course_interest', label: 'Curso de interés',        required: false },
];

const STUDENT_FIELDS = [
  { key: 'name',            label: 'Nombre del niño/a',      required: true },
  { key: 'parent_name',     label: 'Nombre del padre/madre',  required: true },
  { key: 'phone',           label: 'Teléfono',                required: true },
  { key: 'email',           label: 'Email',                   required: false },
  { key: 'city',            label: 'Ciudad',                  required: false },
  { key: 'course_interest', label: 'Curso de interés',        required: false },
];

type Mapping = Record<string, string>;
type ParsedRow = Record<string, string>;
type RowResult = { row: ParsedRow; mapped: Record<string, string>; isDuplicate: boolean };

function normalizePhone(raw: string): string {
  let p = raw.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.length === 10 && p.startsWith('3')) p = '57' + p;
  return p;
}

export default function ImportLeads() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importType, setImportType] = useState<ImportType>('leads');
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [results, setResults] = useState<RowResult[]>([]);
  const [importSummary, setImportSummary] = useState<{ inserted: number; skipped: number } | null>(null);

  const fields = importType === 'leads' ? LEAD_FIELDS : STUDENT_FIELDS;

  const { data: existingPhones = new Set<string>() } = useQuery({
    queryKey: ['existing_phones_import', importType],
    queryFn: async () => {
      if (importType === 'leads') {
        const { data } = await supabase.from('leads').select('phone');
        return new Set((data || []).map((r: any) => normalizePhone(r.phone)));
      } else {
        const { data } = await supabase.from('students').select('phone');
        return new Set((data || []).map((r: any) => normalizePhone(r.phone)));
      }
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
        const autoMap: Mapping = {};
        for (const field of fields) {
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
      for (const field of fields) {
        const col = mapping[field.key];
        if (col) mapped[field.key] = (row[col] ?? '').trim();
      }
      const phone = normalizePhone(mapped.phone ?? '');
      return { row, mapped, isDuplicate: existingPhones.has(phone) };
    });
    setResults(preview);
    setStep('preview');
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const toInsert = results.filter((r) => !r.isDuplicate && r.mapped.phone);
      let inserted = 0;
      let skipped = 0;

      for (const r of toInsert) {
        const phone = normalizePhone(r.mapped.phone);

        if (importType === 'leads') {
          const { error } = await supabase.from('leads').insert({
            child_name:      r.mapped.child_name || 'Sin nombre',
            parent_name:     r.mapped.parent_name || 'Sin nombre',
            phone,
            email:           r.mapped.email || null,
            age:             r.mapped.age || null,
            city:            r.mapped.city || null,
            course_interest: r.mapped.course_interest || null,
            source:          'reactivation' as any,
            status:          'new' as any,
          });
          if (error) { skipped++; continue; }
        } else {
          const { error } = await supabase.from('students').insert({
            name:            r.mapped.name || 'Sin nombre',
            parent_name:     r.mapped.parent_name || 'Sin nombre',
            phone,
            email:           r.mapped.email || null,
            city:            r.mapped.city || null,
            course_interest: r.mapped.course_interest || null,
            is_active:       false,
            archived:        false,
          });
          if (error) { skipped++; continue; }
        }
        inserted++;
      }

      return { inserted, skipped: skipped + results.filter((r) => r.isDuplicate).length };
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      setStep('done');
      toast.success(`${summary.inserted} registros importados correctamente`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requiredMapped = fields.filter((f) => f.required).every((f) => mapping[f.key]);
  const validRows = results.filter((r) => !r.isDuplicate && r.mapped.phone).length;

  const resetWizard = () => {
    setStep('upload');
    setResults([]);
    setRows([]);
    setMapping({});
    setImportSummary(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(importType === 'leads' ? '/leads' : '/students')} className="gap-2 mb-6">
        <ArrowLeft size={16} />
        {importType === 'leads' ? 'Volver a Leads' : 'Volver a Estudiantes'}
      </Button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Upload className="text-primary-foreground" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Importar desde CSV</h1>
          <p className="text-muted-foreground text-sm">Sube un archivo exportado desde Excel o cualquier hoja de cálculo</p>
        </div>
      </div>

      {/* Import type selector — only shown on upload step */}
      {step === 'upload' && (
        <Card className="p-4 mb-6">
          <p className="text-sm font-medium mb-3">¿Qué tipo de contactos estás importando?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setImportType('leads')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                importType === 'leads' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <p className="font-medium text-sm">Leads nuevos</p>
              <p className="text-xs text-muted-foreground mt-1">Personas interesadas que nunca han comprado (ej. historial de Calendly)</p>
            </button>
            <button
              onClick={() => setImportType('students')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                importType === 'students' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <p className="font-medium text-sm">Ex-alumnos</p>
              <p className="text-xs text-muted-foreground mt-1">Clientes anteriores que tomaron cursos y podrían reactivarse</p>
            </button>
          </div>
        </Card>
      )}

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
              {fields.map((field) => (
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
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{validRows}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Se importarán</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {results.filter((r) => r.isDuplicate).length}
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
                    <th className="text-left px-3 py-2 font-medium">
                      {importType === 'leads' ? 'Niño/a' : 'Alumno/a'}
                    </th>
                    <th className="text-left px-3 py-2 font-medium">Padre/madre</th>
                    <th className="text-left px-3 py-2 font-medium">Teléfono</th>
                    {mapping.city && <th className="text-left px-3 py-2 font-medium">Ciudad</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={`border-t ${r.isDuplicate ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2">
                        {r.isDuplicate ? (
                          <Badge variant="outline" className="text-xs">Duplicado</Badge>
                        ) : (
                          <Badge variant="success" className="text-xs">Nuevo</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {importType === 'leads' ? (r.mapped.child_name || '—') : (r.mapped.name || '—')}
                      </td>
                      <td className="px-3 py-2">{r.mapped.parent_name || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{normalizePhone(r.mapped.phone || '')}</td>
                      {mapping.city && <td className="px-3 py-2">{r.mapped.city || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {importType === 'students' && validRows > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>Los ex-alumnos se importarán como alumnos inactivos. Desde su perfil en Estudiantes podrás iniciar una conversación de reactivación con Pablo.</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep('map')}>Atrás</Button>
            <Button onClick={() => importMutation.mutate()} disabled={validRows === 0 || importMutation.isPending}>
              {importMutation.isPending ? 'Importando...' : `Importar ${validRows} ${importType === 'leads' ? 'leads' : 'ex-alumnos'}`}
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
            <strong>{importSummary.inserted}</strong> {importType === 'leads' ? 'leads' : 'ex-alumnos'} importados correctamente.
            {importSummary.skipped > 0 && ` ${importSummary.skipped} omitidos por duplicado o error.`}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={resetWizard}>
              Importar otro archivo
            </Button>
            <Button onClick={() => navigate(importType === 'leads' ? '/leads' : '/students')}>
              {importType === 'leads' ? 'Ver leads →' : 'Ver estudiantes →'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
