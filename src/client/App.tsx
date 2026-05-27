import { useState, useEffect, type CSSProperties } from 'react';

type Tab = 'overview' | 'rules' | 'team' | 'calibrations';

interface AlignmentData {
  overallScore: string;
  status: string;
  totalDecisions: string;
  lastComputed: string;
}

interface ModProfile {
  username: string;
  totalActions: string;
  removes: string;
  approves: string;
  bans: string;
  lastActive: string;
}

interface Calibration {
  modA: string;
  actionA: string;
  modB: string;
  actionB: string;
  contentPreview: string;
  timestamp: string;
}

export function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [alignment, setAlignment] = useState<AlignmentData | null>(null);
  const [team, setTeam] = useState<ModProfile[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [loading, setLoading] = useState(true);

  // Add streak tracking
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadData();
    loadStreak();
  }, []);

  async function loadStreak() {
    try {
      const res = await fetch('/api/streak');
      const data = await res.json();
      setStreak(data.streak || 0);
    } catch { /* skip */ }
  }

  async function loadData() {
    try {
      const [alignRes, teamRes, calRes] = await Promise.all([
        fetch('/api/alignment'),
        fetch('/api/team'),
        fetch('/api/calibrations'),
      ]);
      setAlignment(await alignRes.json());
      const teamData = await teamRes.json();
      setTeam(teamData.team || []);
      const calData = await calRes.json();
      setCalibrations(calData.calibrations || []);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner}>🧠</div>
        <p style={styles.loadingText}>Loading BeHive...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>🐝</span>
          <h1 style={styles.title}>BeHive</h1>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.scoreBadge}>
            <span style={styles.scoreValue}>{alignment?.overallScore || '0'}%</span>
            <span style={styles.scoreLabel}>aligned</span>
          </div>
        </div>
      </header>

      <nav style={styles.tabBar}>
        {(['overview', 'rules', 'team', 'calibrations'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
          >
            {t === 'overview' && '📊'}
            {t === 'rules' && '📏'}
            {t === 'team' && '👥'}
            {t === 'calibrations' && '🚩'}
            <span style={styles.tabText}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === 'overview' && <OverviewTab alignment={alignment} team={team} calibrations={calibrations} streak={streak} />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'team' && <TeamTab team={team} />}
        {tab === 'calibrations' && <CalibrationsTab calibrations={calibrations} />}
      </main>
    </div>
  );
}

function OverviewTab({ alignment, team, calibrations, streak }: {
  alignment: AlignmentData | null;
  team: ModProfile[];
  calibrations: Calibration[];
  streak: number;
}) {
  const score = parseInt(alignment?.overallScore || '0');
  const status = alignment?.status || 'learning';
  const totalDecisions = alignment?.totalDecisions || '0';

  return (
    <div style={styles.tabContent}>
      {status === 'learning' ? (
        <div style={styles.card}>
          <div style={styles.cardIcon}>🌱</div>
          <h2 style={styles.cardTitle}>BeHive is Learning</h2>
          <p style={styles.cardText}>
            BeHive watches every approve, remove, and ban your team makes.
            After 10+ decisions, it starts showing patterns.
          </p>
          <div style={{...styles.cardText, marginTop: '12px', textAlign: 'left' as const, background: '#1a1a2e', padding: '12px', borderRadius: '8px', fontSize: '13px'}}>
            <strong style={{color: '#4ecdc4'}}>How to use BeHive:</strong><br/><br/>
            1. Moderate normally (approve/remove posts)<br/>
            2. Right-click any post → "See Team Precedent"<br/>
            3. Check this dashboard for your alignment score<br/>
            4. Watch for disagreement alerts between mods<br/><br/>
            <em>Currently: {totalDecisions} decisions from {team.length} mods</em>
          </div>
        </div>
      ) : (
        <>
          <div style={styles.scoreCard}>
            <div style={styles.bigScore}>{score}%</div>
            <div style={styles.scoreDesc}>Team Alignment</div>
            <div style={styles.scoreMeta}>
              Based on {totalDecisions} decisions from {team.length} mods
            </div>
            <div style={{ ...styles.scoreBar, background: '#2a2a4a' }}>
              <div style={{
                ...styles.scoreBarFill,
                width: `${score}%`,
                background: score > 80 ? '#4ecdc4' : score > 60 ? '#f9ca24' : '#ff6b6b',
              }} />
            </div>
          </div>

          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{team.length}</div>
              <div style={styles.statLabel}>Active Mods</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{totalDecisions}</div>
              <div style={styles.statLabel}>Decisions</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{calibrations.length}</div>
              <div style={styles.statLabel}>Calibrations</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{streak > 0 ? `🔥${streak}` : '—'}</div>
              <div style={styles.statLabel}>Streak (hrs)</div>
            </div>
          </div>
        </>
      )}

      {calibrations.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Recent Calibration Moments</h3>
          {calibrations.slice(0, 3).map((cal, i) => (
            <div key={i} style={styles.calibrationCard}>
              <div style={styles.calBadge}>⚡ Disagreement</div>
              <div style={styles.calContent}>
                <strong>{cal.modA}</strong> chose <span style={styles.actionBadge}>{cal.actionA}</span>
                {' but '}
                <strong>{cal.modB}</strong> chose <span style={styles.actionBadge}>{cal.actionB}</span>
              </div>
              {cal.contentPreview && (
                <div style={styles.calPreview}>"{cal.contentPreview.substring(0, 80)}..."</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesTab() {
  const [rules, setRules] = useState<any>(null);

  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then(setRules).catch(() => {});
  }, []);

  if (!rules) return <div style={styles.center}><p>Loading rules...</p></div>;

  const ruleList = rules.rules || [];

  if (ruleList.length === 0) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.card}>
          <div style={styles.cardIcon}>📏</div>
          <h2 style={styles.cardTitle}>No Rules Found</h2>
          <p style={styles.cardText}>
            Add rules to your subreddit to see how your team interprets them.
            BeHive will track which rules cause the most disagreements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <h3 style={styles.sectionTitle}>Rule Clarity Scores</h3>
      <p style={styles.sectionDesc}>How consistently does your team interpret each rule?</p>
      {ruleList.map((rule: any, i: number) => {
        const interpretation = rules.interpretations?.[`rule_${i}`];
        return (
          <div key={i} style={styles.ruleCard}>
            <div style={styles.ruleName}>Rule {i + 1}: {rule.shortName || rule.violationReason || 'Unnamed'}</div>
            {interpretation ? (
              <div style={styles.ruleInterp}>🤖 {interpretation}</div>
            ) : (
              <div style={styles.ruleNoData}>Needs more decisions to generate interpretation</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TeamTab({ team }: { team: ModProfile[] }) {
  if (team.length === 0) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.card}>
          <div style={styles.cardIcon}>👥</div>
          <h2 style={styles.cardTitle}>Building Team Profiles</h2>
          <p style={styles.cardText}>
            As mods take actions, their profiles appear here showing patterns and alignment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <h3 style={styles.sectionTitle}>Mod Team ({team.length})</h3>
      {team.map((mod, i) => {
        const total = parseInt(mod.totalActions || '0');
        const removes = parseInt(mod.removes || '0');
        const approves = parseInt(mod.approves || '0');
        const removeRate = total > 0 ? Math.round((removes / total) * 100) : 0;

        return (
          <div key={i} style={styles.modCard}>
            <div style={styles.modHeader}>
              <span style={styles.modName}>u/{mod.username}</span>
              <span style={styles.modTotal}>{total} actions</span>
            </div>
            <div style={styles.modStats}>
              <span style={styles.modStat}>✅ {approves} approved</span>
              <span style={styles.modStat}>❌ {removes} removed</span>
              <span style={styles.modStat}>🚫 {mod.bans || '0'} banned</span>
            </div>
            <div style={styles.modBar}>
              <div style={{ ...styles.modBarFill, width: `${removeRate}%`, background: '#ff6b6b' }} />
              <div style={{ ...styles.modBarFill, width: `${100 - removeRate}%`, background: '#4ecdc4' }} />
            </div>
            <div style={styles.modBarLabel}>
              {removeRate}% removal rate
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalibrationsTab({ calibrations }: { calibrations: Calibration[] }) {
  if (calibrations.length === 0) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.card}>
          <div style={styles.cardIcon}>🎯</div>
          <h2 style={styles.cardTitle}>No Calibration Moments Yet</h2>
          <p style={styles.cardText}>
            When two mods handle similar content differently, it appears here.
            These are opportunities to align as a team without meetings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <h3 style={styles.sectionTitle}>Calibration Moments ({calibrations.length})</h3>
      <p style={styles.sectionDesc}>Cases where mods disagreed on similar content</p>
      {calibrations.map((cal, i) => (
        <div key={i} style={styles.calibrationCard}>
          <div style={styles.calBadge}>⚡ Disagreement</div>
          <div style={styles.calContent}>
            <strong>{cal.modA}</strong> → <span style={styles.actionBadge}>{cal.actionA}</span>
            {' vs '}
            <strong>{cal.modB}</strong> → <span style={styles.actionBadge}>{cal.actionB}</span>
          </div>
          {cal.contentPreview && (
            <div style={styles.calPreview}>"{cal.contentPreview.substring(0, 120)}"</div>
          )}
          <div style={styles.calTime}>
            {new Date(parseInt(cal.timestamp)).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// Styles
const styles: Record<string, CSSProperties> = {
  container: { minHeight: '100vh', background: '#1a1a2e' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' },
  spinner: { fontSize: '48px', animation: 'pulse 2s infinite' },
  loadingText: { color: '#888', fontSize: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #2a2a4a' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerRight: {},
  logo: { fontSize: '28px' },
  title: { fontSize: '20px', fontWeight: '700', color: '#fff' },
  scoreBadge: { textAlign: 'right' as const },
  scoreValue: { fontSize: '22px', fontWeight: '800', color: '#4ecdc4', display: 'block' },
  scoreLabel: { fontSize: '11px', color: '#888' },
  tabBar: { display: 'flex', borderBottom: '1px solid #2a2a4a', padding: '0 12px', overflowX: 'auto' as const },
  tab: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px', padding: '12px 8px', background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.2s' },
  tabActive: { color: '#4ecdc4', borderBottomColor: '#4ecdc4' },
  tabText: { fontSize: '11px', fontWeight: '500' },
  main: { padding: '16px 20px', overflowY: 'auto' as const },
  tabContent: {},
  card: { background: '#2a2a4a', borderRadius: '12px', padding: '24px', textAlign: 'center' as const, marginBottom: '16px' },
  cardIcon: { fontSize: '48px', marginBottom: '12px' },
  cardTitle: { fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '8px' },
  cardText: { fontSize: '14px', color: '#888', lineHeight: '1.6' },
  scoreCard: { background: '#2a2a4a', borderRadius: '12px', padding: '24px', textAlign: 'center' as const, marginBottom: '16px' },
  bigScore: { fontSize: '56px', fontWeight: '800', color: '#4ecdc4' },
  scoreDesc: { fontSize: '14px', color: '#ccc', marginTop: '4px' },
  scoreMeta: { fontSize: '12px', color: '#666', marginTop: '8px' },
  scoreBar: { height: '8px', borderRadius: '4px', marginTop: '16px', overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: '4px', transition: 'width 0.5s' },
  statsRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
  statCard: { flex: 1, background: '#2a2a4a', borderRadius: '10px', padding: '16px', textAlign: 'center' as const },
  statValue: { fontSize: '24px', fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: '11px', color: '#888', marginTop: '4px' },
  section: { marginTop: '20px' },
  sectionTitle: { fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  sectionDesc: { fontSize: '12px', color: '#888', marginBottom: '12px' },
  calibrationCard: { background: '#2a2a4a', borderRadius: '10px', padding: '14px', marginBottom: '10px', borderLeft: '3px solid #ff6b6b' },
  calBadge: { fontSize: '11px', color: '#ff6b6b', fontWeight: '600', marginBottom: '6px' },
  calContent: { fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' },
  calPreview: { fontSize: '12px', color: '#666', fontStyle: 'italic', marginTop: '6px' },
  calTime: { fontSize: '11px', color: '#555', marginTop: '6px' },
  actionBadge: { background: '#3a3a5a', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  ruleCard: { background: '#2a2a4a', borderRadius: '10px', padding: '14px', marginBottom: '10px' },
  ruleName: { fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '6px' },
  ruleInterp: { fontSize: '13px', color: '#4ecdc4', lineHeight: '1.4' },
  ruleNoData: { fontSize: '12px', color: '#666', fontStyle: 'italic' },
  modCard: { background: '#2a2a4a', borderRadius: '10px', padding: '14px', marginBottom: '10px' },
  modHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  modName: { fontSize: '14px', fontWeight: '600', color: '#fff' },
  modTotal: { fontSize: '12px', color: '#888' },
  modStats: { display: 'flex', gap: '12px', fontSize: '12px', color: '#aaa', marginBottom: '8px' },
  modStat: {},
  modBar: { display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden' },
  modBarFill: { height: '100%' },
  modBarLabel: { fontSize: '11px', color: '#666', marginTop: '4px' },
};
