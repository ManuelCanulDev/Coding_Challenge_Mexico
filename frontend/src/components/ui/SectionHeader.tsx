import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="panel-header gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="min-w-0 shrink-0 max-w-full">{action}</div>}
    </div>
  );
}
