// Scriptable (iOS) için widget betiği. Kullanıcı Ayarlar'dan kopyalayıp Scriptable'a yapıştırır.
// Betik yalnızca /api/widget'tan okur; anahtar betiğin içine gömülür (o telefonda kalır).

export function widgetScript(baseUrl: string, token: string): string {
  return `// Gri Hesap Defteri — iPhone widget'ı (Scriptable)
// Ana ekrana: uzun bas → + → Scriptable → boyut seç → widget'a dokun → Script: bu betik.
// Bu betikteki anahtar yalnızca okuma yapar; Ayarlar'dan istediğin an iptal edebilirsin.

const URL_BASE = ${JSON.stringify(baseUrl)};
const TOKEN = ${JSON.stringify(token)};

const C = {
  bg: Color.dynamic(new Color("#f4f3f0"), new Color("#141416")),
  ink: Color.dynamic(new Color("#141414"), new Color("#ecebe6")),
  muted: Color.dynamic(new Color("#8a898d"), new Color("#8d8d93")),
  green: Color.dynamic(new Color("#2e7a0f"), new Color("#c3f150")),
  red: Color.dynamic(new Color("#d9431e"), new Color("#ff6a42")),
  chip: Color.dynamic(new Color("#e4e2dd"), new Color("#232327")),
};

async function load() {
  const req = new Request(URL_BASE + "/api/widget");
  req.headers = { Authorization: "Bearer " + TOKEN };
  req.timeoutInterval = 15;
  const data = await req.loadJSON();
  if (req.response && req.response.statusCode !== 200) throw new Error(data.error || "Veri alınamadı");
  return data;
}

function text(stack, value, size, color, bold) {
  const t = stack.addText(String(value));
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function header(w, d) {
  const row = w.addStack();
  row.centerAlignContent();
  const leaf = row.addStack();
  leaf.layoutVertically();
  leaf.backgroundColor = C.chip;
  leaf.cornerRadius = 8;
  leaf.setPadding(3, 7, 3, 7);
  text(leaf, d.day, 18, C.ink, true);
  row.addSpacer(8);
  const col = row.addStack();
  col.layoutVertically();
  text(col, d.weekday, 11, C.muted, false);
  text(col, d.dayMonth, 11, C.muted, false);
}

function build(d, family) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  w.url = URL_BASE;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  header(w, d);
  w.addSpacer(8);

  if (d.today.count > 0) {
    text(w, "Bugün " + d.today.count + " ödeme", 11, C.muted, false);
    text(w, d.today.total, family === "small" ? 20 : 22, C.ink, true);
    if (family !== "small") {
      w.addSpacer(4);
      for (const it of d.today.items.slice(0, family === "large" ? 4 : 2)) {
        const r = w.addStack();
        text(r, "• " + it.name, 11, C.ink, false);
        r.addSpacer();
        text(r, it.amount, 11, C.muted, false);
      }
    }
  } else {
    text(w, "Bugün ödemeniz yok 💰", 13, C.ink, true);
    if (d.next) text(w, "Sıradaki: " + d.next.name + " · " + d.next.when, 11, C.muted, false);
  }

  w.addSpacer();

  if (d.overdue.count > 0) {
    text(w, "⚠︎ " + d.overdue.count + " gecikmiş · " + d.overdue.total, 11, C.red, true);
  } else if (d.funds && family !== "small") {
    // Yönetici: fon özeti
    const r = w.addStack();
    text(r, "Fonlar " + d.funds.value, 11, C.ink, true);
    r.addSpacer(6);
    if (d.funds.daily) text(r, d.funds.daily + (d.funds.dailyPct ? " (" + d.funds.dailyPct + ")" : ""), 11, d.funds.dailyUp ? C.green : C.red, false);
  } else {
    text(w, "Bu ay net " + d.month.net, 11, d.month.up ? C.green : C.red, true);
  }

  if (d.funds && family === "large") {
    w.addSpacer(4);
    text(w, "Toplam getiri " + d.funds.total + (d.funds.totalPct ? " (" + d.funds.totalPct + ")" : ""), 11, d.funds.totalUp ? C.green : C.red, false);
  }
  return w;
}

function errorWidget(message) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.url = URL_BASE + "/ayarlar";
  text(w, "Gri Hesap Defteri", 12, C.ink, true);
  w.addSpacer(6);
  const t = w.addText(message);
  t.font = Font.systemFont(11);
  t.textColor = C.muted;
  return w;
}

let widget;
try {
  widget = build(await load(), config.widgetFamily || "medium");
} catch (e) {
  widget = errorWidget(String(e.message || e));
}
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}
