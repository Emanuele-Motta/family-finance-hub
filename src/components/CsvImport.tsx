import { useState, useRef } from 'react';
import { useTransactions, useCategories } from '@/hooks/useFinanceData';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet } from 'lucide-react';

export default function CsvImport() {
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({ amount: '', date: '', notes: '', type: '' });
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addTransaction } = useTransactions();
  const categories = useCategories();
  const { user } = useAuth();
  const { currentFamilyGroupId } = useAppStore();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('File vuoto o non valido'); return; }

      // Detect separator
      const sep = lines[0].includes(';') ? ';' : ',';
      const hdrs = lines[0].split(sep).map(h => h.replace(/"/g, '').trim());
      const data = lines.slice(1).map(l => l.split(sep).map(c => c.replace(/"/g, '').trim()));
      setHeaders(hdrs);
      setRows(data);

      // Auto-detect mapping
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
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!user || !currentFamilyGroupId || !mapping.amount) return;
    setImporting(true);
    let count = 0;
    for (const row of rows) {
      try {
        const rawAmount = parseFloat(row[parseInt(mapping.amount)]?.replace(',', '.'));
        if (isNaN(rawAmount)) continue;

        const amount = Math.abs(rawAmount);
        let type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense';
        
        if (mapping.type && row[parseInt(mapping.type)]) {
          const t = row[parseInt(mapping.type)].toLowerCase();
          if (t.includes('uscita') || t.includes('addebito') || t.includes('expense')) type = 'expense';
          if (t.includes('entrata') || t.includes('accredito') || t.includes('income')) type = 'income';
        }

        const dateStr = mapping.date ? row[parseInt(mapping.date)] : '';
        let date = new Date().toISOString().split('T')[0];
        if (dateStr) {
          // Try dd/mm/yyyy
          const parts = dateStr.split(/[/\-\.]/);
          if (parts.length === 3) {
            const [a, b, c] = parts;
            if (a.length === 4) date = `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`;
            else date = `${c.length === 2 ? '20'+c : c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
          }
        }

        const notes = mapping.notes ? row[parseInt(mapping.notes)] : null;

        await addTransaction({
          family_group_id: currentFamilyGroupId,
          user_id: user.id,
          category_id: null,
          amount,
          type,
          date,
          notes: notes || null,
          recurring: false,
          recurrence_type: null,
          tags: null,
        });
        count++;
      } catch (e) { /* skip bad rows */ }
    }
    setImporting(false);
    toast.success(`${count} transazioni importate!`);
    setOpen(false);
    setHeaders([]);
    setRows([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-1" />
          Importa CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importa estratto conto
          </DialogTitle>
        </DialogHeader>

        {headers.length === 0 ? (
          <div className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clicca o trascina un file CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Supporta separatori , e ;</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rows.length} righe trovate. Mappa le colonne:</p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Importo *</Label>
                <Select value={mapping.amount} onValueChange={v => setMapping(m => ({ ...m, amount: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Select value={mapping.date} onValueChange={v => setMapping(m => ({ ...m, date: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note/Descrizione</Label>
                <Select value={mapping.notes} onValueChange={v => setMapping(m => ({ ...m, notes: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={mapping.type} onValueChange={v => setMapping(m => ({ ...m, type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded border border-border overflow-auto max-h-32 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">{headers.map((h, i) => <th key={i} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((c, j) => <td key={j} className="px-2 py-1 truncate max-w-[120px]">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleImport} disabled={!mapping.amount || importing} className="w-full">
              {importing ? 'Importando...' : `Importa ${rows.length} transazioni`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
