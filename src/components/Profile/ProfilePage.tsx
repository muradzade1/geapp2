import { useMemo, useState, useEffect } from 'react';
import { DeleteAccountCard } from './DeleteAccountCard';
import { User, Mail, Phone, MapPin, CalendarDays, CreditCard, Pencil, Save, X, Trophy, Award, Calendar, GraduationCap, MessageSquare, Lock, Star, Compass, Heart, Crown, BookOpen, Shield, TrendingUp, ArrowUp, ArrowDown, QrCode, Gift, ScrollText, MessagesSquare, ChevronRight, CheckCircle2, Map, Repeat, Building2, CalendarHeart, CalendarCheck, HandHeart, Users, HeartHandshake, Mic, Cpu, BadgeCheck, ClipboardCheck, Leaf, Sprout, Dumbbell, HeartPulse, Trophy as TrophyIcon, UserCheck, Sparkles } from 'lucide-react';

import { useYouthStats } from '../../lib/api/stats';
import { useMyVisits } from '../../lib/api/stats';
import { formatDuration, dateClock, clock } from '../../lib/api/stats';
import { supabase } from '../../lib/supabase';

type BadgeRow = {
  id: string;
  name: string;
  description: string | null;
  condition_text: string | null;
  category: string;
  icon: string | null;
  target: number;
  progress: number;
  unlocked: boolean;
  unlocked_at: string | null;
};

type GencKartRow = {
  id: string;
  used_at: string;
  genc_kart_partners: { name: string; discount: number } | null;
};

/** İstifadəçinin GəncKart endirimlərindən istifadəsi. */
function useMyGencKart(limit = 30) {
  const [rows, setRows] = useState<GencKartRow[]>([]);

  useEffect(() => {
    let active = true;
    void supabase
      .from('genc_kart_usages')
      .select('id, used_at, genc_kart_partners(name, discount)')
      .order('used_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (active && !error) setRows((data as unknown as GencKartRow[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return rows;
}

type FeedbackRow = {
  id: string;
  created_at: string;
  content_rating: number;
  instructor_rating: number;
  equipment_rating: number;
  events: { title: string } | null;
};

/** İstifadəçinin tədbirlərə verdiyi rəylər. */
function useMyFeedback(limit = 30) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);

  useEffect(() => {
    let active = true;
    void supabase
      .from('feedback')
      .select('id, created_at, content_rating, instructor_rating, equipment_rating, events(title)')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (active && !error) setRows((data as unknown as FeedbackRow[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return rows;
}

/** İstifadəçinin nişanları və irəliləyişi. */
function useMyBadges() {
  const [rows, setRows] = useState<BadgeRow[]>([]);

  useEffect(() => {
    let active = true;
    void supabase.rpc('sync_my_badges').then(() =>
      supabase.rpc('my_badges').then(({ data, error }) => {
        if (active && !error) setRows((data as BadgeRow[]) ?? []);
      }),
    );
    return () => {
      active = false;
    };
  }, []);

  return rows;
}


type PointRow = {
  id: string;
  amount: number;
  activity: string;
  source: string;
  created_at: string;
};

/** İstifadəçinin xal jurnalı — həm qazanılan, həm xərclənən. */
function useMyPointHistory(limit = 30) {
  const [rows, setRows] = useState<PointRow[]>([]);

  useEffect(() => {
    let active = true;
    void supabase
      .from('point_transactions')
      .select('id, amount, activity, source, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (active && !error) setRows((data as PointRow[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return rows;
}
import { fullName, useProfile } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import type { Badge } from '../../types';
import AllBadgesModal from './AllBadgesModal';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Star, Compass, Calendar, Heart, Crown, MessageSquare, BookOpen, Shield,
  Map, Repeat, Building2, CalendarHeart, QrCode, CalendarCheck, HandHeart, Users,
  HeartHandshake, GraduationCap, Mic, Cpu, ScrollText, MessagesSquare, BadgeCheck,
  ClipboardCheck, Leaf, Sprout, Dumbbell, HeartPulse, TrophyIcon, UserCheck, Sparkles,
};

function getBadgeIcon(iconName: string) {
  return iconMap[iconName] ?? Award;
}






type TabKey = 'activity' | 'qr' | 'genckart' | 'feedback';

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'activity', label: 'Son fəaliyyətlər', icon: CalendarDays },
  { key: 'qr', label: 'QR tarixçəsi', icon: QrCode },
  { key: 'genckart', label: 'GəncKart istifadəsi', icon: CreditCard },
  { key: 'feedback', label: 'Rəy tarixçəsi', icon: MessagesSquare },
];

export function ProfilePage() {
  const { profile, avatarUrl, refresh } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('activity');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: fullName(profile),
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    city: profile?.city ?? '',
  });
  useMemo(() => {
    setFormData({
      fullName: fullName(profile),
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      city: profile?.city ?? '',
    });
  }, [profile?.id, profile?.first_name, profile?.last_name, profile?.email, profile?.phone, profile?.city]);

  const { stats: youthStats } = useYouthStats();
  const { visits: myVisits } = useMyVisits(25);
  const pointHistory = useMyPointHistory(30);
  const badges = useMyBadges();
  const gencKartUsage = useMyGencKart(30);
  const feedbackHistory = useMyFeedback(30);

  const points = youthStats.points;
  const pointsGoal = youthStats.level?.next_at ?? 1000;
  const pointsGoalProgress = Math.min(100, Math.round((points / pointsGoal) * 100));
  const pointsGoalRemaining = Math.max(0, pointsGoal - points);
  const memberId = profile?.id ? profile.id.slice(0, 8).toUpperCase() : '—';
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('az-AZ') : '—';

  const featuredBadges = useMemo(() => {
    const unlocked = badges.filter((b) => b.unlocked);
    const locked = badges
      .filter((b) => !b.unlocked)
      .sort((a, b) => b.progress / b.target - a.progress / a.target);
    return [...unlocked, ...locked].slice(0, 8);
  }, []);

  const unlockedBadgeCount = badges.filter((b) => b.unlocked).length;
  const stats = [
    { label: 'Toplam xal', value: String(youthStats.points), icon: Trophy, bg: 'bg-amber-50', textColor: 'text-amber-700', iconColor: 'text-amber-600' },
    { label: 'Ziyarət sayı', value: String(youthStats.visit_count), icon: MapPin, bg: 'bg-blue-50', textColor: 'text-blue-700', iconColor: 'text-blue-600' },
    { label: 'Tədbirlər', value: String(youthStats.events_attended), icon: Calendar, bg: 'bg-rose-50', textColor: 'text-rose-700', iconColor: 'text-rose-600' },
    { label: 'Çağırışlar', value: String(youthStats.challenges_completed), icon: GraduationCap, bg: 'bg-pink-50', textColor: 'text-pink-700', iconColor: 'text-pink-600' },
    { label: 'Nişanlar', value: String(youthStats.badges), icon: MessageSquare, bg: 'bg-teal-50', textColor: 'text-teal-700', iconColor: 'text-teal-600' },
    { label: 'Nişanlar', value: `${unlockedBadgeCount} / ${badges.length}`, icon: Award, bg: 'bg-emerald-50', textColor: 'text-emerald-700', iconColor: 'text-emerald-600' },
  ];

  const personalFields = [
    { key: 'fullName', label: 'Ad, soyad', icon: User, value: formData.fullName },
    { key: 'email', label: 'E-poçt', icon: Mail, value: formData.email },
    { key: 'phone', label: 'Telefon', icon: Phone, value: formData.phone },
    { key: 'city', label: 'Şəhər', icon: MapPin, value: formData.city },
  ];

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const [firstName, ...rest] = formData.fullName.trim().split(/\s+/);
    await supabase.from('profiles').update({
      first_name: firstName ?? '',
      last_name: rest.join(' '),
      phone: formData.phone,
      city: formData.city,
    }).eq('id', profile.id);
    await refresh();
    setSaving(false);
    setIsEditing(false);
  }

  function handleCancel() {
    setFormData({
      fullName: fullName(profile),
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      city: profile?.city ?? '',
    });
    setIsEditing(false);
  }



  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Şəxsi kabinet</h1>
          <p className="text-gray-500 mt-1">
            Şəxsi məlumatlarınızı, xallarınızı və fəaliyyətlərinizi idarə edin
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile card */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 h-28" />
              <div className="px-6 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-5 -mt-12">
                  <div className="relative shrink-0">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-emerald-100 text-3xl font-bold text-emerald-700 shadow-md">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (fullName(profile) === '—' ? '?' : fullName(profile).charAt(0).toUpperCase())}
                    </div>
                    <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white shadow hover:bg-emerald-700" title="Şəkli dəyiş">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file || !profile) return;
                        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                        const path = `${profile.id}/avatar-${Date.now()}.${extension}`;
                        const { error } = await supabase.storage.from('account-photos').upload(path, file, { upsert: true, contentType: file.type });
                        if (!error) {
                          await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id);
                          await refresh();
                        }
                      }} />
                    </label>
                  </div>
                  <div className="flex-1 pt-2 sm:pt-6">
                    <h2 className="text-xl font-bold text-gray-900">{fullName(profile)}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                        <Trophy className="w-3 h-3" />
                        {points} xal
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                        <CreditCard className="w-3 h-3" />
                        {memberId}
                      </span>
                    </div>
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                      Redaktə et
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        Yadda saxla
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                      >
                        <X className="h-4 w-4" />
                        Ləğv et
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Şəxsi məlumatlar
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {personalFields.map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <Icon className="h-3.5 w-3.5" />
                          {field.label}
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                          />
                        ) : (
                          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">{field.value}</p>
                        )}
                      </div>
                    );
                  })}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Qoşulma tarixi
                    </label>
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">{joinDate}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <CreditCard className="h-3.5 w-3.5" />
                      Üzvlük nömrəsi
                    </label>
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 font-mono">
                      {memberId}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Tabs */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-5">
                {activeTab === 'activity' && (
                  <div className="space-y-2.5">
                    {pointHistory.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Hələ fəaliyyət yoxdur
                      </p>
                    )}
                    {pointHistory.map((tx) => {
                      const isEarned = tx.amount > 0;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isEarned ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                              {isEarned
                                ? <ArrowUp className="h-4 w-4 text-emerald-600" />
                                : <ArrowDown className="h-4 w-4 text-rose-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{tx.activity}</p>
                              <p className="text-xs text-gray-400">{dateClock(tx.created_at)}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 text-sm font-bold ${isEarned ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isEarned ? '+' : ''}{tx.amount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'qr' && (
                  <div className="space-y-2.5">
                    {myVisits.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-6">QR tarixçəsi yoxdur</p>
                    )}
                    {myVisits.map((visit) => (
                      <div key={visit.visit_id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <QrCode className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {visit.house_name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {dateClock(visit.entered_at)}
                              {visit.exited_at ? ` → ${clock(visit.exited_at)}` : ' · davam edir'}
                              {' · '}
                              {formatDuration(visit.duration_seconds)}
                            </p>
                          </div>
                        </div>
                        {visit.exited_at === null && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            İçəridə
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'genckart' && (
                  <div className="space-y-2.5">
                    {gencKartUsage.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Hələ GəncKart istifadəsi yoxdur
                      </p>
                    )}
                    {gencKartUsage.map((g) => (
                      <div key={g.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {g.genc_kart_partners?.name ?? 'Partnyor'}
                            </p>
                            <p className="text-xs text-gray-400">{dateClock(g.used_at)}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 shrink-0 ml-3">
                          {g.genc_kart_partners?.discount ?? 0}% endirim
                        </span>
                      </div>
                    ))}
                  </div>
                )}


                {activeTab === 'feedback' && (
                  <div className="space-y-2.5">
                    {feedbackHistory.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Hələ rəy bildirməmisiniz
                      </p>
                    )}
                    {feedbackHistory.map((f) => {
                      const score = Math.round(
                        ((f.content_rating + f.instructor_rating + f.equipment_rating) / 3) * 10,
                      ) / 10;
                      return (
                        <div key={f.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
                              <MessagesSquare className="w-4 h-4 text-pink-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {f.events?.title ?? 'Tədbir'}
                              </p>
                              <p className="text-xs text-gray-400">{dateClock(f.created_at)}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600 shrink-0 ml-3">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {score}/10
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Stats */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Sizin statistikanız
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className={`rounded-xl ${stat.bg} p-3`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                        <p className="text-xs text-gray-500">{stat.label}</p>
                      </div>
                      <p className={`text-lg font-bold ${stat.textColor}`}>{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Points Goal */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-500" />
                Xal hədəfi
              </h2>
              <div className="relative h-3 overflow-hidden rounded-full bg-gray-100 mb-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                  style={{ width: `${pointsGoalProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>{points} xal</span>
                <span>{pointsGoal} xal</span>
              </div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-xs text-emerald-800 leading-relaxed">
                  <span className="font-bold">{pointsGoal}</span> xala çatmaq üçün daha{' '}
                  <span className="font-bold">{pointsGoalRemaining} xal</span> lazımdır
                </p>
              </div>
            </section>

            {/* Featured Badges */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Nişanlarınız
                </h2>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                  {badges.filter((b) => b.unlocked).length} / {badges.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {featuredBadges.map((badge: Badge) => {
                  const Icon = getBadgeIcon(badge.icon);
                  return (
                    <div
                      key={badge.id}
                      className={`relative rounded-xl border p-3 text-center transition-all ${
                        badge.unlocked
                          ? 'border-amber-200 bg-gradient-to-b from-amber-50 to-white'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {!badge.unlocked && (
                        <Lock className="absolute top-2 right-2 h-3 w-3 text-gray-400" />
                      )}
                      {badge.unlocked && (
                        <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-emerald-500" />
                      )}
                      <div
                        className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${
                          badge.unlocked
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm shadow-amber-200'
                            : 'bg-gray-200'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${badge.unlocked ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <p className={`text-xs font-semibold leading-tight ${badge.unlocked ? 'text-gray-900' : 'text-gray-600'}`}>
                        {badge.name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-snug">
                        {badge.condition}
                      </p>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowAllBadges(true)}
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl px-4 py-2.5 transition-colors"
              >
                Bütün nişanlara bax
                <ChevronRight className="w-4 h-4" />
              </button>
            </section>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        <DeleteAccountCard />
      </div>

      {showAllBadges && (
        <AllBadgesModal badges={badges} onClose={() => setShowAllBadges(false)} />
      )}
    </div>
  );
}
