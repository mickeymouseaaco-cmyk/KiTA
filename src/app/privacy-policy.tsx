import { LegalPage } from '@/components/legal-page';
import { PRIVACY_POLICY } from '@/lib/legal';

export default function PrivacyPolicy() {
  return <LegalPage testID="privacy-policy" title="Privacy policy" sections={PRIVACY_POLICY} />;
}
