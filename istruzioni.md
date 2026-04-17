L'app "family-finance-hub" è un gestionale di finanze familiari costruito con React + TypeScript + Supabase + Tailwind.

IMPORTANTE:

- NON modificare la struttura DB esistente
- NON toccare migrazioni già eseguite
- Usa le tabelle e colonne Supabase già presenti
- Mantieni compatibilità con localStorage come fallback
- NON rompere componenti UI (select, dialog, table, etc.)
- Integrati con AuthContext e appStore in place

AREE DI MIGLIORAMENTO (scegliere 1-2 da implementare):

1. **Transaction Search & Filtering Potenziato**

   - Aggiungi ricerca full-text nel campo descrizione
   - Filtri multi-select per tag simultanei
   - Date range picker migliorato con preset (ultimi 30 giorni, questo mese, etc.)
   - Reset filters button chiaramente visibile
2. **Dashboard Analytics**

   - Grafico spesa mensile (bar chart)
   - Top 5 categorie per spesa (pie chart)
   - Trend di entrate vs uscite (line chart)
   - Numero totale transazioni senza dover filtrare
3. **Smart Budget Management**

   - Badge "Attenzione" su categoria quando raggiunge 80% del budget
   - Storico budget mensili (cosa era impostato a gennaio, febbraio, etc.)
   - Budget comparison: questo mese vs media ultimi 3 mesi
4. **Transazioni Ricorrenti - Auto Detection**

   - Scan transazioni con stesso importo + descrizione negli ultimi 90 giorni
   - Suggerisci quali potrebbero essere ricorrenti
   - Checkbox per marcarle come ricorrenti (senza DB change, usa localStorage flag)
   - Visualizza solo ricorrenti con toggle
5. **Quick Insights nella Dashboard**

   - "Hai speso 15% in più questo mese rispetto allo scorso"
   - "La categoria 'Cibo' è il 40% delle spese"
   - "3 nuove transazioni ricorrenti rilevate"
   - "Nessuna transazione in 'Salute' - stai risparmiando!"
6. **Export & Reports**

   - Scarica report mensile in PDF (spese per categoria, totali, grafici)
   - Esporta transazioni selezionate in CSV
   - Condividi report con altri famiglia membri via link
7. **Settings Improvements**

   - Seleziona quale account visualizzare di default
   - Tema light/dark (usa localStorage)
   - Esporta/importa tutte le impostazioni (backup)

**VINCOLI TECNICI:**

- Mantieni tutte le pagine esistenti (Dashboard, Transactions, Budgets, Settings, etc.)
- Se aggiungi nuovo stato, usa appStore o localStorage
- Non fare breaking changes su tipi TypeScript
- I grafici devono essere responsive
- Aggiungi loading skeleton durante fetch dati DB
