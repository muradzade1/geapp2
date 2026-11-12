import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Ban, Flag, Info, Loader2, MessageCircle, Plus, Send, ShieldAlert, Trash2, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { refreshChatUnread } from './ChatNavIcon';

type Conversation = {
  id: string;
  kind: 'house' | 'group' | 'dm';
  title: string;
  last_body: string | null;
  last_at: string | null;
  unread: number;
  member_count: number;
};

type Message = {
  id: string;
  user_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
  mine: boolean;
  sender_muted: boolean;
};

type Contact = { user_id: string; name: string; role: string };
type HouseOption = { house_id: string; house_name: string };
type Report = {
  id: string;
  conv_kind: 'house' | 'group' | 'dm';
  reporter_name: string;
  reported_user_id: string;
  reported_name: string;
  body: string;
  message_created_at: string;
  reason: string | null;
  status: string;
  created_at: string;
  reported_muted: boolean;
};

type Panel = 'list' | 'thread' | 'new-dm' | 'new-group' | 'info' | 'reports';

const ROLE_LABEL: Record<string, string> = { youth_house: 'Rəhbər', trainer: 'Təlimçi', admin: 'Admin', youth: '' };
const pad = (n: number) => String(n).padStart(2, '0');

function timeLabel(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? hm : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${hm}`;
}

interface Props {
  /** Verilərsə yalnız bu mərkəzin çatı açılır; verilməzsə istifadəçinin mərkəzləri siyahısı göstərilir. */
  houseId?: string | null;
}

/**
 * Mərkəz çatı: ümumi otaq, qruplar və gənclər arasında şəxsi yazışma.
 * Şəxsi yazışmanı və qrupu yalnız iştirakçılar görür.
 */
export function HouseChat({ houseId }: Props) {
  const [houses, setHouses] = useState<HouseOption[]>([]);
  const [house, setHouse] = useState<string | null>(houseId ?? null);
  const [role, setRole] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  const isStaff = role === 'manager' || role === 'trainer';
  const isManager = role === 'manager' || role === 'admin';

  useEffect(() => {
    if (houseId) {
      setHouse(houseId);
      return;
    }
    void supabase.rpc('chat_my_house_ids').then(({ data, error: err }) => {
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const list = (data as HouseOption[]) ?? [];
      setHouses(list);
      setHouse(prev => prev ?? list[0]?.house_id ?? null);
      if (list.length === 0) setLoading(false);
    });
  }, [houseId]);

  useEffect(() => {
    if (!house) return;
    setPanel('list');
    setActive(null);
    void supabase.rpc('chat_my_role', { p_house: house }).then(({ data }) => setRole((data as string | null) ?? null));
  }, [house]);

  const loadConversations = useCallback(async () => {
    if (!house) return;
    const { data, error: err } = await supabase.rpc('chat_list_conversations', { p_house: house });
    if (err) setError(err.message);
    else setConversations((data as Conversation[]) ?? []);
    setLoading(false);
  }, [house]);

  const loadMessages = useCallback(async () => {
    if (!active) return;
    const { data, error: err } = await supabase.rpc('chat_messages_list', { p_conv: active.id, p_limit: 100 });
    if (err) {
      setError(err.message);
      return;
    }
    setMessages(((data as Message[]) ?? []).slice().reverse());
    void supabase.rpc('chat_mark_read', { p_conv: active.id }).then(() => refreshChatUnread());
  }, [active]);

  // Siyahı: hər 8 saniyədən bir
  useEffect(() => {
    if (!house || panel !== 'list') return;
    void loadConversations();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadConversations();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [house, panel, loadConversations]);

  // Söhbət: hər 4 saniyədən bir
  useEffect(() => {
    if (panel !== 'thread' || !active) return;
    stickToBottom.current = true;
    void loadMessages();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMessages();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [panel, active, loadMessages]);

  useEffect(() => {
    if (panel === 'thread' && stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, panel]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const openConversation = (conv: Conversation) => {
    setError(null);
    setMessages([]);
    setActive(conv);
    setPanel('thread');
  };

  const closeThread = () => {
    setPanel('list');
    setActive(null);
    setError(null);
    void loadConversations();
  };

  const loadContacts = async () => {
    if (!house) return;
    const { data, error: err } = await supabase.rpc('chat_contacts', { p_house: house });
    if (err) setError(err.message);
    else setContacts((data as Contact[]) ?? []);
  };

  const openNewDm = async () => {
    setError(null);
    setPanel('new-dm');
    await loadContacts();
  };

  const openNewGroup = async () => {
    setError(null);
    setGroupTitle('');
    setPicked([]);
    setPanel('new-group');
    await loadContacts();
  };

  const startDm = async (contact: Contact) => {
    if (!house) return;
    const { data, error: err } = await supabase.rpc('chat_start_dm', { p_house: house, p_other: contact.user_id });
    if (err) {
      setError(err.message);
      return;
    }
    openConversation({ id: data as string, kind: 'dm', title: contact.name, last_body: null, last_at: null, unread: 0, member_count: 2 });
  };

  const createGroup = async () => {
    if (!house) return;
    if (!groupTitle.trim()) {
      setError('Qrup adını yazın');
      return;
    }
    const { data, error: err } = await supabase.rpc('chat_create_group', { p_house: house, p_title: groupTitle.trim(), p_users: picked });
    if (err) {
      setError(err.message);
      return;
    }
    openConversation({ id: data as string, kind: 'group', title: groupTitle.trim(), last_body: null, last_at: null, unread: 0, member_count: picked.length + 1 });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.rpc('chat_send_msg', { p_conv: active.id, p_body: body });
    if (err) setError(err.message);
    else {
      setText('');
      stickToBottom.current = true;
      await loadMessages();
    }
    setSending(false);
  };

  const removeMessage = async (id: string) => {
    if (!window.confirm('Bu mesaj silinsin?')) return;
    const { error: err } = await supabase.rpc('chat_delete_msg', { p_id: id });
    if (err) setError(err.message);
    else await loadMessages();
  };

  const toggleMute = async (msg: Message) => {
    if (!house) return;
    const question = msg.sender_muted ? `${msg.sender_name} yenidən yaza bilsin?` : `${msg.sender_name} çatda susdurulsun? (heç yerdə yaza bilməyəcək)`;
    if (!window.confirm(question)) return;
    const { error: err } = await supabase.rpc('chat_set_mute', { p_house: house, p_user: msg.user_id, p_mute: !msg.sender_muted });
    if (err) setError(err.message);
    else await loadMessages();
  };

  const openInfo = async () => {
    if (!active) return;
    setError(null);
    const { data, error: err } = await supabase.rpc('chat_group_members', { p_conv: active.id });
    if (err) setError(err.message);
    else setMembers((data as Contact[]) ?? []);
    await loadContacts();
    setPanel('info');
  };

  const addMember = async (userId: string) => {
    if (!active) return;
    const { error: err } = await supabase.rpc('chat_add_member', { p_conv: active.id, p_user: userId });
    if (err) setError(err.message);
    else await openInfo();
  };

  const removeMember = async (userId: string, leaving: boolean) => {
    if (!active) return;
    if (!window.confirm(leaving ? 'Qrupdan çıxmaq istəyirsiniz?' : 'Üzv qrupdan çıxarılsın?')) return;
    const { error: err } = await supabase.rpc('chat_remove_member', { p_conv: active.id, p_user: userId });
    if (err) setError(err.message);
    else if (leaving) closeThread();
    else await openInfo();
  };

  const loadReports = useCallback(async () => {
    if (!house) return;
    const { data, error: err } = await supabase.rpc('chat_reports_list', { p_house: house, p_status: 'open' });
    if (err) setError(err.message);
    else setReports((data as Report[]) ?? []);
  }, [house]);

  const openReports = async () => {
    setError(null);
    setPanel('reports');
    await loadReports();
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    const { error: err } = await supabase.rpc('chat_report_message', { p_id: reportTarget.id, p_reason: reportReason.trim() || null });
    if (err) {
      setError(err.message);
      return;
    }
    setReportTarget(null);
    setReportReason('');
    setError(null);
    setNotice('Şikayət mərkəz rəhbərinə göndərildi. Yazışmanın qalanı ona görünmür.');
    window.setTimeout(() => setNotice(null), 6000);
  };

  const resolveReport = async (rp: Report, deleteMessage: boolean) => {
    if (deleteMessage && !window.confirm('Mesaj silinsin və şikayət bağlansın?')) return;
    const { error: err } = await supabase.rpc('chat_resolve_report', { p_id: rp.id, p_delete_message: deleteMessage });
    if (err) setError(err.message);
    else {
      await loadReports();
      refreshChatUnread();
    }
  };

  const muteFromReport = async (rp: Report) => {
    if (!house) return;
    const question = rp.reported_muted ? `${rp.reported_name} yenidən yaza bilsin?` : `${rp.reported_name} çatda susdurulsun? (heç yerdə yaza bilməyəcək)`;
    if (!window.confirm(question)) return;
    const { error: err } = await supabase.rpc('chat_set_mute', { p_house: house, p_user: rp.reported_user_id, p_mute: !rp.reported_muted });
    if (err) setError(err.message);
    else await loadReports();
  };

  const canDelete = (msg: Message) =>
    msg.mine || (active?.kind === 'house' && isManager) || (active?.kind === 'group' && isStaff);

  if (!loading && !house) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
        Çat yalnız təsdiqlənmiş Gənclər Evinə bağlı olanda açılır.
      </div>
    );
  }

  const shell = 'flex h-[calc(100vh-14rem)] min-h-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm';
  const errorBar = error && <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>;

  const header = (title: string, onBack?: () => void, right?: ReactNode) => (
    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-3">
      {onBack && (
        <button onClick={onBack} aria-label="Geri" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
      )}
      <h3 className="min-w-0 flex-1 truncate font-semibold text-gray-800">{title}</h3>
      {right}
    </div>
  );

  // ---------- Siyahı ----------
  if (panel === 'list') {
    return (
      <div className={shell}>
        {header(
          'Çat',
          undefined,
          <div className="flex items-center gap-2">
            {houses.length > 1 && (
              <select value={house ?? ''} onChange={e => setHouse(e.target.value)} className="max-w-[40vw] rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm">
                {houses.map(h => (
                  <option key={h.house_id} value={h.house_id}>
                    {h.house_name}
                  </option>
                ))}
              </select>
            )}
            {role === 'manager' && (
              <button onClick={() => void openReports()} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                <ShieldAlert size={14} /> Şikayətlər
              </button>
            )}
            {role === 'youth' && (
              <button onClick={() => void openNewDm()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Plus size={14} /> Yazış
              </button>
            )}
            {isStaff && (
              <button onClick={() => void openNewGroup()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Plus size={14} /> Qrup
              </button>
            )}
          </div>,
        )}
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-center text-sm text-gray-500">Yüklənir...</p>}
          {conversations.map(conv => (
            <button key={conv.id} onClick={() => openConversation(conv)} className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                {conv.kind === 'dm' ? <MessageCircle size={18} /> : <Users size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-gray-800">{conv.title}</p>
                  <span className="shrink-0 text-[11px] text-gray-400">{timeLabel(conv.last_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-gray-500">{conv.last_body ?? (conv.kind === 'group' ? `${conv.member_count} üzv` : 'Hələ mesaj yoxdur')}</p>
                  {conv.unread > 0 && <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">{conv.unread}</span>}
                </div>
              </div>
            </button>
          ))}
          {!loading && conversations.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Söhbət yoxdur.</p>}
        </div>
        {errorBar}
      </div>
    );
  }

  // ---------- Yeni şəxsi yazışma ----------
  if (panel === 'new-dm') {
    return (
      <div className={shell}>
        {header('Kiminlə yazışmaq istəyirsiniz?', () => setPanel('list'))}
        <div className="flex-1 overflow-y-auto">
          {contacts.map(c => (
            <button key={c.user_id} onClick={() => void startDm(c)} className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">{c.name.charAt(0)}</div>
              <span className="font-medium text-gray-800">{c.name}</span>
            </button>
          ))}
          {contacts.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Mərkəzdə başqa gənc tapılmadı.</p>}
        </div>
        {errorBar}
      </div>
    );
  }

  // ---------- Yeni qrup ----------
  if (panel === 'new-group') {
    return (
      <div className={shell}>
        {header('Yeni qrup', () => setPanel('list'))}
        <div className="border-b border-gray-100 p-3">
          <input value={groupTitle} onChange={e => setGroupTitle(e.target.value)} maxLength={60} placeholder="Qrupun adı" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map(c => (
            <label key={c.user_id} className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-3 hover:bg-gray-50">
              <input type="checkbox" checked={picked.includes(c.user_id)} onChange={e => setPicked(prev => (e.target.checked ? [...prev, c.user_id] : prev.filter(x => x !== c.user_id)))} />
              <span className="flex-1 text-sm font-medium text-gray-800">{c.name}</span>
              {ROLE_LABEL[c.role] && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">{ROLE_LABEL[c.role]}</span>}
            </label>
          ))}
        </div>
        {errorBar}
        <div className="border-t border-gray-100 p-3">
          <button onClick={() => void createGroup()} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Qrupu yarat ({picked.length} üzv)
          </button>
        </div>
      </div>
    );
  }

  // ---------- Şikayətlər (rəhbər) ----------
  if (panel === 'reports') {
    const kindLabel = { dm: 'Şəxsi yazışma', group: 'Qrup', house: 'Mərkəz çatı' } as const;
    return (
      <div className={shell}>
        {header('Şikayətlər', () => {
          setPanel('list');
          refreshChatUnread();
        })}
        <p className="bg-amber-50 px-4 py-1.5 text-center text-[11px] text-amber-800">Yalnız şikayət olunan mesaj göstərilir, yazışmanın qalanı görünmür.</p>
        <div className="flex-1 overflow-y-auto">
          {reports.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Açıq şikayət yoxdur.</p>}
          {reports.map(rp => (
            <div key={rp.id} className="space-y-1 border-b border-gray-100 px-4 py-3 text-sm">
              <p className="text-xs text-gray-500">
                {kindLabel[rp.conv_kind]} · {timeLabel(rp.created_at)}
              </p>
              <p className="text-gray-800">
                <span className="font-semibold">{rp.reported_name}</span> yazıb: “{rp.body}”
              </p>
              <p className="text-xs text-gray-500">Şikayət edən: {rp.reporter_name}</p>
              {rp.reason && <p className="text-xs italic text-gray-600">Səbəb: {rp.reason}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => void resolveReport(rp, true)} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
                  Mesajı sil və bağla
                </button>
                <button onClick={() => void muteFromReport(rp)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  {rp.reported_muted ? 'Susdurmanı götür' : 'Sustur'}
                </button>
                <button onClick={() => void resolveReport(rp, false)} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  Bağla
                </button>
              </div>
            </div>
          ))}
        </div>
        {errorBar}
      </div>
    );
  }

  // ---------- Qrup məlumatı ----------
  if (panel === 'info' && active) {
    const memberIds = new Set(members.map(m => m.user_id));
    const addable = contacts.filter(c => !memberIds.has(c.user_id));
    return (
      <div className={shell}>
        {header(`${active.title} · üzvlər`, () => setPanel('thread'))}
        <div className="flex-1 overflow-y-auto">
          {members.map(m => (
            <div key={m.user_id} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3">
              <span className="flex-1 text-sm font-medium text-gray-800">
                {m.name} {ROLE_LABEL[m.role] && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">{ROLE_LABEL[m.role]}</span>}
              </span>
              {isStaff && (
                <button onClick={() => void removeMember(m.user_id, false)} aria-label="Çıxar" className="text-gray-400 hover:text-rose-600">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {isStaff && addable.length > 0 && (
            <>
              <p className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase text-gray-500">Əlavə et</p>
              {addable.map(c => (
                <button key={c.user_id} onClick={() => void addMember(c.user_id)} className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50">
                  <UserPlus size={16} className="text-emerald-600" />
                  <span className="text-sm text-gray-800">{c.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
        {errorBar}
        <div className="border-t border-gray-100 p-3">
          <button
            onClick={async () => {
              const { data } = await supabase.auth.getUser();
              if (data.user) await removeMember(data.user.id, true);
            }}
            className="w-full rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            Qrupdan çıx
          </button>
        </div>
      </div>
    );
  }

  // ---------- Söhbət ----------
  return (
    <div className={shell}>
      {header(
        active?.title ?? '',
        closeThread,
        active?.kind === 'group' ? (
          <button onClick={() => void openInfo()} aria-label="Üzvlər" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
            <Info size={18} />
          </button>
        ) : undefined,
      )}
      {active?.kind === 'dm' && <p className="bg-emerald-50 px-4 py-1.5 text-center text-[11px] text-emerald-700">Bu yazışmanı yalnız siz və qarşı tərəf görür.</p>}
      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 px-3 py-3">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Hələ mesaj yoxdur. İlk mesajı siz yazın.</p>}
        {messages.map(msg => {
          const roleLabel = ROLE_LABEL[msg.sender_role] ?? '';
          return (
            <div key={msg.id} className={`flex ${msg.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${msg.mine ? 'bg-emerald-600 text-white' : 'bg-white text-gray-800'}`}>
                {!msg.mine && active?.kind !== 'dm' && (
                  <p className="mb-0.5 text-xs font-semibold text-emerald-700">
                    {msg.sender_name}
                    {roleLabel && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">{roleLabel}</span>}
                    {msg.sender_muted && <span className="ml-1 text-[10px] text-rose-600">(susdurulub)</span>}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${msg.mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                  <span>{timeLabel(msg.created_at)}</span>
                  {canDelete(msg) && (
                    <button onClick={() => void removeMessage(msg.id)} aria-label="Sil" className="opacity-80 hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  )}
                  {!msg.mine && (
                    <button
                      onClick={() => {
                        setReportTarget(msg);
                        setReportReason('');
                        setError(null);
                      }}
                      aria-label="Şikayət et"
                      className="opacity-80 hover:opacity-100"
                    >
                      <Flag size={12} />
                    </button>
                  )}
                  {isManager && !msg.mine && active?.kind === 'house' && (
                    <button onClick={() => void toggleMute(msg)} aria-label="Sustur" className="opacity-80 hover:opacity-100">
                      <Ban size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {errorBar}
      {notice && <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">{notice}</div>}
      {reportTarget && (
        <div className="border-t border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900">Şikayət: {reportTarget.sender_name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-amber-800">“{reportTarget.body}”</p>
          <textarea
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Səbəb (istəyə görə)"
            className="mt-2 w-full resize-none rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-amber-700">Yalnız bu mesaj mərkəz rəhbərinə göndəriləcək; yazışmanın qalanı görünməyəcək.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => void submitReport()} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
              Göndər
            </button>
            <button onClick={() => setReportTarget(null)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
              Ləğv et
            </button>
          </div>
        </div>
      )}
      <form
        onSubmit={e => {
          e.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 border-t border-gray-100 p-3"
      >
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Mesaj yazın..."
          className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <button type="submit" disabled={sending || !text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" aria-label="Göndər">
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
