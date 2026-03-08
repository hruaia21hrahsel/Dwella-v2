import { DwellaLogo } from '@/components/DwellaLogo';

interface Props {
  dark?: boolean;
}

export function DwellaHeaderTitle({ dark = false }: Props) {
  return <DwellaLogo width={160} height={40} color={dark ? '#1E293B' : '#fff'} />;
}
