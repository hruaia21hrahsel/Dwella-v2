import { DwellaLogo } from '@/components/DwellaLogo';
import { useTheme } from '@/lib/theme-context';

interface Props {
  dark?: boolean;
}

export function DwellaHeaderTitle({ dark = false }: Props) {
  const { colors } = useTheme();
  return <DwellaLogo width={180} height={44} color={dark ? colors.textPrimary : '#fff'} />;
}
