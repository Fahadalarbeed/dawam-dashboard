'use client';
import ComplaintsPage from '../complaints/page';

// Same screen, stats-only view: category cards, charts, repeated outages,
// area filters and the monthly technician table — without the complaints search.
export default function StatsPage() {
  return <ComplaintsPage mode="stats" />;
}
