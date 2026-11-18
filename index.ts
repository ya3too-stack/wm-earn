import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "./db.js";
import { verifyTelegramInitData } from "./telegram.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const admins = new Set((process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(x => x.trim()).filter(Boolean));
app.use(cors({ origin: process.env.APP_ORIGIN?.split(",") || "http://localhost:5173" }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 100 }));
type AuthedRequest = Request & { user?: { id: string; telegramId: string; isAdmin: boolean } };

async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const initData = String(req.headers["x-telegram-init-data"] || "");
    let tgUser: any;
    if (initData && process.env.BOT_TOKEN && process.env.BOT_TOKEN !== "PASTE_BOT_TOKEN_HERE") {
      const data = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
      tgUser = JSON.parse(data.user || "{}");
    } else if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH === "true") {
      tgUser = { id: 999000001, first_name: "Тестовий користувач", username: "wm_earn_test" };
    } else {
      return res.status(401).json({ error: "Відкрий WM EARN через Telegram-бота." });
    }
    if (!tgUser?.id) return res.status(401).json({ error: "Не вдалося підтвердити Telegram." });
    const telegramId = String(tgUser.id);
    const startParam = String(req.headers["x-start-param"] || "");
    let user = await db.user.findUnique({ where: { telegramId } });
    if (!user) {
      let referredById: string | undefined;
      const match = startParam.match(/^ref_(\d+)$/);
      if (match && match[1] !== telegramId) {
        const referrer = await db.user.findUnique({ where: { telegramId: match[1] } });
        referredById = referrer?.id;
      }
      user = await db.user.create({ data: {
        telegramId, username: tgUser.username || null,
        firstName: tgUser.first_name || "Користувач", photoUrl: tgUser.photo_url || null,
        referredById
      }});
    } else {
      user = await db.user.update({ where: { id: user.id }, data: {
        username: tgUser.username || user.username,
        firstName: tgUser.first_name || user.firstName,
        photoUrl: tgUser.photo_url || user.photoUrl
      }});
    }
    req.user = { id: user.id, telegramId, isAdmin: admins.has(telegramId) };
    next();
  } catch (e: any) { res.status(401).json({ error: e.message || "Помилка авторизації" }); }
}
const me = (req: AuthedRequest) => req.user!;
async function balance(userId: string) {
  const rows = await db.transaction.aggregate({ where: { userId }, _sum: { amount: true } });
  return rows._sum.amount || 0;
}
async function credit(userId: string, amount: number, type: string, note: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid credit");
  return db.transaction.create({ data: { userId, amount, type, note } });
}
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "WM EARN" }));
app.use("/api", auth);

app.get("/api/me", async (req: AuthedRequest, res) => {
  const user = await db.user.findUnique({ where: { id: me(req).id } });
  const [wallet, referrals] = await Promise.all([
    balance(me(req).id),
    db.user.count({ where: { referredById: me(req).id } })
  ]);
  res.json({ user, wallet, referrals, isAdmin: me(req).isAdmin, currency: "UAH_TEST" });
});
app.get("/api/transactions", async (req: AuthedRequest, res) => {
  const items = await db.transaction.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json(items);
});
app.get("/api/tasks", async (req: AuthedRequest, res) => {
  const tasks = await db.task.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const claims = await db.taskClaim.findMany({ where: { userId: me(req).id }, select: { taskId: true } });
  res.json(tasks.map(t => ({ ...t, completed: claims.some(c => c.taskId === t.id) })));
});
app.post("/api/tasks/:id/claim", async (req: AuthedRequest, res) => {
  const task = await db.task.findFirst({ where: { id: req.params.id, active: true } });
  if (!task) return res.status(404).json({ error: "Завдання не знайдено" });
  try {
    await db.$transaction(async tx => {
      await tx.taskClaim.create({ data: { userId: me(req).id, taskId: task.id } });
      await tx.transaction.create({ data: { userId: me(req).id, amount: task.reward, type: "TASK_TEST", note: `Тестова винагорода: ${task.title}` } });
    });
    res.json({ ok: true, reward: task.reward, testCredit: true });
  } catch { res.status(409).json({ error: "Це завдання вже виконано." }); }
});
app.post("/api/daily/claim", async (req: AuthedRequest, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const reward = Math.max(1, Number(process.env.DAILY_REWARD || 5));
  try {
    await db.$transaction(async tx => {
      await tx.dailyClaim.create({ data: { userId: me(req).id, day } });
      await tx.transaction.create({ data: { userId: me(req).id, amount: reward, type: "DAILY_TEST", note: "Щоденний тестовий бонус" } });
    });
    res.json({ ok: true, reward });
  } catch { res.status(409).json({ error: "Щоденний бонус уже отримано." }); }
});
app.get("/api/referral", async (req: AuthedRequest, res) => {
  const bot = process.env.BOT_USERNAME || "YOUR_BOT_USERNAME";
  res.json({ link: `https://t.me/${bot}?startapp=ref_${me(req).telegramId}`, referrals: await db.user.count({ where: { referredById: me(req).id } }) });
});
app.post("/api/payouts", async (req: AuthedRequest, res) => {
  const schema = z.object({ amount: z.number().int().positive(), destination: z.string().min(4).max(80) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Перевір суму та реквізит." });
  const minimum = Number(process.env.MIN_PAYOUT || 100);
  const available = await balance(me(req).id);
  if (parsed.data.amount < minimum) return res.status(400).json({ error: `Мінімум для заявки: ${minimum} ₴.` });
  if (parsed.data.amount > available) return res.status(400).json({ error: "Недостатньо коштів." });
  const payout = await db.payoutRequest.create({ data: { userId: me(req).id, ...parsed.data } });
  res.status(201).json({ ...payout, message: "Заявку записано. Це тестова заявка, переказ не виконується." });
});
app.get("/api/payouts", async (req: AuthedRequest, res) => {
  res.json(await db.payoutRequest.findMany({ where: { userId: me(req).id }, orderBy: { createdAt: "desc" } }));
});
app.post("/api/admin/tasks", async (req: AuthedRequest, res) => {
  if (!me(req).isAdmin) return res.sendStatus(403);
  const schema = z.object({ title: z.string().min(3).max(80), description: z.string().max(300), reward: z.number().int().positive().max(100000), kind: z.string().default("PARTNER") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Некоректні дані завдання." });
  res.status(201).json(await db.task.create({ data: parsed.data }));
});
app.get("/api/admin/payouts", async (req: AuthedRequest, res) => {
  if (!me(req).isAdmin) return res.sendStatus(403);
  res.json(await db.payoutRequest.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }));
});
app.listen(port, () => console.log(`WM EARN API listening on ${port}`));
