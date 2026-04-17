# 🚀 Features Roadmap - Family Finance Hub

**Data:** 17-Apr-2026 | **Autore:** Emanuele Motta

---

## 📊 Panoramica Features

| # | Feature | Complessità | Impatto | Stima Ore | Dipendenze | Priorità |
|---|---------|-------------|--------|-----------|------------|----------|
| 1 | Transaction Search & Filtering Potenziato | 🟡 Media | 🟢 Alto | 4-5h | Nessuna | 🔴 P1 |
| 2 | Dashboard Analytics (Grafici) | 🔴 Alta | 🟢 Alto | 6-8h | Chart lib | 🔴 P1 |
| 3 | Quick Insights Dashboard | 🟡 Media | 🟡 Medio | 3-4h | Analytics | 🟠 P2 |
| 4 | Smart Budget Management | 🟡 Media | 🟡 Medio | 4-5h | Nessuna | 🟠 P2 |
| 5 | Transazioni Ricorrenti Auto Detection | 🔴 Alta | 🟡 Medio | 5-7h | Nessuna | 🟠 P2 |
| 6 | Export & Reports (PDF/CSV) | 🔴 Alta | 🟠 Basso | 5-6h | Nessuna | 🟡 P3 |
| 7 | Settings Improvements (Tema + Backup) | 🟢 Bassa | 🟠 Basso | 2-3h | Nessuna | 🟡 P3 |

---

## 🎯 FASE 1 (PRIORITY 1) - Week 1

### 1️⃣ **Transaction Search & Filtering Potenziato** ⭐⭐⭐⭐⭐
**Impatto UX:** MASSIMO | **Ore:** 4-5 | **Complessità:** Media

**Cosa aggiungere a `TransactionsPage.tsx`:**
- ✅ Ricerca full-text: filtrare per descrizione (non solo categoria/account)
- ✅ Multi-select tag: selezionare 2+ tag contemporaneamente
- ✅ Date range picker con preset:
  - Ultimi 7 giorni
  - Ultimi 30 giorni
  - Questo mese
  - Ultimi 3 mesi
  - Personalizzato
- ✅ **Reset All Filters** button visibile e prominente
- ✅ Badge counter "N filtri attivi"

**Componenti da creare:**
- `DateRangePresets.tsx` - Preset selector con custom range
- Update `TransactionsPage.tsx` - aggiungere ricerca full-text + multi-select tag handler

**Per chi lo userà:**
- Trovare transazioni molto più veloce
- Meno click per filtrare
- Non ci si perde più tra i filtri

---

### 2️⃣ **Dashboard Analytics (Grafici + Metriche)** ⭐⭐⭐⭐⭐
**Impatto UX:** MASSIMO | **Ore:** 6-8 | **Complessità:** Alta

**Cosa nuovo in `DashboardPage.tsx`:**
- 📊 **Bar Chart:** spesa per categoria (ultimi 12 mesi in storico, questo mese in detail)
- 🥧 **Pie Chart:** top 5 categorie per % spesa questo mese
- 📈 **Line Chart:** trend entrate vs uscite (ultimi 6 mesi)
- 📋 **Metrics Card:** totale transazioni questo mese (senza dover filtrare)
- 📌 **Mini KPI:** 
  - Spesa media giornaliera
  - Entrata media giornaliera
  - Rapporto entrata/spesa

**Librerie da aggiungere:**
- `recharts` (o `chart.js`) - già disponibile tramite `@/components/ui/chart`

**Per chi lo userà:**
- Dashboard diventa "smart" e informativa
- Vedere trend senza analisi manuale
- Prendere decisioni su budget basate su dati visivi

---

## 🟠 FASE 2 (PRIORITY 2) - Week 2-3

### 3️⃣ **Quick Insights Dashboard (Smart Comments)**
**Impatto UX:** Medio | **Ore:** 3-4 | **Complessità:** Media
**Dipende da:** Analytics

**Card di testo intelligente (CalcolateImmediately):**
- "Hai speso €XXX in più questo mese (+15%) vs lo scorso mese"
- "La categoria 'Cibo' è il 40% delle spese (vs 35% media ultimi 3 mesi)"
- "⚠️ Budget 'Spese Fisse' al 85% carico (€XXX / €YYY)"
- "3 nuove transazioni ricorrenti rilevate" → link a suggeste recurring
- "🎉 Nessuna transazione in 'Salute' - risparmi su tempo libero!"
- "Trend: ultimamente +10% spese auto vs media storica"

**Come costruirlo:**
- Hook: `useDashboardInsights()` che calcola tutte le metriche
- Componenti visual: `InsightCard.tsx` con icon + testo + action



Questo diventerà il valore aggiunto di FamilyFinance rispetto competitor
---

### 4️⃣ **Smart Budget Management**
**Impatto UX:** Medio | **Ore:** 4-5 | **Complessità:** Media

**In `BudgetsPage.tsx`:**
- 🟠 **Badge "Attenzione"** quando categoria raggiunge 80% del budget mensile
- 📊 **Storico Budget:** dropdownselezionare mese/anno e vedere budget impostato in quel periodo
- 📉 **Budget Comparison:** "Questo mese vs media ultimi 3 mesi"
  - Tabella: Budget impostato | Budget medio | Differenza
- 🔔 **Alert su budget**: mostra quando hai superato un budget

**Schema DB update:**
- Aggiungere tracking storico budget (quando cambi budget, salvare versione vecchia)

---

### 5️⃣ **Transazioni Ricorrenti Auto Detection**
**Impatto UX:** Medio | **Ore:** 5-7 | **Complessità:** Alta

**Logica di detection:**
1. Scan ultimis 90 giorni di transazioni
2. Trovare pattern: **stessa importo + descrizione simile + intervallo regolare**
3. Suggerire come ricorrente
4. Checkbox per marcare: "Sì, questo è ricorrente"

**In `TransactionsPage.tsx`:**
- 🔍 **Detection badge:** mostra N transazioni potenzialmente ricorrenti
- 📋 **Suggested Recurring:** tab/modal con lista di transazioni simili
- ✅ **Checkbox:** marca come ricorrente
- 👁️ **Toggle "Mostra solo ricorrenti"** nel filtri

**Per chi lo userà:**
- Scopre abbonamenti nascosti che paga senza accorgersene
- Gestisce budget ricorrente automaticamente

---

## 🟡 FASE 3 (PRIORITY 3) - Week 4

### 6️⃣ **Export & Reports (PDF/CSV)**
**Impatto UX:** Basso immediato (alto a lungo termine) | **Ore:** 5-6 | **Complessità:** Alta

**In `TransactionsPage.tsx` e `DashboardPage.tsx`:**
- 📥 **Export CSV:** selezionare transazioni → download CSV con:
  - Data, Descrizione, Importo, Categoria, Account, Tag
- 📄 **Export PDF Report:** report mensile con:
  - Copertina (mese, anno, famiglia)
  - Tabella transazioni categoria-by-categoria
  - Grafici (pie, bar)
  - Totali e comparison vs mese precedente
- 🔗 **Share Report Link:** genera link privato per altri family member
  - Link con auth token limitato
  - Scade dopo 7 giorni

**Librerie:**
- `jspdf` + `html2canvas` per PDF
- `papaparse` per CSV

---

### 7️⃣ **Settings Improvements (Tema + Backup)**
**Impatto UX:** Basso | **Ore:** 2-3 | **Complessità:** Bassa

**In `SettingsPage.tsx`:**
- 🌙 **Tema Light/Dark:**
  - Toggle switch
  - Salva in localStorage
  - CSS custom properties per tema
- 🏠 **Account di Default:** seleziona quale account mostrare per default
- 💾 **Export Settings:** bottone download JSON con tutte le impostazioni
- 📨 **Import Settings:** upload JSON backup

---

## 📋 Proposte per Prioritizzazione Iniziale

### **Scenario A: "Voglio il massimo impatto subito"** (CONSIGLIATO)
1. **Week 1:** Transaction Search & Filtering (P1)
2. **Week 1-2:** Dashboard Analytics (P1)
3. **Week 2:** Quick Insights (P2) - complement da Analytics

### **Scenario B: "Voglio feature complete e stabili"**
1. **Week 1:** Transaction Search & Filtering (P1) ← Start here
2. **Week 2:** Smart Budget Management (P2)
3. **Week 3:** Dashboard Analytics (P1) - più time per testare

### **Scenario C: "Voglio tutto ma in ordine logico"**
Seguire tabella priorità in ordine: P1 → P2 → P3

---

## ⚙️ Note Tecniche

### Dipendenze da Installare (se mancanti)
```bash
npm install recharts  # Charts
npm install jspdf html2canvas  # PDF export
npm install papaparse  # CSV export
```

### Database Changes (minimal)
- **budget_history** table: tracciare budget changes nel tempo
- **tag_suggestions** table (optional): salvare suggestion di ricorrenti

### AppStore Updates Needed
- `useDashboardFilter` - hook centralizzato per filter state
- `useDateRange` - date picker logic

---

## 🎯 Consiglio di Start

Consiglio **VIVAMENTE** di iniziare con **#1 Transaction Search** perché:
✅ Completa subito l'app "pulita" (TransactionsPage è il cuore)
✅ Non ha dipendenze
✅ 4-5 ore per ROI altissimo
✅ Base solida per altre features

Poi **#2 Dashboard Analytics** per fare il visual wow factor.

---

## 📝 Tracking

- [ ] Phase 1 - Week 1
  - [ ] Transaction Search & Filtering
  - [ ] Dashboard Analytics
- [ ] Phase 2 - Week 2-3
  - [ ] Quick Insights
  - [ ] Smart Budget Management
  - [ ] Recurring Auto Detection
- [ ] Phase 3 - Week 4
  - [ ] Export & Reports
  - [ ] Settings Improvements
