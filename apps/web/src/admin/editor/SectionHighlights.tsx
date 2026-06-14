import { HighlightsEditor, type HighlightItem } from '../SubEntityEditors';

interface SectionHighlightsProps {
  items: HighlightItem[];
  onChange: (items: HighlightItem[]) => void;
}

export default function SectionHighlights({ items, onChange }: SectionHighlightsProps) {
  return (
    <div className="max-w-2xl">
      <HighlightsEditor items={items} onChange={onChange} />
    </div>
  );
}
