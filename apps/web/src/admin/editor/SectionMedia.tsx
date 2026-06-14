import { MediaEditor, type MediaItem } from '../SubEntityEditors';

interface SectionMediaProps {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  errors?: string[];
  showValidation?: boolean;
}

export default function SectionMedia({ items, onChange, errors, showValidation }: SectionMediaProps) {
  return (
    <div className="max-w-2xl">
      <MediaEditor items={items} onChange={onChange} />
      {showValidation && errors?.map((e, i) => (
        <p key={i} className="mt-2 text-xs text-red-400">{e}</p>
      ))}
    </div>
  );
}
