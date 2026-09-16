import { DesktopShell } from './DesktopShell'
import { MobileShell } from './MobileShell'
import { useAppExperience } from '../../lib/experience'

export function AppShell() {
  const experience = useAppExperience()
  return experience === 'desktop' ? <DesktopShell /> : <MobileShell />
}
