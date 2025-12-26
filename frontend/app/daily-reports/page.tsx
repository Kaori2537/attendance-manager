"use client";

import { useDailyReports } from "./hooks/useDailyReports";

export default function DailyReportsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, loading, error } = useDailyReports(year, month);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>日報一覧</h1>

      {data.length === 0 && <p>日報はまだありません</p>}

      <ul>
        {data.map((report) => (
          <li key={report.id} style={{ marginBottom: 16 }}>
            <strong>{report.reportDate}</strong>
            <div>{report.content}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
