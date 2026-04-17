import { useState, useRef } from 'react';
import { useTransactions, useAccounts, useCategories } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Trash2, Undo2 } from 'lucide-react';

interface ParsedRow {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
  categoryId: string | null;
  categoryName: string | null;
  include: boolean;
}

type Stage = 'upload' | 'mapping' | 'review';

const headerKeywords = [
  'data',
  'date',
  'descrizione',
  'causale',
  'note',
  'importo',
  'amount',
  'addebito',
  'accredito',
  'tipo',
  'saldo',
  'valuta',
];

export default function CsvImport() {
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({ amount: '', date: '', notes: '', type: '' });
  const [importing, setImporting] = useState(false);
  const [stage, setStage] = useState<Stage>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const categories = useCategories();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();

  const resetState = () => {
    setHeaders([]);
    setRows([]);
    setParsedRows([]);
    setMapping({ amount: '', date: '', notes: '', type: '' });
    setStage('upload');
  };

  const parseCsv = (text: string) => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error('File vuoto o non valido');
      return;
    }

    const sep = lines[0].includes(';') ? ';' : ',';
    const hdrs = lines[0].split(sep).map((h) => h.replace(/"/g, '').trim());
    const data = lines.slice(1).map((l) => l.split(sep).map((c) => c.replace(/"/g, '').trim()));

    setHeaders(hdrs);
    setRows(data);
    autoMapColumns(hdrs);
    setStage('mapping');
  };

  const parseExcel = async (file: File) => {
    const xlsxSource = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';
    const XLSX: any = await import(/* @vite-ignore */ xlsxSource);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as (string | number)[][];

    if (!matrix.length || matrix.length < 2) {
      toast.error('Excel vuoto o non valido');
      return;
    }

    const normalized = matrix.map((r) => r.map((v) => String(v ?? '').trim()));
    const headerIndex = detectHeaderRow(normalized);
    const hdrs = normalized[headerIndex] || [];
    const data = normalized.slice(headerIndex + 1).filter((row) => row.some((cell) => cell !== ''));

    setHeaders(hdrs);
    setRows(data);
    autoMapColumns(hdrs);
    setStage('mapping');
  };

  const detectHeaderRow = (matrix: string[][]): number => {
    const maxRowsToScan = Math.min(30, matrix.length);
    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < maxRowsToScan; i++) {
      const row = matrix[i] || [];
      const nonEmpty = row.filter((c) => c.trim() !== '');
      if (!nonEmpty.length) continue;

      const joined = nonEmpty.join(' ').toLowerCase();
      const keywordHits = headerKeywords.reduce((acc, k) => acc + (joined.includes(k) ? 1 : 0), 0);
      const textCells = nonEmpty.filter((c) => /[a-zA-ZÀ-ÿ]/.test(c)).length;
      const numericCells = nonEmpty.filter((c) => /^-?\d+[.,]?\d*$/.test(c)).length;

      // prefer rows with semantic labels and mostly textual headers
      const score = keywordHits * 5 + textCells * 2 - numericCells;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  const autoMapColumns = (hdrs: string[]) => {
    const autoMap = { amount: '', date: '', notes: '', type: '' };
    hdrs.forEach((h, i) => {
      const hl = h.toLowerCase();
      if (hl.includes('import') || hl.includes('amount') || hl.includes('somma')) autoMap.amount = String(i);
      if (hl.includes('data') || hl.includes('date') || hl.includes('valuta')) autoMap.date = String(i);
      if (hl.includes('descri') || hl.includes('note') || hl.includes('causale')) autoMap.notes = String(i);
      if (hl.includes('tipo') || hl.includes('type')) autoMap.type = String(i);
    });
    setMapping(autoMap);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (ev) => parseCsv((ev.target?.result as string) || '');
        reader.readAsText(file);
        return;
      }

      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        await parseExcel(file);
        return;
      }

      toast.error('Formato non supportato. Usa CSV o Excel (.xlsx, .xls).');
    } catch (err: any) {
      toast.error(err.message || 'Errore lettura file');
    }
  };

  const normalizeDate = (dateStr: string | undefined) => {
    let date = new Date().toISOString().split('T')[0];
    if (!dateStr) return date;

    const parts = dateStr.split(/[/\-.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
      return `${c.length === 2 ? `20${c}` : c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }

    return date;
  };

  const inferCategoryFromDescription = (
    description: string,
    currentType: 'income' | 'expense',
  ): { type: 'income' | 'expense'; categoryId: string | null; categoryName: string | null } => {
    const text = description.toLowerCase();
    const typeHints: Record<string, 'income' | 'expense'> = {
      stipendio: 'income',
      accredito: 'income',
      bonifico: 'income',
      rimborso: 'income',
      addebito: 'expense',
      pagamento: 'expense',
      pos: 'expense',
      prelievo: 'expense',
      bolletta: 'expense',
    };

    let detectedType = currentType;
    for (const [kw, t] of Object.entries(typeHints)) {
      if (text.includes(kw)) {
        detectedType = t;
        break;
      }
    }

    const detectedCategory =
      categories
        .filter((c) => c.type === detectedType)
        .find((c) => text.includes(c.name.toLowerCase())) ||
      categories
        .filter((c) => c.type === detectedType)
        .find((c) => {
          const aliases: Record<string, string[]> = {
            Alimentari: ['supermercato', 'spesa', 'coop', 'esselunga', 'conad'],
            Trasporti: ['benzina', 'carburante', 'autostrada', 'treno', 'bus', 'metro'],
            Ristoranti: ['ristorante', 'bar', 'pizzeria', 'caffè', 'delivery', 'just eat', 'glovo'],
            Utenze: ['luce', 'gas', 'acqua', 'telefono', 'internet', 'fibra'],
            Casa: ['affitto', 'condominio', 'mutuo', 'manutenzione'],
            Stipendio: ['stipendio', 'salary', 'payroll'],
            Investimenti: ['investimento', 'etf', 'azione', 'dividendo'],
          };
          const keys = aliases[c.name] || [];
          return keys.some((k) => text.includes(k));
        });

    return {
      type: detectedType,
      categoryId: detectedCategory?.id ?? null,
      categoryName: detectedCategory?.name ?? null,
    };
  };

  const buildPreview = () => {
    if (!mapping.amount) {
      toast.error('Seleziona almeno la colonna Importo');
      return;
    }

    const mapped: ParsedRow[] = rows
      .map((row, i) => {
        const rawAmount = parseFloat((row[parseInt(mapping.amount)] || '').replace(',', '.'));
        if (isNaN(rawAmount)) return null;

        let type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense';
        if (mapping.type && row[parseInt(mapping.type)]) {
          const t = row[parseInt(mapping.type)].toLowerCase();
          if (t.includes('uscita') || t.includes('addebito') || t.includes('expense')) type = 'expense';
          if (t.includes('entrata') || t.includes('accredito') || t.includes('income')) type = 'income';
        }

        const notes = ((mapping.notes ? row[parseInt(mapping.notes)] : null) || '').trim();
        const descriptionText = [notes, ...row].join(' ').trim();
        const inferred = inferCategoryFromDescription(descriptionText, type);

        return {
          id: `${i}-${Math.random().toString(36).slice(2, 8)}`,
          amount: Math.abs(rawAmount),
          type: inferred.type,
          date: normalizeDate(mapping.date ? row[parseInt(mapping.date)] : undefined),
          notes: notes || null,
          categoryId: inferred.categoryId,
          categoryName: inferred.categoryName,
          include: true,
        } as ParsedRow;
      })
      .filter((r): r is ParsedRow => !!r);

    if (!mapped.length) {
      toast.error('Nessun movimento valido trovato');
      return;
    }

    setParsedRows(mapped);
    setStage('review');
  };

  const toggleRow = (id: string) => {
    setParsedRows((prev) => prev.map((row) => (row.id === id ? { ...row, include: !row.include } : row)));
  };

  const handleImport = async () => {
    const defaultAccountId = accounts.find((a) => a.is_primary)?.id || accounts[0]?.id;
    if (!user || !currentFamilyGroupId || !defaultAccountId) return;

    const toImport = parsedRows.filter((r) => r.include);
    if (!toImport.length) {
      toast.error('Nessun movimento selezionato');
      return;
    }

    setImporting(true);
    let count = 0;

    for (const row of toImport) {
      try {
        await addTransaction({
          family_group_id: currentFamilyGroupId,
          user_id: user.id,
          created_by_user_id: user.id,
          paid_by_user_id: user.id,
          category_id: row.categoryId,
          account_id: defaultAccountId,
          to_account_id: null,
          amount: row.amount,
          type: row.type,
          date: row.date,
          notes: row.notes,
          recurring: false,
          recurrence_type: null,
          tags: null,
        });
        count++;
      } catch {
        // skip invalid rows
      }
    }

    setImporting(false);
    toast.success(`${count} movimenti importati`);
    setOpen(false);
    resetState();
  };

  const selectedCount = parsedRows.filter((r) => r.include).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-1" />
          Importa CSV/Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importa movimenti
          </DialogTitle>
        </DialogHeader>

        {stage === 'upload' && (
          <div className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carica un file CSV o Excel</p>
              <p className="text-xs text-muted-foreground mt-1">Supportati: .csv, .xlsx, .xls</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        )}

        {stage === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rows.length} righe trovate. Mappa le colonne:</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Importo *</Label>
                <Select value={mapping.amount} onValueChange={(v) => setMapping((m) => ({ ...m, amount: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Select value={mapping.date} onValueChange={(v) => setMapping((m) => ({ ...m, date: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Select value={mapping.notes} onValueChange={(v) => setMapping((m) => ({ ...m, notes: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={mapping.type} onValueChange={(v) => setMapping((m) => ({ ...m, type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded border border-border overflow-auto max-h-40 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">{headers.map((h, i) => <th key={i} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 4).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => <td key={j} className="px-2 py-1 truncate max-w-[140px]">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStage('upload')}>Indietro</Button>
              <Button onClick={buildPreview}>Genera anteprima</Button>
            </div>
          </div>
        )}

        {stage === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ho letto {parsedRows.length} movimenti. Selezionati per import: <strong>{selectedCount}</strong>.
            </p>

            <div className="rounded border border-border overflow-auto max-h-64 text-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted text-xs uppercase">
                    <th className="px-2 py-2 text-left">Stato</th>
                    <th className="px-2 py-2 text-left">Data</th>
                    <th className="px-2 py-2 text-left">Tipo</th>
                    <th className="px-2 py-2 text-left">Importo</th>
                    <th className="px-2 py-2 text-left">Categoria</th>
                    <th className="px-2 py-2 text-left">Note</th>
                    <th className="px-2 py-2 text-right">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => (
                    <tr key={row.id} className={`border-t border-border ${!row.include ? 'opacity-40' : ''}`}>
                      <td className="px-2 py-2">{row.include ? 'Incluso' : 'Escluso'}</td>
                      <td className="px-2 py-2">{row.date}</td>
                      <td className="px-2 py-2">{row.type}</td>
                      <td className="px-2 py-2">€{row.amount.toFixed(2)}</td>
                      <td className="px-2 py-2">{row.categoryName || '-'}</td>
                      <td className="px-2 py-2 truncate max-w-[220px]">{row.notes || '-'}</td>
                      <td className="px-2 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => toggleRow(row.id)}>
                          {row.include ? <Trash2 className="w-4 h-4" /> : <Undo2 className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStage('mapping')}>Modifica mapping</Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing ? 'Importando...' : `Conferma import (${selectedCount})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
