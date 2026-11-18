import { useEffect, useState } from "react";
import { Play, ClipboardCheck, Users, Wallet, Gift, Clock3, Check, Copy, ArrowUpRight, CircleHelp, LogOut } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
type Tab = "video" | "tasks" | "friends" | "wallet";
export default function App() {
  const tg = window.Telegram?.WebApp;
  const [tab, setTab] = useState<Tab>("video");
  const [me, setMe] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referral, setReferral] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const initData = tg?.initData || "";
  const headers = { "Content-Type": "application/json", "X-Telegram-Init-Data": initData, "X-Start-Param": tg?.initDataUnsafe?.start_param || "" };
  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Сталася помилка");
    return data;
  }
  async function refresh() {
    try {
      const [profile, taskList, tx, ref] = await Promise.all([api("/api/me"), api("/api/tasks"), api("/api/transactions"), api("/api/referral")]);
      setMe(profile); setTasks(taskList); setTransactions(tx); setReferral(ref);
    } catch (e: any) { setNotice(e.message); }
  }
  useEffect(() => { tg?.ready(); tg?.expand(); refresh(); }, []);
  const say = (s: string) => { setNotice(s); window.setTimeout(() => setNotice(""), 3500); };
  async function action(fn: () => Promise<any>, success: (r: any) => string) {
    setBusy(true); try { const r = await fn(); await refresh(); say(success(r)); } catch (e: any) { say(e.message); } finally { setBusy(false); }
  }
  const money = (n: number) => `${Number(n || 0).toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴`;
  async function copyLink() {
    if (!referral?.link) return;
    try { await navigator.clipboard.writeText(referral.link); say("Посилання скопійовано"); }
    catch { say(referral.link); }
  }
  return <main className="app">
    <header className="top"><div className="brand"><span className="logo">W</span><div><b>WM EARN</b><small>Твій бонусний простір</small></div></div><div className="online"><i/> ONLINE</div></header>
    {notice && <div className="toast" onClick={() => setNotice("")}>{notice}</div>}
    <section className="hero">
      <div className="eyebrow">ТВОЯ ВИНАГОРОДА</div><div className="balance">{money(me?.wallet || 0)}</div>
      <div className="hero-foot"><span>Тестовий баланс · не є реальними грошима</span><span className="pill"><Wallet size={14}/> WM</span></div>
    </section>
    <nav className="tabs">
      {([["video",Play,"Відео"],["tasks",ClipboardCheck,"Завдання"],["friends",Users,"Друзі"],["wallet",Wallet,"Гаманець"]] as const).map(([id,Icon,label]) => <button className={tab===id?"active":""} key={id} onClick={() => setTab(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>
    {tab==="video" && <section className="content">
      <h1>Відео</h1><div className="feature card"><div className="youtube"><Play fill="white" size={27}/></div><div className="grow"><b>Перегляд партнерських відео</b><p>Відео та рекламні кампанії з’являться після підключення рекламної мережі.</p><small>Перегляд сам по собі поки не нараховує бонус.</small></div></div>
      <div className="card daily"><div className="iconbox"><Clock3/></div><div className="grow"><b>Щоденний вхід</b><p>Заходь щодня та забирай тестовий бонус.</p><strong>+5,00 ₴</strong></div><button className="primary small" disabled={busy} onClick={() => action(() => api("/api/daily/claim",{method:"POST"}), r => `Нараховано ${money(r.reward)} тестових кредитів`)}>Забрати</button></div>
      <div className="hint"><CircleHelp size={17}/> Реальна оплата за перегляди потребує підтвердження від рекламної мережі.</div>
    </section>}
    {tab==="tasks" && <section className="content"><h1>Завдання</h1><div className="section-label">ПАРТНЕРСЬКІ ЗАВДАННЯ</div>
      {tasks.map(t => <article className="card task" key={t.id}><div className="iconbox"><Gift/></div><div className="grow"><b>{t.title}</b><p>{t.description}</p><strong>+{money(t.reward)}</strong></div><button className={t.completed?"done":"primary"} disabled={t.completed||busy} onClick={() => action(() => api(`/api/tasks/${t.id}/claim`,{method:"POST"}), () => "Тестову винагороду додано")}>{t.completed?<><Check size={15}/> Виконано</>:"Отримати"}</button></article>)}
      <p className="muted tiny">У цій альфа-версії завдання демонстраційні. Для партнерських завдань потрібна зовнішня перевірка виконання.</p>
    </section>}
    {tab==="friends" && <section className="content"><h1>Друзі</h1><div className="bonus-grid"><div className="bonus"><Gift/><span>Тобі за друга</span><b>+150 ₴</b></div><div className="bonus"><Users/><span>Реферальна програма</span><b>Бонуси</b></div></div>
      <div className="card referral"><div className="section-label">ТВОЄ ПОСИЛАННЯ</div><div className="linkline">{referral?.link || "Завантаження…"} <button onClick={copyLink}><Copy size={19}/></button></div><button className="primary wide" onClick={() => { if (referral?.link) window.open(`https://t.me/share/url?url=${encodeURIComponent(referral.link)}`,"_blank"); }}>Поділитися <ArrowUpRight size={18}/></button></div>
      <div className="stats"><div className="card"><span>Запрошено</span><b>{me?.referrals || 0}</b></div><div className="card"><span>Статус</span><b className="green">Активний</b></div></div>
      <p className="muted tiny">Реферальні виплати не активовані автоматично: потрібна перевірка реєстрації та захист від фіктивних акаунтів.</p>
    </section>}
    {tab==="wallet" && <section className="content"><h1>Гаманець</h1><div className="card wallet-card"><div className="section-label">БАЛАНС</div><div className="balance">{money(me?.wallet || 0)}</div><div className="warning">Тестові кредити. Виведення реальних коштів не підключено.</div></div>
      <div className="card payout"><div className="section-label">ЗАПИТ НА ВИВЕДЕННЯ · ТЕСТ</div><label>Сума (мінімум 100 ₴)</label><input value={payoutAmount} onChange={e=>setPayoutAmount(e.target.value)} inputMode="numeric" placeholder="100"/><label>Тестовий реквізит (не вводь дані картки)</label><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Наприклад, test-user-01"/><button className="primary wide" disabled={busy} onClick={() => action(() => api("/api/payouts",{method:"POST",body:JSON.stringify({amount:Number(payoutAmount),destination})}), () => "Тестову заявку записано. Переказ не виконується.")}>Створити тестову заявку</button></div>
      <div className="card history"><div className="section-label">ІСТОРІЯ ТРАНЗАКЦІЙ</div>{transactions.length===0?<p className="muted">Поки немає операцій</p>:transactions.map(tx=><div className="tx" key={tx.id}><div><b>{tx.note}</b><small>{new Date(tx.createdAt).toLocaleString("uk-UA")}</small></div><strong>+{money(tx.amount)}</strong></div>)}</div>
    </section>}
    <footer><span>WM EARN ALPHA</span><span>Допомога · Правила · Конфіденційність</span></footer>
  </main>;
}
