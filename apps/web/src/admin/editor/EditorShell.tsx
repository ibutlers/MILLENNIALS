import type { ReactNode } from 'react';
import type { SectionDef } from './useEditorForm';

interface EditorShellProps {
  sections: SectionDef[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  errorSections: Record<string, boolean>;
  dirtySections: (section: SectionDef) => boolean;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: (open: boolean) => void;
  children: ReactNode;
}

export default function EditorShell({
  sections,
  activeSection,
  onSectionChange,
  errorSections,
  dirtySections,
  mobileMenuOpen,
  onToggleMobileMenu,
  children,
}: EditorShellProps) {
  return (
    <>
      {/* Mobile section selector */}
      <div className="md:hidden shrink-0 px-4 pt-3">
        <button
          onClick={() => onToggleMobileMenu(!mobileMenuOpen)}
          className="flex w-full items-center justify-between rounded border border-[#1A3E48] bg-[#0F2A30] px-4 py-2.5 text-[#FBF7F0]"
          aria-expanded={mobileMenuOpen}
        >
          <span className="flex items-center gap-2">
            {sections.find((s) => s.key === activeSection)?.label || 'Sección'}
            {errorSections[activeSection] && (
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Errores en esta sección" />
            )}
          </span>
          <span className={`transform transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {mobileMenuOpen && (
          <div className="mt-1 rounded border border-[#1A3E48] bg-[#0F2A30] shadow-lg">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => onSectionChange(s.key)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  activeSection === s.key
                    ? 'bg-[#1A3E48] text-[#7FA88C] border-l-2 border-l-[#7FA88C]'
                    : 'text-[#9B7E5F] hover:bg-[#1A3E48] hover:text-[#FBF7F0]'
                }`}
              >
                {s.label}
                {errorSections[s.key] && (
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 flex-shrink-0" aria-label="Errores" />
                )}
                {dirtySections(s) && (
                  <span className="text-xs text-[#7FA88C] ml-auto" aria-label="Modificado">●</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 border-r border-[#1A3E48] bg-[#0F2A30] overflow-y-auto">
          <nav className="py-2" aria-label="Secciones del editor">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => onSectionChange(s.key)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors border-l-2 ${
                  activeSection === s.key
                    ? 'border-l-[#7FA88C] bg-[#1A3E48] text-[#7FA88C]'
                    : 'border-l-transparent text-[#9B7E5F] hover:bg-[#1A3E48] hover:text-[#FBF7F0]'
                }`}
              >
                <span className="flex-1">{s.label}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  {errorSections[s.key] && (
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Errores en esta sección" />
                  )}
                  {dirtySections(s) && (
                    <span className="text-xs text-[#7FA88C]" aria-label="Cambios sin guardar">●</span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content panel */}
        {children}
      </div>
    </>
  );
}
