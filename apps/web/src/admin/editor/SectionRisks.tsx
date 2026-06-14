import { RisksEditor, type RiskItem } from '../SubEntityEditors';

interface SectionRisksProps {
  items: RiskItem[];
  onChange: (items: RiskItem[]) => void;
  errors?: string[];
  showValidation?: boolean;
}

export default function SectionRisks({ items, onChange, errors, showValidation }: SectionRisksProps) {
  return (
    <div className="max-w-2xl">
      <RisksEditor items={items} onChange={onChange} />
      {showValidation && errors?.map((e, i) => (
        <p key={i} className="mt-2 text-xs text-red-400">{e}</p>
      ))}
    </div>
  );
}
