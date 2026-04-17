// Author: Emanuele Motta
// Date: 17-Apr-2026

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CarItem {
  id: string;
  brand: string;
  model: string;
  nickname: string | null;
  logoUrl: string | null;
}

interface CarExpensesSettings {
  enabled: boolean;
  cars: CarItem[];
}

const defaultSettings: CarExpensesSettings = {
  enabled: false,
  cars: [],
};

const CAR_BRAND_LOGOS: Array<{ keys: string[]; slug: string }> = [
  { keys: ['alfa romeo'], slug: 'alfaromeo' },
  { keys: ['aston martin'], slug: 'astonmartin' },
  { keys: ['land rover', 'range rover'], slug: 'landrover' },
  { keys: ['mercedes benz', 'mercedes'], slug: 'mercedes' },
  { keys: ['bmw'], slug: 'bmw' },
  { keys: ['audi'], slug: 'audi' },
  { keys: ['fiat'], slug: 'fiat' },
  { keys: ['lancia'], slug: 'lancia' },
  { keys: ['ford'], slug: 'ford' },
  { keys: ['toyota'], slug: 'toyota' },
  { keys: ['honda'], slug: 'honda' },
  { keys: ['hyundai'], slug: 'hyundai' },
  { keys: ['kia'], slug: 'kia' },
  { keys: ['mazda'], slug: 'mazda' },
  { keys: ['nissan'], slug: 'nissan' },
  { keys: ['opel'], slug: 'opel' },
  { keys: ['peugeot'], slug: 'peugeot' },
  { keys: ['renault'], slug: 'renault' },
  { keys: ['citroen'], slug: 'citroen' },
  { keys: ['volkswagen', 'vw'], slug: 'volkswagen' },
  { keys: ['skoda'], slug: 'skoda' },
  { keys: ['seat'], slug: 'seat' },
  { keys: ['cupra'], slug: 'cupra' },
  { keys: ['tesla'], slug: 'tesla' },
  { keys: ['volvo'], slug: 'volvo' },
  { keys: ['jaguar'], slug: 'jaguar' },
  { keys: ['porsche'], slug: 'porsche' },
  { keys: ['ferrari'], slug: 'ferrari' },
  { keys: ['lamborghini'], slug: 'lamborghini' },
  { keys: ['maserati'], slug: 'maserati' },
  { keys: ['jeep'], slug: 'jeep' },
  { keys: ['mini'], slug: 'mini' },
  { keys: ['dacia'], slug: 'dacia' },
];

function toCarId(name: string, fallback = '') {
  return `${name.toLowerCase().trim().replace(/\s+/g, '-') || 'auto'}${fallback}`;
}

function splitLegacyName(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return { brand: '', model: '', nickname: null as string | null };
  const parts = cleaned.split(/\s+/);
  const brand = parts[0] || '';
  const model = parts.slice(1).join(' ');
  return { brand, model, nickname: cleaned };
}

export function getCarDisplayName(car: Pick<CarItem, 'brand' | 'model' | 'nickname'>) {
  if (car.nickname?.trim()) return car.nickname.trim();
  const combined = `${car.brand} ${car.model}`.trim();
  return combined || 'Auto';
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function inferCarLogoUrl(brand: string, model = ''): string | null {
  const normalized = normalizeName(`${brand} ${model}`);
  if (!normalized) return null;

  const matched = CAR_BRAND_LOGOS.find((entry) =>
    entry.keys.some((key) => normalized.includes(key))
  );

  if (!matched) return null;
  return `https://cdn.simpleicons.org/${matched.slug}`;
}

function normalizeCars(cars: unknown): CarItem[] {
  if (!Array.isArray(cars)) return [];

  // Backward compatibility: old format was string[]
  if (cars.every((item) => typeof item === 'string')) {
    return cars
      .map((name, index) => {
        const parsed = splitLegacyName(String(name));
        if (!parsed.brand) return null;
        return {
          id: toCarId(getCarDisplayName(parsed), `-${index + 1}`),
          brand: parsed.brand,
          model: parsed.model,
          nickname: parsed.nickname,
          logoUrl: inferCarLogoUrl(parsed.brand, parsed.model),
        };
      })
      .filter((car): car is CarItem => Boolean(car));
  }

  return cars
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as {
        id?: unknown;
        name?: unknown;
        brand?: unknown;
        model?: unknown;
        nickname?: unknown;
        logoUrl?: unknown;
      };

      const hasNewShape = typeof raw.brand === 'string' || typeof raw.model === 'string' || typeof raw.nickname === 'string';

      const legacyName = typeof raw.name === 'string' ? raw.name.trim() : '';
      const fallback = splitLegacyName(legacyName);

      const brand = hasNewShape
        ? (typeof raw.brand === 'string' ? raw.brand.trim() : '')
        : fallback.brand;
      const model = hasNewShape
        ? (typeof raw.model === 'string' ? raw.model.trim() : '')
        : fallback.model;
      const nickname = hasNewShape
        ? (typeof raw.nickname === 'string' && raw.nickname.trim() ? raw.nickname.trim() : null)
        : fallback.nickname;

      if (!brand) return null;

      const displayName = nickname || `${brand} ${model}`.trim() || brand;
      const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : toCarId(displayName, `-${index + 1}`);
      const logoUrl = typeof raw.logoUrl === 'string' && raw.logoUrl.trim() ? raw.logoUrl.trim() : inferCarLogoUrl(brand, model);

      return { id, brand, model, nickname, logoUrl };
    })
    .filter((car): car is CarItem => Boolean(car));
}

function getKey(familyGroupId: string) {
  return `familyPreferences:${familyGroupId}`;
}

/** LocalStorage is kept as an offline cache only. */
function readLocalSettings(familyGroupId: string): CarExpensesSettings | null {
  try {
    const raw = localStorage.getItem(getKey(familyGroupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { carExpenses?: CarExpensesSettings };
    const ces = parsed.carExpenses;
    if (!ces) return null;
    return { enabled: !!ces.enabled, cars: normalizeCars(ces.cars) };
  } catch {
    return null;
  }
}

function writeLocalSettings(familyGroupId: string, settings: CarExpensesSettings) {
  try {
    const raw = localStorage.getItem(getKey(familyGroupId));
    const existing = raw ? JSON.parse(raw) : {};
    localStorage.setItem(getKey(familyGroupId), JSON.stringify({ ...existing, carExpenses: settings }));
  } catch { /* ignore */ }
}

export function useCarExpensesSettings(familyGroupId: string | null) {
  const [settings, setSettings] = useState<CarExpensesSettings>(() => {
    if (!familyGroupId) return defaultSettings;
    return readLocalSettings(familyGroupId) ?? defaultSettings;
  });
  const loadedRef = useRef(false);

  // Load from Supabase on mount / familyGroupId change
  useEffect(() => {
    if (!familyGroupId) {
      setSettings(defaultSettings);
      loadedRef.current = false;
      return;
    }

    loadedRef.current = false;

    // Use local cache immediately while waiting for network
    const local = readLocalSettings(familyGroupId);
    if (local) setSettings(local);

    (supabase
      .from('family_groups') as any)
      .select('car_expenses_settings')
      .eq('id', familyGroupId)
      .single()
      .then(({ data, error }: { data: any; error: any }) => {
        if (error || !data) return;
        const raw = data.car_expenses_settings as { enabled?: boolean; cars?: unknown[] } | null;
        const fromDb: CarExpensesSettings = {
          enabled: !!raw?.enabled,
          cars: normalizeCars(raw?.cars),
        };
        setSettings(fromDb);
        writeLocalSettings(familyGroupId, fromDb);
        loadedRef.current = true;
      });
  }, [familyGroupId]);

  const saveSettings = useCallback(async (next: CarExpensesSettings) => {
    if (!familyGroupId) return;

    const normalized: CarExpensesSettings = {
      enabled: !!next.enabled,
      cars: normalizeCars(next.cars),
    };

    // Optimistic local update
    setSettings(normalized);
    writeLocalSettings(familyGroupId, normalized);

    await (supabase
      .from('family_groups') as any)
      .update({ car_expenses_settings: normalized })
      .eq('id', familyGroupId);
  }, [familyGroupId]);

  const setEnabled = useCallback((enabled: boolean) => {
    saveSettings({ ...settings, enabled });
  }, [saveSettings, settings]);

  const addCar = useCallback((input: { brand: string; model?: string | null; nickname?: string | null; logoUrl?: string | null }) => {
    const brand = input.brand.trim();
    const model = input.model?.trim() || '';
    const nickname = input.nickname?.trim() || null;
    if (!brand) return;

    const displayName = nickname || `${brand} ${model}`.trim() || brand;
    const id = toCarId(displayName, `-${settings.cars.length + 1}`);
    saveSettings({
      ...settings,
      cars: [...settings.cars, {
        id,
        brand,
        model,
        nickname,
        logoUrl: input.logoUrl?.trim() || inferCarLogoUrl(brand, model),
      }],
    });
  }, [saveSettings, settings]);

  const updateCar = useCallback((id: string, updates: Partial<Pick<CarItem, 'brand' | 'model' | 'nickname' | 'logoUrl'>>) => {
    saveSettings({
      ...settings,
      cars: settings.cars.map((car) => car.id === id ? {
        ...(() => {
          const nextBrand = updates.brand?.trim() ? updates.brand.trim() : car.brand;
          const nextModel = updates.model?.trim() ?? car.model;
          const nextNickname = updates.nickname === undefined
            ? car.nickname
            : (updates.nickname?.trim() || null);
          const nextLogo = updates.logoUrl !== undefined
            ? (updates.logoUrl?.trim() || null)
            : (updates.brand !== undefined || updates.model !== undefined
              ? inferCarLogoUrl(nextBrand, nextModel)
              : car.logoUrl);

          return {
            ...car,
            brand: nextBrand,
            model: nextModel,
            nickname: nextNickname,
            logoUrl: nextLogo,
          };
        })(),
      } : car),
    });
  }, [saveSettings, settings]);

  const removeCar = useCallback((id: string) => {
    saveSettings({ ...settings, cars: settings.cars.filter((car) => car.id !== id) });
  }, [saveSettings, settings]);

  return {
    settings,
    setEnabled,
    addCar,
    updateCar,
    removeCar,
    saveSettings,
  };
}
