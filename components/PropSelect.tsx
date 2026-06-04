'use client';
import { Sport } from '@/types';
import { getPropsForSport } from '@/lib/statConfig';

interface Props {
  sport: Sport;
  value: string;
  onChange: (val: string) => void;
  id?: string;
}

export default function PropSelect({ sport, value, onChange, id }: Props) {
  const groups = getPropsForSport(sport);

  return (
    <select id={id} value={value} onChange={e => onChange(e.target.value)}>
      {groups.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
