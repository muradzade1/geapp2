import { useEffect, useState } from 'react';
import { Briefcase, CalendarClock, ExternalLink, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Job = {
  id: string;
  title: string;
  organization: string | null;
  location: string | null;
  category: string | null;
  deadline: string | null;
  url: string;
  summary: string | null;
  created_at: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
function fmt(value: string): string {
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Gənc üçün: nazirliyin uyğun hesab etdiyi vakansiyalar. Müraciət elanın öz saytında edilir. */
export default function JobsFeedPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc('job_postings_feed').then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setJobs((data as Job[]) ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900">Vakansiyalar</h1>
      <p className="mt-1 text-sm text-gray-500">Gənclər üçün seçilmiş iş, təcrübə və karyera imkanları. Müraciət elanın öz saytında edilir.</p>

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="mt-6 text-sm text-gray-500">Yüklənir...</p>}
      {!loading && jobs.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <Briefcase className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Hazırda elan yoxdur. Yeni vakansiyalar əlavə olunanda bildiriş alacaqsınız.</p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {jobs.map(job => (
          <div key={job.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-gray-900">{job.title}</p>
            {job.organization && <p className="text-sm text-gray-600">{job.organization}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              {job.category && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{job.category}</span>}
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {job.location}
                </span>
              )}
              {job.deadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={12} /> Son tarix: {fmt(job.deadline)}
                </span>
              )}
            </div>
            {job.summary && <p className="mt-2 text-sm text-gray-700">{job.summary}</p>}
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <ExternalLink size={15} /> Mənbəyə get və müraciət et
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
