import { MilestonesEditor, type MilestoneItem } from '../SubEntityEditors';

interface SectionMilestonesProps {
  items: MilestoneItem[];
  onChange: (items: MilestoneItem[]) => void;
}

export default function SectionMilestones({ items, onChange }: SectionMilestonesProps) {
  return (
    <div className="max-w-2xl">
      <MilestonesEditor items={items} onChange={onChange} />
    </div>
  );
}
