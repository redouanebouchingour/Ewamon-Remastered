/** `/` (SPEC §20.1.1): the front door. The loader redirects to /play when a refresh token exists. */
import { Link } from 'react-router';
import { DEX_TOTAL } from '../data/content';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/Icon';
import { KeyArt } from '../ui/KeyArt';
import s from './LandingPage.module.css';

const PILLARS: readonly { readonly icon: IconName; readonly title: string; readonly text: string }[] = [
  { icon: 'eye', title: `Witness all ${DEX_TOTAL}`, text: 'Every creature you record stays recorded. Nothing is quietly lost.' },
  { icon: 'party', title: 'One shared grove', text: 'Explore, battle and trade alongside every trainer who is online.' },
  { icon: 'shield', title: 'Fair by design', text: 'The server decides every catch, badge and coin. No shortcuts.' },
];

export function LandingPage() {
  return (
    <div className={s.page} data-testid="landing">
      <KeyArt />
      <header className={s.top}>
        <span className={s.logo}>
          <span className={s.mark} aria-hidden>
            <Icon name="leaf" size="sm" />
          </span>
          Ewamon
        </span>
        <Link to="/login" className={s.topLink}>
          Log in
        </Link>
      </header>
      <main className={s.hero}>
        <p className={s.eyebrow}>Remastered · Mirevale awaits</p>
        <h1 className={s.title}>
          The grove remembers
          <br />
          what you record.
        </h1>
        <p className={s.lede}>
          A living world of creatures shared with every trainer online. Walk the veins of Mirevale, earn eight badges, and keep a record
          no one can take from you.
        </p>
        <div className={s.ctas}>
          <Link to="/register" className={s.primary}>
            Begin your journey
            <Icon name="chevronRight" size="sm" />
          </Link>
          <Link to="/login" className={s.secondary}>
            I already have an account
          </Link>
        </div>
        <ul className={s.pillars}>
          {PILLARS.map((p) => (
            <li key={p.title} className={s.pillar}>
              <span className={s.pillarIcon} aria-hidden>
                <Icon name={p.icon} />
              </span>
              <div>
                <p className={s.pillarTitle}>{p.title}</p>
                <p className={s.pillarText}>{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
