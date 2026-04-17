/**
 * Skeleton Layouts - Reusable staggered skeleton patterns
 * Author: Emanuele Motta - 17-Apr-2026
 */

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface StaggeredProps {
  className?: string;
}

/** KPI cards grid skeleton — matches Dashboard KPI layout */
export function KpiGridSkeleton({ count = 8, className }: { count?: number } & StaggeredProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-2 min-[980px]:grid-cols-4 gap-3 md:gap-4 lg:gap-5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="glass-card min-h-[132px] animate-fade-in-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <Skeleton className="h-7 w-28 rounded mb-2" />
            <Skeleton className="h-3 w-16 rounded mb-3" />
            {/* Sparkline area */}
            <div className="flex items-end gap-1 h-8">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton
                  key={j}
                  className="flex-1 rounded-t"
                  style={{ height: `${30 + Math.random() * 70}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Single insight card skeleton */
function InsightCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card className="glass-card animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-3/4 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Insights grid skeleton */
export function InsightsGridSkeleton({ className }: StaggeredProps) {
  return (
    <div className={cn('grid md:grid-cols-2 gap-3', className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <InsightCardSkeleton key={i} delay={i * 60} />
      ))}
    </div>
  );
}

/** Chart card skeleton */
export function ChartCardSkeleton({ height = 200, className }: { height?: number } & StaggeredProps) {
  return (
    <Card className="glass-card animate-fade-in-up">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className={cn('px-4 pb-4', className)}>
        <Skeleton style={{ height }} className="w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

/** List row skeleton */
function ListRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      <Skeleton className="h-4 w-16 rounded" />
    </div>
  );
}

/** Transaction list skeleton */
export function TransactionListSkeleton({ count = 6, className }: { count?: number } & StaggeredProps) {
  return (
    <Card className={cn('glass-card', className)}>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-36 rounded" />
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <ListRowSkeleton key={i} delay={i * 40} />
        ))}
      </CardContent>
    </Card>
  );
}

/** Full Dashboard skeleton */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <KpiGridSkeleton count={8} />
      <InsightsGridSkeleton />

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCardSkeleton height={220} />
        <ChartCardSkeleton height={220} />
      </div>

      <TransactionListSkeleton count={5} />
    </div>
  );
}

/** Budget card skeleton */
export function BudgetCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card className="glass-card animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Budget page grid skeleton */
export function BudgetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <BudgetCardSkeleton key={i} delay={i * 50} />
      ))}
    </div>
  );
}

/** Generic page header skeleton */
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between pb-2 animate-fade-in">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-3 w-56 rounded" />
      </div>
      <Skeleton className="h-9 w-32 rounded-md" />
    </div>
  );
}
