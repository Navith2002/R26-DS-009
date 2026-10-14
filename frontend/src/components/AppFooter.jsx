import logo from '../assets/bhasha-logo.webp';
import { useApp } from '../context/useApp';

// Compact site footer: logo, project title and credits on one line.
export default function AppFooter() {
  const { t } = useApp();
  return (
    <footer className="app-footer">
      <img className="app-footer-logo" src={logo} alt={t('account.brand')} />
      <p className="app-footer-project">Early Literacy Monitoring through Handwriting Analysis and Reading-Writing Skill Enhancement in Sinhala and Tamil Languages</p>
      <p className="app-footer-credit">© 2026 Bhasha Research Group · SLIIT · R26-DS-009</p>
    </footer>
  );
}
