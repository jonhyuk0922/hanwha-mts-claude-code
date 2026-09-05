import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** 제목 줄이 있는 카드. 화면 4개가 모두 이 틀 안에 들어간다. */
export function Panel({ title, right, className, children }: PanelProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`}>
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {right ? <div className="panel-right">{right}</div> : null}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
