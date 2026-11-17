/**
 * wettercard-modular-v3  –  kompakte, modulare Wetterstation für Home Assistant
 *
 * Installation:
 *   1. Datei nach /config/www/wettercard-modular-v3.js kopieren
 *   2. Einstellungen > Dashboards > Ressourcen > Ressource hinzufügen
 *        URL: /local/wettercard-modular-v3.js    Typ: JavaScript-Modul
 *   3. Browser-Cache leeren (Strg+F5) und Card mit "type: custom:wettercard-modular-v3" einfügen
 *
 * Alle Bausteine lassen sich per true/false schalten:
 *   show_hero, show_condition, show_range,
 *   show_wind, show_gust, show_rain, show_uv, show_humidity, show_abs_humidity, show_forecast
 * Weitere Optionen:
 *   height        Höhe des Himmel-Bereichs in px (Standard 160, ohne Min/Max-Leiste 130)
 *   columns       feste Spaltenzahl der Kacheln (Standard: automatisch)
 *   moon          Mond-Entität (Standard sensor.moon; fehlt sie, wird die Phase berechnet)
 *   moon_flip     true = Mond für die Südhalbkugel spiegeln
 *   forecast_days Anzahl Vorschau-Tage (Standard 2 = heute + morgen, max. 5)
 *                 Die Vorschau kommt von der weather-Entität (daily, twice_daily oder hourly).
 *   forecast_entity  andere weather-Entität nur für die Vorschau (z. B. weather.forecast_home),
 *                 falls die Haupt-Entität keine Vorschau liefert (z. B. reine Wetterstation)
 *
 * Entitäten: alle lassen sich im Block "entities:" festlegen (alle optional, Standardwerte siehe DEFAULTS):
 *   entities:
 *     weather: weather.salzgitter        Zustand/Icon im Himmel-Bereich (+ Vorschau, falls keine eigene)
 *     forecast: weather.salzgitter       nur für die Vorschau (wie forecast_entity)
 *     temperature: sensor.xyz            aktuelle Außentemperatur
 *     min: sensor.xyz                    Tagesminimum (Leiste)
 *     max: sensor.xyz                    Tagesmaximum (Leiste)
 *     wind: sensor.xyz                   Windgeschwindigkeit
 *     gust: sensor.xyz                   Windböen
 *     rain: sensor.xyz                   Regen heute
 *     uv: sensor.xyz                     UV-Index
 *     humidity: sensor.xyz               relative Luftfeuchte
 *     abs_humidity: sensor.xyz           absolute Luftfeuchte
 *     sun: sun.sun                       Tag/Nacht
 *     moon: sensor.moon                  Mondphase
 * Die flache Schreibweise (z. B. "temperature: sensor.xyz" direkt in der Card) funktioniert weiterhin.
 * Steht ein Wert in beiden, gewinnt der Block "entities". Fehlende Entitäten meldet die Card einmalig
 * in der Browser-Konsole (F12).
 */
const VERSION = "2.1";

const TEMP_STOPS = [
  [-15, [92, 84, 230]],
  [-5, [84, 140, 245]],
  [3, [78, 200, 245]],
  [10, [66, 205, 185]],
  [16, [120, 210, 115]],
  [21, [255, 178, 64]],
  [27, [255, 128, 48]],
  [33, [255, 84, 84]],
  [40, [226, 48, 128]],
];

const DEFAULTS = {
  weather: "weather.salzgitter",
  temperature: "sensor.wetterstation_ecowitt_outdoor_temperature",
  rain: "sensor.wetterstation_ecowitt_daily_rain",
  wind: "sensor.wetterstation_ecowitt_wind_speed",
  gust: "sensor.wetterstation_ecowitt_wind_gust",
  min: "sensor.min_aussentemperatur_24h",
  max: "sensor.max_aussentemperatur_24h",
  uv: "sensor.wetterstation_ecowitt_uv_index",
  humidity: "sensor.wetterstation_ecowitt_humidity",
  abs_humidity: "sensor.aussen_absolute_luftfeuchtigkeit",
  sun: "sun.sun",
  moon: "sensor.moon",
};

const OPTIONS = {
  show_hero: true,
  show_condition: true,
  show_range: true,
  show_wind: true,
  show_gust: true,
  show_rain: true,
  show_uv: true,
  show_humidity: true,
  show_abs_humidity: true,
  show_forecast: true,
  forecast_days: 2,
  forecast_entity: null,
  height: null,
  columns: null,
  moon_flip: false,
};

/* Mondphase: 0 = Neumond, 0.25 = erstes Viertel, 0.5 = Vollmond, 0.75 = letztes Viertel */
const MOON_PHASES = {
  new_moon: 0,
  waxing_crescent: 0.125,
  first_quarter: 0.25,
  waxing_gibbous: 0.375,
  full_moon: 0.5,
  waning_gibbous: 0.625,
  last_quarter: 0.75,
  waning_crescent: 0.875,
};
function moonPhaseCalc(date = new Date()) {
  const syn = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14); // bekannter Neumond
  return ((((date.getTime() - ref) / 86400000 / syn) % 1) + 1) % 1;
}

const BASE_COND = { cl: 0, dk: 0, sun: 0, moon: 0, stars: 0, fog: 0, rain: 0, rv: 700, snow: 0, hail: 0, bolt: 0 };
const COND = {
  sunny: { de: "Sonnig", ic: "mdi:weather-sunny", cl: 1, sun: 1 },
  "clear-night": { de: "Klare Nacht", ic: "mdi:weather-night", moon: 1, stars: 1 },
  partlycloudy: { de: "Teils bewölkt", ic: "mdi:weather-partly-cloudy", cl: 3, dk: 0.1, sun: 0.8, moon: 1, stars: 0.6 },
  cloudy: { de: "Bewölkt", ic: "mdi:weather-cloudy", cl: 7, dk: 0.3 },
  fog: { de: "Nebel", ic: "mdi:weather-fog", cl: 2, dk: 0.15, fog: 1 },
  rainy: { de: "Regen", ic: "mdi:weather-rainy", cl: 7, dk: 0.55, rain: 140, rv: 650 },
  pouring: { de: "Starkregen", ic: "mdi:weather-pouring", cl: 8, dk: 0.7, rain: 320, rv: 950 },
  lightning: { de: "Gewitter", ic: "mdi:weather-lightning", cl: 8, dk: 0.85, bolt: 1 },
  "lightning-rainy": { de: "Gewitter mit Regen", ic: "mdi:weather-lightning-rainy", cl: 8, dk: 0.85, bolt: 1, rain: 240, rv: 900 },
  snowy: { de: "Schnee", ic: "mdi:weather-snowy", cl: 6, dk: 0.3, snow: 130 },
  "snowy-rainy": { de: "Schneeregen", ic: "mdi:weather-snowy-rainy", cl: 7, dk: 0.45, rain: 70, rv: 600, snow: 70 },
  hail: { de: "Hagel", ic: "mdi:weather-hail", cl: 7, dk: 0.6, hail: 110 },
  windy: { de: "Windig", ic: "mdi:weather-windy", cl: 3, dk: 0.1, sun: 0.6, moon: 1, stars: 0.5 },
  "windy-variant": { de: "Windig", ic: "mdi:weather-windy-variant", cl: 4, dk: 0.2, sun: 0.4, moon: 1, stars: 0.4 },
  exceptional: { de: "Außergewöhnlich", ic: "mdi:alert-circle-outline", cl: 4, dk: 0.5 },
};
const condOf = (k) => ({ ...BASE_COND, ...(COND[k] || COND.cloudy) });

const UV_COLORS = ["#5fd068", "#5fd068", "#5fd068", "#b8dc3c", "#ffd23f", "#ffd23f", "#ff9a3c", "#ff9a3c", "#ff5c5c", "#ff5c5c", "#ff5c5c", "#b45cf0"];
const uvLabel = (v) => (v < 3 ? "Niedrig" : v < 6 ? "Mäßig" : v < 8 ? "Hoch" : v < 11 ? "Sehr hoch" : "Extrem");

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = Math.random;

function tempColor(t) {
  const S = TEMP_STOPS;
  if (!Number.isFinite(t)) t = 15;
  if (t <= S[0][0]) return S[0][1];
  for (let i = 1; i < S.length; i++) {
    if (t <= S[i][0]) {
      const [a, ca] = S[i - 1];
      const [b, cb] = S[i];
      return mixc(ca, cb, (t - a) / (b - a));
    }
  }
  return S[S.length - 1][1];
}

function barGradient(lo, hi) {
  const pts = [[lo, tempColor(lo)]];
  TEMP_STOPS.forEach(([t, c]) => {
    if (t > lo && t < hi) pts.push([t, c]);
  });
  pts.push([hi, tempColor(hi)]);
  return `linear-gradient(90deg,${pts.map(([t, c]) => `${rgb(c)} ${(((t - lo) / (hi - lo)) * 100).toFixed(1)}%`).join(",")})`;
}

const fit = (arr, n, make) => {
  while (arr.length < n) arr.push(make());
  arr.length = n;
};

/* ------------------------------------------------------------------ */
/*  Szene: Canvas-Animation                                            */
/* ------------------------------------------------------------------ */
class Scene {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = 320;
    this.h = 160;
    this.t = 0;
    this.running = false;
    this.p = { cond: condOf("sunny"), night: false, wind: 0, temp: 15, reduced: false, moon: 0.5, flip: false };
    this.drops = [];
    this.hail = [];
    this.flakes = [];
    this.clouds = [];
    this.streaks = [];
    this.ripples = [];
    this.fogs = [];
    this.bolt = null;
    this.flash = 0;
    this.again = false;
    this.nextBolt = 1.5;
    this.stars = Array.from({ length: 46 }, () => ({ x: rnd(), y: rnd() * 0.7, r: rnd() * 1.3 + 0.3, ph: rnd() * 6.28 }));
    this.sparks = Array.from({ length: 22 }, () => ({ x: rnd(), y: rnd(), ph: rnd() * 6.28, sp: 1.5 + rnd() * 2 }));
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._rebuild();
    if (this.p.reduced) this.draw(0);
  }

  set(p) {
    this.p = { ...this.p, ...p };
    this._rebuild();
    if (this.p.reduced) this.draw(0);
  }

  _rebuild() {
    const { cond, wind, reduced } = this.p;
    const k = reduced ? 0.35 : 1;
    fit(this.drops, Math.round(cond.rain * k), () => this._drop(true));
    fit(this.hail, Math.round(cond.hail * k), () => ({ x: rnd() * (this.w + 120) - 60, y: rnd() * this.h, r: 1.4 + rnd() * 1.6, v: 0.8 + rnd() * 0.4 }));
    fit(this.flakes, Math.round(cond.snow * k), () => ({ x: rnd() * this.w, y: rnd() * this.h, r: 1 + rnd() * 2.4, v: 20 + rnd() * 35, ph: rnd() * 6.28 }));
    fit(this.clouds, cond.cl, () => this._cloud(true));
    fit(this.fogs, cond.fog ? 6 : 0, () => ({ x: rnd() * (this.w + 400) - 200, y: this.h * (0.3 + rnd() * 0.6), sp: 6 + rnd() * 10, a: 0.14 + rnd() * 0.12 }));
    const sn = wind > 18 ? Math.min(26, Math.round(wind / 2.2)) : 0;
    fit(this.streaks, Math.round(sn * k), () => this._streak(true));
  }

  _drop(init) {
    return { x: rnd() * (this.w + 200) - 100, y: init ? rnd() * this.h : -20, l: 10 + rnd() * 14, v: 0.8 + rnd() * 0.4 };
  }

  _cloud(init) {
    const s = 0.6 + rnd() * 0.8;
    const puffs = [];
    for (let i = 0; i < 5; i++) puffs.push({ dx: (i - 2) * 26 * s + (rnd() - 0.5) * 10, dy: (rnd() - 0.5) * 14 * s - Math.abs(i - 2) * 3, r: (30 + rnd() * 18) * s });
    return { x: init ? rnd() * (this.w + 320) - 160 : -220, y: 10 + rnd() * this.h * 0.4, sp: 5 + rnd() * 9, puffs, a: 0.5 + rnd() * 0.25 };
  }

  _streak(init) {
    const wind = this.p.wind;
    return { x: init ? rnd() * this.w : -150, y: rnd() * this.h * 0.8, l: 40 + rnd() * 90, v: (250 + wind * 18) * (0.7 + rnd() * 0.6), a: 0.08 + rnd() * 0.12 };
  }

  start() {
    if (this.running || this.p.reduced) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.t += dt;
      this.draw(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /* Mond mit korrekter Phase: zunehmend = rechts beleuchtet, abnehmend = links (Nordhalbkugel) */
  _moon(mx, my, r) {
    const { ctx } = this;
    const { cond, moon, flip } = this.p;
    const ph = clamp(Number.isFinite(moon) ? moon : 0.5, 0, 1);
    const cosA = Math.cos(ph * 6.283185);
    const k = (1 - cosA) / 2; // beleuchteter Anteil 0..1
    const waxing = ph < 0.5;
    const side = waxing !== !!flip ? 1 : -1; // 1 = Licht rechts, -1 = Licht links

    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r * 5);
    g.addColorStop(0, `rgba(190,210,255,${0.32 * cond.moon * (0.2 + 0.8 * k)})`);
    g.addColorStop(1, "rgba(190,210,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // dunkle Seite (Erdlicht)
    ctx.fillStyle = "rgba(140,155,200,.2)";
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.283);
    ctx.fill();

    if (k < 0.01) return;
    ctx.fillStyle = "rgba(245,248,255,.95)";
    ctx.beginPath();
    // Außenrand der beleuchteten Seite (oben -> unten)
    ctx.arc(mx, my, r, -Math.PI / 2, Math.PI / 2, side < 0);
    // Terminator (unten -> oben)
    const tx = side * r * cosA; // Versatz der Schattengrenze vom Mittelpunkt
    const rx = Math.abs(tx);
    if (rx < 0.5) ctx.lineTo(mx, my - r);
    else ctx.ellipse(mx, my, rx, r, 0, Math.PI / 2, -Math.PI / 2, tx > 0);
    ctx.closePath();
    ctx.fill();
  }

  draw(dt) {
    const { ctx, w, h, t } = this;
    const { cond, night, wind, temp } = this.p;
    const u = clamp(h / 250, 0.55, 1); // Skalierung für die kompakte Höhe
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";

    /* Sonne */
    if (!night && cond.sun > 0) {
      const sx = w * 0.8, sy = h * 0.36, s = cond.sun;
      let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 190 * u);
      g.addColorStop(0, `rgba(255,236,170,${0.55 * s})`);
      g.addColorStop(1, "rgba(255,236,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(255,240,180,${0.3 * s})`;
      ctx.lineWidth = Math.max(2, 3 * u);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.283 + t * 0.08;
        const r1 = 48 * u, r2 = r1 + (20 + Math.sin(t * 1.4 + i * 1.7) * 9) * u;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
        ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
        ctx.stroke();
      }
      const pr = 34 * u * (1 + 0.03 * Math.sin(t * 1.5));
      g = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr);
      g.addColorStop(0, `rgba(255,255,235,${s})`);
      g.addColorStop(0.7, `rgba(255,232,150,${s})`);
      g.addColorStop(1, `rgba(255,214,120,${0.85 * s})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, pr, 0, 6.283);
      ctx.fill();
    }

    /* Mond + Sterne */
    if (night) {
      if (cond.stars > 0) {
        for (const s of this.stars) {
          const a = cond.stars * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + s.ph)));
          ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
          ctx.beginPath();
          ctx.arc(s.x * w, s.y * h, s.r, 0, 6.283);
          ctx.fill();
        }
      }
      if (cond.moon > 0) this._moon(w * 0.8, h * 0.34, 28 * u);
    }

    /* Hitzeflimmern */
    if (!night && cond.sun > 0 && temp >= 26) {
      ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255,210,140,${0.05 + (temp - 26) * 0.006})`;
        ctx.beginPath();
        const by = h * (0.7 + i * 0.07);
        for (let x = 0; x <= w; x += 8) {
          const y = by + Math.sin(x * 0.03 + t * 1.6 + i) * 3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    /* Wolken */
    if (this.clouds.length) {
      const light = night ? [160, 170, 200] : [255, 255, 255];
      const dark = night ? [46, 52, 72] : [74, 80, 98];
      const col = mixc(light, dark, cond.dk);
      for (const c of this.clouds) {
        c.x += c.sp * (1 + wind / 18) * dt;
        if (c.x > w + 200) Object.assign(c, this._cloud(false));
        const a = Math.min(0.9, c.a * (0.65 + cond.dk * 0.5));
        for (const p of c.puffs) {
          const x = c.x + p.dx, y = c.y + p.dy;
          const g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
          g.addColorStop(0, rgb(col, a));
          g.addColorStop(1, rgb(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, p.r, 0, 6.283);
          ctx.fill();
        }
      }
    }

    /* Nebel */
    for (const f of this.fogs) {
      f.x += f.sp * dt;
      if (f.x > w + 250) f.x = -250;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(5, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      g.addColorStop(0, `rgba(235,240,250,${f.a})`);
      g.addColorStop(1, "rgba(235,240,250,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }

    const ground = h - 8;
    const slant = clamp(wind * 7, 0, 420);

    /* Regen */
    if (this.drops.length) {
      const thick = cond.rain > 250;
      ctx.strokeStyle = night ? "rgba(170,195,255,.5)" : "rgba(200,222,255,.55)";
      ctx.lineWidth = thick ? 1.6 : 1.1;
      ctx.beginPath();
      for (const d of this.drops) {
        const vy = cond.rv * d.v;
        d.x += slant * dt;
        d.y += vy * dt;
        if (d.y > ground) {
          if (this.ripples.length < 28 && rnd() < 0.2) this.ripples.push({ x: d.x, y: ground - rnd() * 10, r: 1, a: 0.45 });
          Object.assign(d, this._drop(false));
        }
        if (d.x > w + 60) d.x -= w + 160;
        const n = Math.hypot(slant, vy);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - (slant / n) * d.l, d.y - (vy / n) * d.l);
      }
      ctx.stroke();
    }

    /* Hagel */
    if (this.hail.length) {
      ctx.fillStyle = "rgba(240,248,255,.9)";
      for (const d of this.hail) {
        d.y += 620 * d.v * dt;
        d.x += slant * 0.6 * dt;
        if (d.y > ground) {
          d.y = -10;
          d.x = rnd() * (w + 120) - 60;
        }
        if (d.x > w + 60) d.x -= w + 120;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, 6.283);
        ctx.fill();
      }
    }

    /* Schnee */
    if (this.flakes.length) {
      const wx = clamp(wind * 2.5, 0, 120);
      ctx.fillStyle = "rgba(255,255,255,.88)";
      for (const f of this.flakes) {
        f.y += f.v * dt * (0.6 + f.r * 0.3);
        f.x += (Math.sin(t * 0.8 + f.ph) * 18 + wx) * dt;
        if (f.y > h + 4) {
          f.y = -6;
          f.x = rnd() * w;
        }
        if (f.x > w + 6) f.x = -6;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, 6.283);
        ctx.fill();
      }
      const g = ctx.createLinearGradient(0, h - 18, 0, h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,.32)");
      ctx.fillStyle = g;
      ctx.fillRect(0, h - 18, w, 18);
    }

    /* Windstriche */
    if (this.streaks.length) {
      ctx.lineWidth = 1.2;
      for (const s of this.streaks) {
        s.x += s.v * dt;
        if (s.x - s.l > w) Object.assign(s, this._streak(false));
        ctx.strokeStyle = `rgba(255,255,255,${s.a})`;
        ctx.beginPath();
        ctx.moveTo(s.x - s.l, s.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    }

    /* Pfützenringe */
    if (this.ripples.length) {
      ctx.lineWidth = 1;
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.r += 26 * dt;
        r.a -= 0.9 * dt;
        if (r.a <= 0) {
          this.ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(210,230,255,${r.a})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, 6.283);
        ctx.stroke();
      }
    }

    /* Frostfunkeln */
    if (temp <= 1) {
      const n = this.p.reduced ? 8 : this.sparks.length;
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const s = this.sparks[i];
        const a = Math.max(0, Math.sin(t * s.sp + s.ph)) * 0.8;
        if (a < 0.05) continue;
        const x = s.x * w, y = s.y * h, l = 3 + a * 4;
        ctx.strokeStyle = `rgba(225,242,255,${a})`;
        ctx.beginPath();
        ctx.moveTo(x - l, y);
        ctx.lineTo(x + l, y);
        ctx.moveTo(x, y - l);
        ctx.lineTo(x, y + l);
        ctx.stroke();
      }
    }

    /* Blitz */
    if (cond.bolt && !this.p.reduced) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.flash = 1;
        this.again = rnd() < 0.5;
        this.nextBolt = 3 + rnd() * 6;
        let x = w * (0.2 + rnd() * 0.6), y = 0;
        const pts = [[x, y]];
        while (y < h * 0.75) {
          y += 18 + rnd() * 22;
          x += (rnd() - 0.5) * 44;
          pts.push([x, y]);
        }
        this.bolt = pts;
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.33})`;
        ctx.fillRect(0, 0, w, h);
        if (this.bolt) {
          ctx.save();
          ctx.shadowColor = "rgba(190,205,255,1)";
          ctx.shadowBlur = 18;
          ctx.strokeStyle = `rgba(255,255,255,${clamp(this.flash, 0, 1)})`;
          ctx.lineWidth = 2.4;
          ctx.lineJoin = "round";
          ctx.beginPath();
          this.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          ctx.restore();
        }
        this.flash -= dt * 3.5;
        if (this.flash <= 0.25 && this.again) {
          this.flash = 0.9;
          this.again = false;
        }
        if (this.flash <= 0) this.bolt = null;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */
const STYLE = `
:host{display:block;container-type:inline-size}
ha-card{overflow:hidden;--acc-rgb:255,178,64}
.hero{position:relative;background:#1d1a2e;color:#fff;cursor:pointer;overflow:hidden}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.hud{position:absolute;inset:0;padding:10px 14px 12px;display:flex;flex-direction:column;justify-content:space-between;text-shadow:0 1px 12px rgba(0,0,0,.35);pointer-events:none}
.temp{font-size:62px;line-height:.9;font-weight:300;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.deg{font-size:24px;font-weight:400;letter-spacing:0;margin-left:3px;opacity:.85;position:relative;top:-24px}
.cond{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:500;margin-top:3px}
.cond ha-icon{--mdc-icon-size:19px}
.range{display:flex;align-items:center;gap:10px;font-size:12px;font-variant-numeric:tabular-nums}
.range b{font-weight:600;font-size:13px}
.range small{opacity:.7;margin-right:3px;font-size:11px}
.track{position:relative;flex:1;height:5px;border-radius:3px;background:var(--grad)}
.track::before{content:"";position:absolute;inset:0;border-radius:3px;background:rgba(10,12,24,.6)}
.seg{position:absolute;inset:0;border-radius:3px;background:var(--grad)}
.dot{position:absolute;top:50%;left:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(var(--acc-rgb),.9),0 0 0 3px rgba(255,255,255,.25);transition:left .8s ease}
.fc{display:grid;grid-template-columns:repeat(var(--d,2),1fr);gap:6px;padding:6px 6px 0;cursor:pointer}
.fc:empty{display:none}
.fc:last-child{padding-bottom:6px}
.fci{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--ha-card-border-radius,12px);background:rgba(var(--acc-rgb),.09);border:1px solid rgba(var(--acc-rgb),.18);color:var(--primary-text-color);min-width:0}
.fci ha-icon{--mdc-icon-size:30px;color:rgb(var(--acc-rgb));flex:none}
.fct{min-width:0;line-height:1.25}
.fcl{font-size:11.5px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fcv b{font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.fcv i{font-style:normal;font-size:13px;opacity:.65;margin-left:4px;font-variant-numeric:tabular-nums}
.fcr{font-size:11px;opacity:.65;white-space:nowrap}
.fc.many .fci{flex-direction:column;gap:2px;padding:6px 4px;text-align:center}
.fc.many .fcc{display:none}
.fcm{grid-column:1/-1;font-size:11.5px;opacity:.75;padding:6px 10px;border-radius:var(--ha-card-border-radius,12px);border:1px dashed rgba(var(--acc-rgb),.4);color:var(--primary-text-color)}
.tiles{display:grid;grid-template-columns:repeat(var(--fix,var(--narrow,2)),1fr);gap:6px;padding:6px}
@container (min-width:400px){.tiles{grid-template-columns:repeat(var(--fix,var(--n,4)),1fr)}}
.tile{padding:7px 6px 8px;border-radius:var(--ha-card-border-radius,12px);background:rgba(var(--acc-rgb),.09);border:1px solid rgba(var(--acc-rgb),.18);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;min-width:0;color:var(--primary-text-color)}
.lab{align-self:flex-start;font-size:11.5px;opacity:.7;padding-left:2px}
.vis{width:64px;height:64px;margin:2px 0;overflow:visible}
.big{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.15}
.big small{font-size:11px;font-weight:400;opacity:.7;margin-left:2px}
.sub{font-size:11px;opacity:.65;line-height:1.2}
.trk{fill:none;stroke:rgba(var(--acc-rgb),.18);stroke-width:7}
.val{fill:none;stroke:rgb(var(--acc-rgb));stroke-width:7;stroke-linecap:round;transition:stroke-dasharray 1s ease}
.gust{fill:none;stroke:rgba(255,255,255,.55);stroke-width:2;stroke-linecap:round;transition:stroke-dasharray 1s ease}
.fan{transform-box:view-box;transform-origin:50px 50px;animation:spin var(--spin,4s) linear infinite;fill:rgb(var(--acc-rgb))}
@keyframes spin{to{transform:rotate(360deg)}}
.gauge{fill:rgba(255,255,255,.04);stroke:rgba(255,255,255,.35);stroke-width:2.5}
.tick{stroke:rgba(255,255,255,.35);stroke-width:1.5}
.water{transition:transform 1.2s ease}
.wave{fill:rgb(var(--acc-rgb));opacity:.85;animation:wave 2.4s linear infinite}
@keyframes wave{to{transform:translateX(-40px)}}
.rt{fill:var(--primary-text-color);font-size:24px;font-weight:600;text-anchor:middle;font-variant-numeric:tabular-nums}
.rt tspan{font-size:13px;font-weight:400;opacity:.7}
.bar{fill:rgba(255,255,255,.1);transition:fill .6s ease}
@media (prefers-reduced-motion:reduce){.fan,.wave{animation:none}}
`;

const IDS = ["hero", "cv", "tv", "tu", "cic", "cond", "tmin", "tmax", "track", "seg", "dot", "wg", "wv", "fan", "wt", "wsub", "water", "rt", "ru", "ut", "usub", "hv", "ht", "at", "au", "fc"];

class WettercardModularV3 extends HTMLElement {
  setConfig(config) {
    const { entities, ...flat } = config || {};
    const ent = { ...(entities || {}) };
    if (ent.forecast !== undefined) {
      ent.forecast_entity = ent.forecast; // Kurzform im entities-Block
      delete ent.forecast;
    }
    this._cfg = { ...DEFAULTS, ...OPTIONS, ...flat, ...ent };
    this._uid = Math.random().toString(36).slice(2, 8);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._teardown();
    this._build();
    if (this._hass) this._update();
  }

  set hass(h) {
    this._hass = h;
    if (this._ready) this._update();
  }

  getCardSize() {
    const c = this._cfg || OPTIONS;
    const hero = c.show_hero ? Math.ceil((c.height || (c.show_range ? 160 : 130)) / 50) : 0;
    return hero + (c.show_forecast ? 1 : 0) + (this._tileCount ? 3 : 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  static getStubConfig() {
    return { type: "custom:wettercard-modular-v3" };
  }

  connectedCallback() {
    if (this._cfg && !this._ready) {
      this._build();
      if (this._hass) this._update();
    } else if (this._scene) this._observe();
  }

  disconnectedCallback() {
    this._teardown();
  }

  _teardown() {
    this._ro?.disconnect();
    this._io?.disconnect();
    this._scene?.stop();
    cancelAnimationFrame(this._tweenRaf);
    this._scene = null;
    this._ready = false;
    this._sig = null;
    this._fcPromise?.then((u) => u()).catch(() => {});
    this._fcPromise = null;
    this._fcSub = false;
    this._checked = false;
  }

  _build() {
    const c = this._cfg;
    const u = this._uid;
    const tiles = [];

    if (c.show_wind) {
      tiles.push(`
        <div class="tile" data-e="wind">
          <div class="lab">Wind</div>
          <svg class="vis" viewBox="0 0 100 100">
            <circle class="trk" cx="50" cy="50" r="40"/>
            ${c.show_gust ? `<circle class="gust" id="wg" cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 50 50)"/>` : ""}
            <circle class="val" id="wv" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 50 50)"/>
            <g class="fan" id="fan">
              <ellipse cx="50" cy="37" rx="5" ry="12"/>
              <ellipse cx="50" cy="37" rx="5" ry="12" transform="rotate(120 50 50)"/>
              <ellipse cx="50" cy="37" rx="5" ry="12" transform="rotate(240 50 50)"/>
              <circle cx="50" cy="50" r="3.5" fill="#fff"/>
            </g>
          </svg>
          <div class="big"><span id="wt">–</span><small>km/h</small></div>
          ${c.show_gust ? `<div class="sub" id="wsub">Böen –</div>` : ""}
        </div>`);
    }

    if (c.show_rain) {
      const waves = "M0 0 q10 -5 20 0 t20 0" + " t20 0".repeat(6) + " V120 H0 Z";
      tiles.push(`
        <div class="tile" data-e="rain">
          <div class="lab">Regen heute</div>
          <svg class="vis" viewBox="0 0 100 100">
            <defs><clipPath id="cp${u}"><rect x="35" y="9" width="30" height="82" rx="8"/></clipPath></defs>
            <g clip-path="url(#cp${u})">
              <g class="water" id="water" style="transform:translateY(94px)"><path class="wave" d="${waves}"/></g>
            </g>
            <rect class="gauge" x="35" y="9" width="30" height="82" rx="8" fill="none"/>
            <line class="tick" x1="65" y1="30" x2="72" y2="30"/><line class="tick" x1="65" y1="50" x2="72" y2="50"/><line class="tick" x1="65" y1="70" x2="72" y2="70"/>
          </svg>
          <div class="big"><span id="rt">–</span><small id="ru">mm</small></div>
          <div class="sub">seit Mitternacht</div>
        </div>`);
    }

    if (c.show_uv) {
      const bars = Array.from({ length: 11 }, (_, i) => {
        const hgt = 14 + i * 5.6;
        return `<rect class="bar" data-i="${i}" x="${5 + i * 8.4}" y="${88 - hgt}" width="6" height="${hgt}" rx="2"/>`;
      }).join("");
      tiles.push(`
        <div class="tile" data-e="uv">
          <div class="lab">UV-Index</div>
          <svg class="vis" viewBox="0 0 100 100">${bars}</svg>
          <div class="big"><span id="ut">–</span></div>
          <div class="sub" id="usub">–</div>
        </div>`);
    }

    if (c.show_humidity) {
      tiles.push(`
        <div class="tile" data-e="humidity">
          <div class="lab">Luftfeuchte</div>
          <svg class="vis" viewBox="0 0 100 100">
            <circle class="trk" cx="50" cy="50" r="40"/>
            <circle class="val" id="hv" cx="50" cy="50" r="40" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 50 50)"/>
            <text class="rt" x="50" y="59"><tspan id="ht">–</tspan><tspan>%</tspan></text>
          </svg>
          ${c.show_abs_humidity ? `<div class="big"><span id="at">–</span><small id="au">g/m³</small></div><div class="sub">absolut</div>` : ""}
        </div>`);
    }

    const n = tiles.length;
    this._tileCount = n;
    const heroH = c.height || (c.show_range ? 160 : 130);
    const colStyle = c.columns ? `--fix:${c.columns}` : `--n:${n};--narrow:${Math.min(2, n)}`;

    const hero = c.show_hero
      ? `
        <div class="hero" id="hero" style="height:${heroH}px">
          <canvas id="cv"></canvas>
          <div class="hud">
            <div>
              <div class="temp"><span id="tv">–</span><span class="deg" id="tu">°C</span></div>
              ${c.show_condition ? `<div class="cond"><ha-icon id="cic" icon="mdi:weather-cloudy"></ha-icon><span id="cond">–</span></div>` : ""}
            </div>
            ${
              c.show_range
                ? `<div class="range">
                    <span><small>min</small><b id="tmin">–</b></span>
                    <div class="track" id="track"><div class="seg" id="seg"></div><div class="dot" id="dot"></div></div>
                    <span><small>max</small><b id="tmax">–</b></span>
                  </div>`
                : ""
            }
          </div>
        </div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        ${hero}
        ${c.show_forecast ? `<div class="fc" id="fc"></div>` : ""}
        ${n ? `<div class="tiles" style="${colStyle}">${tiles.join("")}</div>` : ""}
      </ha-card>`;

    /* fehlende (abgeschaltete) Elemente durch lose Platzhalter ersetzen, damit _update ohne Prüfungen läuft */
    const $ = (id) => this.shadowRoot.getElementById(id) || document.createElement("div");
    this._el = Object.fromEntries(IDS.map((i) => [i, $(i)]));
    this._bars = [...this.shadowRoot.querySelectorAll(".bar")];
    this._el.track.style.setProperty("--grad", barGradient(-10, 40));

    const open = (e) => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: e }, bubbles: true, composed: true }));
    if (c.show_hero) this._el.hero.addEventListener("click", () => open(c.weather));
    if (c.show_forecast) this._el.fc.addEventListener("click", () => open(c.weather));
    const map = { wind: c.wind, rain: c.rain, uv: c.uv, humidity: c.humidity };
    this.shadowRoot.querySelectorAll(".tile").forEach((t) => t.addEventListener("click", () => open(map[t.dataset.e])));

    if (c.show_hero) {
      this._scene = new Scene(this._el.cv);
      this._scene.p.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      if (this.isConnected) this._observe();
    }
    this._ready = true;
  }

  _observe() {
    this._ro?.disconnect();
    this._io?.disconnect();
    this._ro = new ResizeObserver(() => {
      const r = this._el.hero.getBoundingClientRect();
      if (r.width > 0) this._scene.resize(r.width, r.height);
    });
    this._ro.observe(this._el.hero);
    this._io = new IntersectionObserver((en) => {
      en[0].isIntersecting ? this._scene.start() : this._scene.stop();
    });
    this._io.observe(this._el.hero);
  }

  /* einmalig prüfen, ob alle benötigten Entitäten existieren (Meldung in der Browser-Konsole) */
  _checkEntities() {
    const c = this._cfg, st = this._hass.states;
    const need = {
      weather: c.show_hero || (c.show_forecast && !c.forecast_entity),
      forecast_entity: c.show_forecast && c.forecast_entity,
      temperature: c.show_hero,
      min: c.show_hero && c.show_range,
      max: c.show_hero && c.show_range,
      sun: c.show_hero,
      wind: c.show_wind,
      gust: c.show_wind && c.show_gust,
      rain: c.show_rain,
      uv: c.show_uv,
      humidity: c.show_humidity,
      abs_humidity: c.show_humidity && c.show_abs_humidity,
    };
    const miss = Object.keys(need)
      .filter((k) => need[k] && c[k] && !st[c[k]])
      .map((k) => `${k}: ${c[k]}`);
    if (miss.length) console.warn(`[wettercard-modular-v3] Entitäten nicht gefunden:\n  ${miss.join("\n  ")}`);
  }

  _update() {
    const h = this._hass, c = this._cfg, el = this._el;
    if (!this._checked) {
      this._checked = true;
      this._checkEntities();
    }
    const lang = h.locale?.language || h.language || "de";
    const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
    const st = (id) => h.states[id];
    const num = (id) => {
      const s = st(id);
      const v = s ? parseFloat(s.state) : NaN;
      return Number.isFinite(v) ? v : NaN;
    };
    const unit = (id, d) => st(id)?.attributes?.unit_of_measurement || d;

    /* Temperatur */
    let tC = num(c.temperature), minC = num(c.min), maxC = num(c.max);
    const tu = unit(c.temperature, "°C");
    if (/F/.test(tu)) {
      const f = (v) => (v - 32) / 1.8;
      tC = f(tC); minC = f(minC); maxC = f(maxC);
    }
    const kmh = (id) => {
      const v = num(id), u = unit(id, "km/h");
      return u === "m/s" ? v * 3.6 : u === "mph" ? v * 1.609 : u === "kn" ? v * 1.852 : v;
    };
    const wind = kmh(c.wind), gust = kmh(c.gust);

    /* Zustand */
    const night = st(c.sun)?.state === "below_horizon";
    let key = st(c.weather)?.state;
    if (!COND[key]) key = "cloudy";
    if (night && key === "sunny") key = "clear-night";
    const cond = condOf(key);

    /* Mondphase: Entität sensor.moon, sonst berechnet */
    let moonPh = MOON_PHASES[st(c.moon)?.state];
    if (moonPh === undefined) moonPh = moonPhaseCalc();

    /* Himmel nach Temperatur einfärben */
    const base = tempColor(tC);
    const cc = mixc(base, [92, 100, 118], cond.dk * 0.75);
    const violet = [26, 12, 60];
    const top = mixc(cc, violet, night ? 0.88 : 0.55);
    const bot = mixc(cc, violet, night ? 0.62 : 0.1);
    el.hero.style.background = `linear-gradient(165deg,${rgb(top)} 0%,${rgb(bot)} 100%)`;
    const acc = mixc(base, [255, 255, 255], 0.3);
    this.shadowRoot.querySelector("ha-card").style.setProperty("--acc-rgb", `${acc[0] | 0},${acc[1] | 0},${acc[2] | 0}`);

    /* Szene */
    if (this._scene) {
      const sig = `${key}|${night}|${Math.round((wind || 0) / 3)}|${Math.round(tC || 0)}|${Math.round(moonPh * 40)}|${c.moon_flip}`;
      if (sig !== this._sig) {
        this._sig = sig;
        this._scene.set({ cond, night, wind: wind || 0, temp: Number.isFinite(tC) ? tC : 15, moon: moonPh, flip: !!c.moon_flip });
      }
    }

    /* Text oben */
    el.tu.textContent = /F/.test(tu) ? "°F" : "°C";
    this._tween(tC, fmt);
    el.cond.textContent = cond.de;
    el.cic.setAttribute("icon", cond.ic);
    el.tmin.textContent = Number.isFinite(minC) ? fmt(minC) + "°" : "–";
    el.tmax.textContent = Number.isFinite(maxC) ? fmt(maxC) + "°" : "–";

    /* Thermometer-Leiste */
    const pct = (v) => clamp(((Number.isFinite(v) ? v : 15) + 10) / 50, 0, 1) * 100;
    el.dot.style.left = pct(tC) + "%";
    const lo = Number.isFinite(minC) ? pct(minC) : pct(tC);
    const hi = Number.isFinite(maxC) ? pct(maxC) : pct(tC);
    el.seg.style.clipPath = `inset(0 ${(100 - Math.max(hi, lo)).toFixed(1)}% 0 ${Math.min(lo, hi).toFixed(1)}%)`;

    /* Wind */
    el.wt.textContent = fmt(wind, 0);
    el.wsub.textContent = `Böen ${fmt(gust, 0)} km/h`;
    el.wv.setAttribute("stroke-dasharray", `${clamp((wind || 0) / 60, 0, 1) * 100} 100`);
    el.wg.setAttribute("stroke-dasharray", `${clamp((gust || 0) / 60, 0, 1) * 100} 100`);
    el.fan.style.setProperty("--spin", `${clamp(14 / Math.max(wind || 0, 1), 0.25, 14).toFixed(2)}s`);
    el.fan.style.animationPlayState = (wind || 0) < 0.5 ? "paused" : "running";

    /* Regen */
    const ru = unit(c.rain, "mm");
    const rain = num(c.rain);
    const rainMm = ru === "in" ? rain * 25.4 : rain;
    el.rt.textContent = fmt(rain, 1);
    el.ru.textContent = ru;
    const level = clamp((rainMm || 0) / 20, 0, 1);
    el.water.style.transform = `translateY(${(91 - level * 82 - (level > 0 ? 0 : -3)).toFixed(1)}px)`;

    /* UV */
    const uv = num(c.uv);
    el.ut.textContent = Number.isFinite(uv) ? fmt(uv, uv % 1 ? 1 : 0) : "–";
    el.usub.textContent = Number.isFinite(uv) ? uvLabel(uv) : "–";
    const lit = Math.round(uv || 0);
    this._bars.forEach((b, i) => (b.style.fill = i < lit ? UV_COLORS[i] : ""));

    /* Luftfeuchte */
    const hum = num(c.humidity);
    el.ht.textContent = fmt(hum, 0);
    el.hv.setAttribute("stroke-dasharray", `${clamp(hum || 0, 0, 100)} 100`);
    el.at.textContent = fmt(num(c.abs_humidity), 1);
    el.au.textContent = unit(c.abs_humidity, "g/m³");

    /* Vorschau */
    if (c.show_forecast) {
      if (!this._fcSub) {
        this._fcSub = true;
        this._subForecast();
      }
      this._renderForecast();
    }
  }

  /* Vorschau abonnieren (daily bevorzugt, sonst twice_daily, sonst hourly) */
  async _subForecast() {
    const h = this._hass;
    const id = this._cfg.forecast_entity || this._cfg.weather;
    const ent = h?.states?.[id];
    if (!ent) {
      this._fcMsg = `Vorschau: Entität ${id} nicht gefunden`;
      this._fcSub = false; // erneut versuchen, sobald die Entität da ist
      this._renderForecast();
      return;
    }
    const f = ent.attributes.supported_features || 0;
    const types = [];
    if (f & 1) types.push("daily");
    if (f & 4) types.push("twice_daily");
    if (f & 2) types.push("hourly");
    if (!types.length) {
      // ältere Integrationen: Forecast-Attribut
      const legacy = ent.attributes.forecast;
      if (Array.isArray(legacy) && legacy.length) {
        this._fc = this._aggregate(legacy);
        this._fcMsg = "";
      } else {
        this._fcMsg = `${id} liefert keine Vorschau. Mit forecast_entity eine andere weather-Entität angeben.`;
      }
      this._renderForecast();
      return;
    }
    for (const type of types) {
      try {
        const p = h.connection.subscribeMessage(
          (ev) => {
            this._fc = this._aggregate(ev.forecast || []);
            this._renderForecast();
          },
          { type: "weather/subscribe_forecast", forecast_type: type, entity_id: id }
        );
        this._fcPromise = p;
        await p;
        this._fcMsg = "";
        return;
      } catch (e) {
        this._fcMsg = `Vorschau-Fehler (${type}): ${e?.message || e?.code || e}`;
      }
    }
    this._renderForecast();
  }

  /* beliebige Vorschau-Einträge zu Tageswerten zusammenfassen */
  _aggregate(list) {
    const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const groups = new Map();
    for (const e of list) {
      const d = new Date(e.datetime);
      if (isNaN(d)) continue;
      const k = key(d);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ ...e, _d: d });
    }
    return [...groups.entries()].map(([k, it]) => {
      const day = it.filter((e) => e.is_daytime !== false);
      const pool = day.length ? day : it;
      const pick = pool.reduce((a, b) => (Math.abs(b._d.getHours() - 13) < Math.abs(a._d.getHours() - 13) ? b : a));
      const temps = it.map((e) => e.temperature).filter(Number.isFinite);
      const lows = it.map((e) => (Number.isFinite(e.templow) ? e.templow : e.temperature)).filter(Number.isFinite);
      const probs = it.map((e) => e.precipitation_probability).filter(Number.isFinite);
      const prec = it.map((e) => e.precipitation).filter(Number.isFinite);
      return {
        key: k,
        cond: pick.condition,
        hi: temps.length ? Math.max(...temps) : NaN,
        lo: lows.length ? Math.min(...lows) : NaN,
        prob: probs.length ? Math.max(...probs) : NaN,
        rain: prec.length ? prec.reduce((a, b) => a + b, 0) : NaN,
      };
    });
  }

  _renderForecast() {
    const c = this._cfg, el = this._el;
    if (!c.show_forecast || !el?.fc) return;
    const h = this._hass;
    const lang = h?.locale?.language || h?.language || "de";
    const fid = c.forecast_entity || c.weather;
    const ru = h?.states?.[fid]?.attributes?.precipitation_unit || "mm";
    const nf = (v, d = 0) => v.toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
    const days = clamp(parseInt(c.forecast_days) || 2, 1, 5);
    const now = new Date();
    const items = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const g = (this._fc || []).find((x) => x.key === k);
      if (!g) continue;
      const label = i === 0 ? "Heute" : i === 1 ? "Morgen" : d.toLocaleDateString(lang, { weekday: "short" });
      const co = COND[g.cond] || COND.cloudy;
      const parts = [];
      if (Number.isFinite(g.prob)) parts.push(`${nf(g.prob)} %`);
      if (Number.isFinite(g.rain) && g.rain > 0) parts.push(`${nf(g.rain, 1)} ${ru}`);
      const rain = parts.length ? `Regen ${parts.join(" · ")}` : Number.isFinite(g.rain) ? "trocken" : "";
      items.push(
        `<div class="fci"><ha-icon icon="${co.ic}"></ha-icon><div class="fct">` +
          `<div class="fcl">${label}<span class="fcc"> · ${co.de}</span></div>` +
          `<div class="fcv"><b>${Number.isFinite(g.hi) ? nf(g.hi) + "°" : "–"}</b>${Number.isFinite(g.lo) ? `<i>${nf(g.lo)}°</i>` : ""}</div>` +
          (rain ? `<div class="fcr">${rain}</div>` : "") +
          `</div></div>`
      );
    }
    el.fc.style.setProperty("--d", Math.max(items.length, 1));
    el.fc.classList.toggle("many", days > 2);
    const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    let html = items.join("");
    if (!items.length) {
      const msg = this._fcMsg || (Array.isArray(this._fc) ? `Keine Vorschau-Daten von ${fid}` : "");
      if (msg) html = `<div class="fcm">${esc(msg)}</div>`;
    }
    if (el.fc.dataset.h !== html) {
      el.fc.dataset.h = html;
      el.fc.innerHTML = html;
    }
  }

  _tween(target, fmt) {
    const el = this._el.tv;
    if (!Number.isFinite(target)) {
      el.textContent = "–";
      this._shown = NaN;
      return;
    }
    if (!Number.isFinite(this._shown) || this._reduced) {
      this._shown = target;
      el.textContent = fmt(target);
      return;
    }
    const from = this._shown, t0 = performance.now();
    cancelAnimationFrame(this._tweenRaf);
    const step = (now) => {
      const k = clamp((now - t0) / 700, 0, 1);
      const v = lerp(from, target, 1 - Math.pow(1 - k, 3));
      this._shown = v;
      el.textContent = fmt(v);
      if (k < 1) this._tweenRaf = requestAnimationFrame(step);
    };
    this._tweenRaf = requestAnimationFrame(step);
  }
}

if (!customElements.get("wettercard-modular-v3")) customElements.define("wettercard-modular-v3", WettercardModularV3);
console.info(`%c WETTERCARD-MODULAR-V3 %c v${VERSION} (mit Vorschau) `, "background:#ff9a3c;color:#000;font-weight:700", "background:#333;color:#fff");
window.customCards = window.customCards || [];
window.customCards.push({
  type: "wettercard-modular-v3",
  name: "Wettercard modular V3",
  description: "Kompakte, modulare Wetterstation: Bausteine einzeln schaltbar, Mond mit korrekter Phase.",
});