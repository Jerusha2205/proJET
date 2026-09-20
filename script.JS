/* ==========================================================================
   EcoLens — Personal Resource & Carbon Optimization System
   script.js

   Sections
   1. Helpers            5. Storage & state
   2. Icons              6. Views (dashboard, analysis, results, what-if, history)
   3. Assumptions        7. Charts
   4. Calculation engine 8. Router, actions & start-up
   ========================================================================== */

(() => {
  'use strict';

  /* ======================================================================
     1. HELPERS
     ====================================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reducedMotion = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const round1 = (n) => Math.round(n * 10) / 10;

  /* Edit these to localise the prototype (currency, grid mix, tariff). */
  const CONFIG = {
    currency: '₹',
    locale: 'en-IN',
    weeksPerMonth: 4.345,
    daysPerMonth: 30,
    gridKgPerKwh: 0.7, // kg CO2e per kWh of grid electricity
    tariffPerKwh: 7, // currency units per kWh
    targetCut: 0.12 // default reduction target (12 %)
  };

  const nf = (n, d = 0) =>
    Number(n).toLocaleString(CONFIG.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  const kg = (n) => nf(n, Math.abs(n) < 10 && n !== 0 ? 1 : 0);
  const money = (n) => CONFIG.currency + nf(Math.round(n / 10) * 10);

  /* Split 100 % across values so the rounded shares always add up. */
  function shares(values) {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum <= 0) return values.map(() => 0);
    const raw = values.map((v) => (v / sum) * 100);
    const floors = raw.map(Math.floor);
    let rest = 100 - floors.reduce((a, b) => a + b, 0);
    raw
      .map((r, i) => [r - floors[i], i])
      .sort((a, b) => b[0] - a[0])
      .forEach(([, i]) => {
        if (rest > 0) {
          floors[i] += 1;
          rest -= 1;
        }
      });
    return floors;
  }

  /* ======================================================================
     2. ICONS (inline, stroke style)
     ====================================================================== */
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    grid: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    plus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    motorbike: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M8.5 17h5l-2.5-7H8"/><path d="m14 10 2-3h3"/>',
    bus: '<path d="M8 6v6M16 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
    train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1M15 15l1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3M16 19l2 3"/>',
    cycle: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
    snowflake: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
    fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C11 6 12 3 14.5 3.3c2 .3 2 3.4-.4 7.1"/><path d="M13.6 12.6c4.4-1 7.4 0 7.1 2.5-.3 2-3.4 2-7.1-.4"/><path d="M10.4 12.6C9 16.6 6 18.4 4.3 16.7c-1.4-1.4.5-3.9 5.2-4.7"/>',
    tv: '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>',
    laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.3 2.6a1 1 0 0 1-.9 1.4H3.6a1 1 0 0 1-.9-1.4L4 16"/>',
    fridge: '<path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M5 10h14M15 7v1M15 13v3"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
    washing: '<rect x="3" y="2" width="18" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M7 6h.01M11 6h.01"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    drumstick: '<path d="M15.4 15.6a7.9 6 135 1 1 6.2-6.2 4.5 3.4 135 0 0-6.2 6.2"/><path d="m8.3 12.7-2.6 2.6a2.5 2.5 0 1 0-1.7 4.7 2.5 2.5 0 1 0 4.7-1.7l2.6-2.6"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    recycle: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
    down: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    up: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>'
  };

  const icon = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  const LOGO_SVG =
    '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2.6"/><path d="M11 21c0-6 3.5-9.5 10-9.5 0 6.5-3.5 10-10 9.5z" fill="currentColor"/><path d="m11 21 6-6" stroke="#0f7b6c" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function hydrateIcons(root = document) {
    $$('[data-icon]', root).forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
      el.style.display = 'inline-flex';
    });
    $$('[data-logo]', root).forEach((el) => {
      el.innerHTML = LOGO_SVG;
    });
  }

  /* ======================================================================
     3. ASSUMPTIONS — every number the engine uses lives here
     ====================================================================== */
  const CATEGORIES = ['transport', 'electricity', 'food', 'waste'];
  const CAT = {
    transport: { label: 'Transport', icon: 'car', color: '#0f7b6c', ink: '#0a5c51' },
    electricity: { label: 'Electricity', icon: 'zap', color: '#efae2f', ink: '#8a5a00' },
    food: { label: 'Food', icon: 'utensils', color: '#7fae3a', ink: '#4c7318' },
    waste: { label: 'Waste', icon: 'trash', color: '#4f86c6', ink: '#2f5f99' }
  };

  /* Transport: kg CO2e per passenger-km and rough running cost per km. */
  const MODES = {
    car: { label: 'Car', co2: 0.17, cost: 7 },
    bike: { label: 'Bike', co2: 0.08, cost: 2.5 }, // motorbike / scooter
    bus: { label: 'Bus', co2: 0.05, cost: 1.2 },
    train: { label: 'Train', co2: 0.03, cost: 0.8 },
    active: { label: 'Walk/Cycle', co2: 0, cost: 0 }
  };
  const PUBLIC_TRANSPORT = { co2: 0.04, cost: 1.0 }; // blended bus/train
  const KM_PER_DAY = { lt5: 3, '5to10': 7.5, '10to20': 15, gt20: 28 };
  const TRAVEL_DAYS = { d1_2: 1.5, d3_4: 3.5, d5_6: 5.5, daily: 7 };
  const DAYS_PHRASE = { d1_2: '1–2 days a week', d3_4: '3–4 days a week', d5_6: '5–6 days a week', daily: 'every day' };

  /* Electricity: typical power draw (kW) and typical hours at "Moderate" use.
     Appliances run side by side, so their energy simply adds up. */
  const APPLIANCES = {
    ac: { label: 'Air Conditioner', icon: 'snowflake', kw: 1.0, hours: 2.5, duty: 1 },
    fan: { label: 'Fan', icon: 'fan', kw: 0.06, hours: 10, duty: 1 },
    tv: { label: 'TV', icon: 'tv', kw: 0.1, hours: 4, duty: 1 },
    laptop: { label: 'Laptop', icon: 'laptop', kw: 0.05, hours: 6, duty: 1 },
    fridge: { label: 'Refrigerator', icon: 'fridge', kw: 0.15, hours: 24, duty: 0.35, fixed: true },
    lights: { label: 'Lights', icon: 'bulb', kw: 0.06, hours: 6, duty: 1 },
    washing: { label: 'Washing Machine', icon: 'washing', kw: 0.5, hours: 0.7, duty: 1 }
  };
  const BASE_LOAD_KWH = 0.4; // router, chargers, standby
  const USAGE_LEVELS = ['low', 'moderate', 'high'];
  const USAGE_MULT = { low: 0.7, moderate: 1, high: 1.4 };

  /* Food: monthly kg CO2e and rough spending. */
  const DIETS = {
    veg: { co2: 50, cost: 3000 },
    mixed: { co2: 80, cost: 3800 },
    nonveg: { co2: 125, cost: 4800 }
  };
  const EATOUT_LEVELS = ['rarely', 'sometimes', 'frequently'];
  const EATOUT = {
    rarely: { co2: 2, cost: 300, meals: 3 },
    sometimes: { co2: 9, cost: 1200, meals: 10 },
    frequently: { co2: 22, cost: 3200, meals: 24 }
  };

  /* Waste: monthly kg CO2e (landfill methane etc.), kg of waste and disposal cost. */
  const WASTE_LEVELS = ['low', 'moderate', 'high'];
  const WASTE = {
    low: { co2: 8, kg: 15, cost: 150 },
    moderate: { co2: 16, kg: 30, cost: 250 },
    high: { co2: 28, kg: 50, cost: 400 }
  };
  const RECYCLE = {
    regular: { co2: 0.6, cost: 0.85, diverted: 0.5 },
    sometimes: { co2: 0.8, cost: 0.93, diverted: 0.25 },
    rarely: { co2: 1, cost: 1, diverted: 0.05 }
  };

  /* Illustrative reference for the comparison chart (not official statistics). */
  const BENCHMARK = { transport: 70, electricity: 90, food: 85, waste: 14 };

  const SAMPLE_ANSWERS = {
    vehicle: 'car',
    distance: 'gt20',
    days: 'daily',
    appliances: ['ac', 'fan', 'tv', 'laptop', 'fridge', 'lights', 'washing'],
    usage: 'moderate',
    diet: 'mixed',
    eatout: 'sometimes',
    waste: 'moderate',
    recycle: 'sometimes'
  };

  /* Wizard content. Everything the person sees in the 4 steps comes from here. */
  const STEPS = [
    {
      id: 'transport',
      title: 'Transport',
      intro: 'Tell us how you usually get around.',
      questions: [
        {
          key: 'vehicle', type: 'single', layout: 'tile',
          title: 'What is your usual mode of transport?',
          hint: 'Choose the one you use most often.',
          options: [
            { v: 'car', label: 'Car', icon: 'car' },
            { v: 'bike', label: 'Bike', sub: 'Motorbike or scooter', icon: 'motorbike' },
            { v: 'bus', label: 'Bus', icon: 'bus' },
            { v: 'train', label: 'Train', icon: 'train' },
            { v: 'active', label: 'Walk/Cycle', icon: 'cycle' }
          ]
        },
        {
          key: 'distance', type: 'single', layout: 'chip',
          title: 'How much do you usually travel in a day?',
          options: [
            { v: 'lt5', label: 'Less than 5 km' },
            { v: '5to10', label: '5–10 km' },
            { v: '10to20', label: '10–20 km' },
            { v: 'gt20', label: 'More than 20 km' }
          ]
        },
        {
          key: 'days', type: 'single', layout: 'chip',
          title: 'How many days per week do you travel?',
          options: [
            { v: 'd1_2', label: '1–2' },
            { v: 'd3_4', label: '3–4' },
            { v: 'd5_6', label: '5–6' },
            { v: 'daily', label: 'Every day' }
          ]
        }
      ]
    },
    {
      id: 'electricity',
      title: 'Electricity',
      intro: 'Choose everything you use at home. Appliances can run at the same time.',
      note: "You don't need to know your exact electricity consumption. EcoLens uses typical appliance usage patterns to estimate it.",
      questions: [
        {
          key: 'appliances', type: 'multi', layout: 'tile',
          title: 'Which appliances do you commonly use?',
          hint: 'Select all that apply.',
          options: Object.keys(APPLIANCES).map((id) => ({ v: id, label: APPLIANCES[id].label, icon: APPLIANCES[id].icon }))
        },
        {
          key: 'usage', type: 'single', layout: 'chip',
          title: 'How would you describe your overall electricity usage?',
          options: [
            { v: 'low', label: 'Low', sub: 'I switch things off when not needed' },
            { v: 'moderate', label: 'Moderate', sub: 'A typical mix of on and off' },
            { v: 'high', label: 'High', sub: 'Many devices, often on for long hours' }
          ]
        }
      ]
    },
    {
      id: 'food',
      title: 'Food',
      intro: 'Your everyday eating habits.',
      questions: [
        {
          key: 'diet', type: 'single', layout: 'tile',
          title: 'What best describes your usual diet?',
          options: [
            { v: 'veg', label: 'Mostly Vegetarian', icon: 'leaf' },
            { v: 'mixed', label: 'Mixed', icon: 'utensils' },
            { v: 'nonveg', label: 'Frequently Non-Vegetarian', icon: 'drumstick' }
          ]
        },
        {
          key: 'eatout', type: 'single', layout: 'chip',
          title: 'How often do you eat outside/order food?',
          options: [
            { v: 'rarely', label: 'Rarely', sub: 'A few times a month' },
            { v: 'sometimes', label: 'Sometimes', sub: 'Once or twice a week' },
            { v: 'frequently', label: 'Frequently', sub: 'Several times a week' }
          ]
        }
      ]
    },
    {
      id: 'waste',
      title: 'Waste',
      intro: 'What happens to your household waste.',
      questions: [
        {
          key: 'waste', type: 'single', layout: 'chip',
          title: 'How would you describe your household waste?',
          options: [
            { v: 'low', label: 'Low', sub: 'About one small bag a week' },
            { v: 'moderate', label: 'Moderate', sub: 'Two or three bags a week' },
            { v: 'high', label: 'High', sub: 'A bag almost every day' }
          ]
        },
        {
          key: 'recycle', type: 'single', layout: 'chip',
          title: 'How often do you recycle?',
          options: [
            { v: 'regular', label: 'Regularly', sub: 'I separate most recyclables' },
            { v: 'sometimes', label: 'Sometimes' },
            { v: 'rarely', label: 'Rarely/Never' }
          ]
        }
      ]
    }
  ];

  function labelOf(key, value) {
    for (const s of STEPS) {
      for (const q of s.questions) {
        if (q.key === key) {
          const o = q.options.find((x) => x.v === value);
          if (o) return o.label;
        }
      }
    }
    return value;
  }

  /* ======================================================================
     4. CALCULATION ENGINE
        calculate(answers, mods) -> monthly CO2e, resource use and cost.
        `mods` lets the What-If simulator change one habit without touching
        the person's saved answers.
     ====================================================================== */
  function calcTransport(a, m = {}) {
    const mode = MODES[a.vehicle] || MODES.car;
    const days = TRAVEL_DAYS[a.days] || 0;
    const km = KM_PER_DAY[a.distance] || 0;
    const canSwitch = a.vehicle === 'car' || a.vehicle === 'bike';
    const publicDays = canSwitch ? Math.min(m.publicDays || 0, days) : 0;
    const activeDays = a.vehicle === 'active' ? 0 : Math.min(m.activeDays || 0, Math.max(0, days - publicDays));
    const ownDays = Math.max(0, days - publicDays - activeDays);
    const w = CONFIG.weeksPerMonth;
    return {
      co2: w * km * (ownDays * mode.co2 + publicDays * PUBLIC_TRANSPORT.co2),
      cost: w * km * (ownDays * mode.cost + publicDays * PUBLIC_TRANSPORT.cost),
      km: w * km * days
    };
  }

  function acBaseHours(a) {
    return APPLIANCES.ac.hours * (USAGE_MULT[a.usage] || 1);
  }

  function calcElectricity(a, m = {}) {
    let level = USAGE_LEVELS.indexOf(a.usage);
    if (level < 0) level = 1;
    if (m.levelDown) level = Math.max(0, level - 1);
    const mult = USAGE_MULT[USAGE_LEVELS[level]];
    let kwhPerDay = BASE_LOAD_KWH;
    (a.appliances || []).forEach((id) => {
      const ap = APPLIANCES[id];
      if (!ap) return;
      let hours = ap.hours * (ap.fixed ? 1 : mult);
      if (id === 'ac' && m.acHoursCut) hours = Math.max(0, hours - m.acHoursCut);
      kwhPerDay += ap.kw * hours * ap.duty;
    });
    const kwh = kwhPerDay * CONFIG.daysPerMonth;
    return { co2: kwh * CONFIG.gridKgPerKwh, cost: kwh * CONFIG.tariffPerKwh, kwh };
  }

  function calcFood(a, m = {}) {
    const diet = DIETS[a.diet] || DIETS.mixed;
    let level = EATOUT_LEVELS.indexOf(a.eatout);
    if (level < 0) level = 1;
    if (m.eatOutDown) level = Math.max(0, level - 1);
    const eat = EATOUT[EATOUT_LEVELS[level]];
    let co2 = diet.co2;
    let cost = diet.cost;
    if (m.meatFreeDays) {
      const f = Math.min(m.meatFreeDays, 7) / 7;
      co2 -= (diet.co2 - DIETS.veg.co2) * f;
      cost -= (diet.cost - DIETS.veg.cost) * f;
    }
    return { co2: co2 + eat.co2, cost: cost + eat.cost, meals: eat.meals };
  }

  function calcWaste(a, m = {}) {
    let level = WASTE_LEVELS.indexOf(a.waste);
    if (level < 0) level = 1;
    if (m.wasteDown) level = Math.max(0, level - 1);
    const w = WASTE[WASTE_LEVELS[level]];
    const r = RECYCLE[m.recycleTo || a.recycle] || RECYCLE.sometimes;
    return { co2: w.co2 * r.co2, cost: w.cost * r.cost, kg: w.kg, recycled: w.kg * r.diverted };
  }

  function calculate(a, mods = {}) {
    const transport = calcTransport(a, mods.transport);
    const electricity = calcElectricity(a, mods.electricity);
    const food = calcFood(a, mods.food);
    const waste = calcWaste(a, mods.waste);
    return {
      transport, electricity, food, waste,
      total: transport.co2 + electricity.co2 + food.co2 + waste.co2,
      cost: transport.cost + electricity.cost + food.cost + waste.cost
    };
  }

  const biggestCat = (r) => CATEGORIES.reduce((best, c) => (r[c].co2 > r[best].co2 ? c : best), CATEGORIES[0]);

  function isComplete(a) {
    if (!a) return false;
    return STEPS.every((s) =>
      s.questions.every((q) => {
        const val = a[q.key];
        if (q.type === 'multi') return Array.isArray(val) && val.length > 0 && val.every((v) => q.options.some((o) => o.v === v));
        return q.options.some((o) => o.v === val);
      })
    );
  }

  /* What-if scenarios. Each one changes a single habit. `blocked` returns a
     plain-English reason when the scenario doesn't apply to this person. */
  const daysFmt = (v) => `${v} day${v === 1 ? '' : 's'} a week`;
  const SCENARIOS = {
    transport: [
      {
        id: 'public',
        title: 'Use public transport on some days',
        desc: 'Swap car or bike trips for the bus or train.',
        blocked: (a) => (a.vehicle === 'car' || a.vehicle === 'bike' ? null : 'You already travel by bus, train, or on foot.'),
        control: {
          label: 'Days per week on public transport',
          fmt: daysFmt,
          range: (a) => {
            const max = Math.max(1, Math.min(5, Math.floor(TRAVEL_DAYS[a.days])));
            return { min: 1, max, step: 1, def: Math.min(2, max) };
          }
        },
        mods: (v) => ({ publicDays: v }),
        explain: ({ a, v }) => {
          const m = MODES[a.vehicle];
          const n = Math.min(v, TRAVEL_DAYS[a.days]);
          const km = CONFIG.weeksPerMonth * KM_PER_DAY[a.distance] * n;
          return `You travel ${DAYS_PHRASE[a.days]}. Taking the bus or train on ${nf(n)} of those days moves about ${nf(km)} km a month off your ${m.label.toLowerCase()}. Public transport is shared, so it produces roughly ${nf(PUBLIC_TRANSPORT.co2, 2)} kg CO₂e per km compared with about ${nf(m.co2, 2)} kg by ${m.label.toLowerCase()}.`;
        }
      },
      {
        id: 'active',
        title: 'Walk or cycle on some days',
        desc: 'Best for shorter daily trips.',
        blocked: (a) => {
          if (a.vehicle === 'active') return 'You already walk or cycle.';
          if (a.distance !== 'lt5' && a.distance !== '5to10') return 'Walking or cycling works best when you travel under 10 km a day.';
          return null;
        },
        control: {
          label: 'Days per week on foot or by bicycle',
          fmt: daysFmt,
          range: (a) => {
            const max = Math.max(1, Math.min(4, Math.floor(TRAVEL_DAYS[a.days])));
            return { min: 1, max, step: 1, def: Math.min(2, max) };
          }
        },
        mods: (v) => ({ activeDays: v }),
        explain: ({ a, v }) => {
          const m = MODES[a.vehicle];
          const n = Math.min(v, TRAVEL_DAYS[a.days]);
          const km = CONFIG.weeksPerMonth * KM_PER_DAY[a.distance] * n;
          return `Walking or cycling on ${nf(n)} of your travel days replaces about ${nf(km)} km a month of ${m.label.toLowerCase()} travel. Those trips produce no fuel emissions and cost nothing to run.`;
        }
      }
    ],
    electricity: [
      {
        id: 'ac',
        title: 'Reduce AC usage',
        desc: 'Run the air conditioner for fewer hours each day.',
        blocked: (a) => ((a.appliances || []).includes('ac') ? null : "You didn't select an air conditioner in your analysis."),
        control: {
          label: 'Hours less AC per day',
          fmt: (v) => `${nf(v, v % 1 ? 1 : 0)} hour${v === 1 ? '' : 's'} less`,
          range: (a) => {
            const max = Math.max(0.5, Math.floor(acBaseHours(a) * 2) / 2);
            return { min: 0.5, max, step: 0.5, def: Math.min(1, max) };
          }
        },
        mods: (v) => ({ acHoursCut: v }),
        explain: ({ a, v }) => {
          const hrs = acBaseHours(a);
          const cut = Math.min(v, hrs);
          const kwh = APPLIANCES.ac.kw * cut * CONFIG.daysPerMonth;
          return `Your AC is estimated to run about ${nf(hrs, 1)} hours a day. Cutting ${nf(cut, cut % 1 ? 1 : 0)} of those hours saves about ${nf(kwh)} kWh a month. A fan or a slightly higher thermostat setting covers much of the comfort. Each kWh saved avoids about ${nf(CONFIG.gridKgPerKwh, 1)} kg CO₂e.`;
        }
      },
      {
        id: 'level',
        title: 'Use electricity a little more carefully',
        desc: 'Move one step down, for example High to Moderate.',
        blocked: (a) => (a.usage === 'low' ? 'Your usage is already described as low.' : null),
        mods: () => ({ levelDown: true }),
        explain: ({ a, before, after }) => {
          const next = USAGE_LEVELS[Math.max(0, USAGE_LEVELS.indexOf(a.usage) - 1)];
          const kwh = before.electricity.kwh - after.electricity.kwh;
          return `Moving from ${labelOf('usage', a.usage).toLowerCase()} to ${labelOf('usage', next).toLowerCase()} electricity use means switching things off when you leave a room, using fans before AC, and skipping standby. That saves about ${nf(kwh)} kWh a month.`;
        }
      }
    ],
    food: [
      {
        id: 'meatfree',
        title: 'Choose vegetarian meals more often',
        desc: 'Replace some meat-based days with vegetarian ones.',
        blocked: (a) => (a.diet === 'veg' ? 'You already eat mostly vegetarian food.' : null),
        control: {
          label: 'Vegetarian days per week',
          fmt: daysFmt,
          range: () => ({ min: 1, max: 4, step: 1, def: 2 })
        },
        mods: (v) => ({ meatFreeDays: v }),
        explain: ({ a, v, before, after }) =>
          `Making ${v} more day${v === 1 ? '' : 's'} a week fully vegetarian lowers the emissions of your ${labelOf('diet', a.diet).toLowerCase()} diet. Plant-based meals usually cost less too, about ${money(before.food.cost - after.food.cost)} a month by this estimate.`
      },
      {
        id: 'eatout',
        title: 'Cook at home more often',
        desc: 'Eat out or order in one step less often.',
        blocked: (a) => (a.eatout === 'rarely' ? 'You already eat out rarely.' : null),
        mods: () => ({ eatOutDown: true }),
        explain: ({ a, before, after }) => {
          const next = EATOUT_LEVELS[Math.max(0, EATOUT_LEVELS.indexOf(a.eatout) - 1)];
          const meals = before.food.meals - after.food.meals;
          return `Going from eating out "${labelOf('eatout', a.eatout).toLowerCase()}" to "${labelOf('eatout', next).toLowerCase()}" means about ${nf(meals)} fewer restaurant or delivery meals a month. That cuts packaging, delivery trips, and spending.`;
        }
      }
    ],
    waste: [
      {
        id: 'recycle',
        title: 'Increase recycling',
        desc: 'Separate recyclables regularly.',
        blocked: (a) => (a.recycle === 'regular' ? 'You already recycle regularly.' : null),
        mods: () => ({ recycleTo: 'regular' }),
        explain: ({ a, before, after }) =>
          `Recycling regularly instead of "${labelOf('recycle', a.recycle).toLowerCase()}" keeps about ${nf(after.waste.recycled - before.waste.recycled)} more kg of your monthly waste out of landfill, where it would otherwise release methane as it breaks down.`
      },
      {
        id: 'reduce',
        title: 'Create less waste',
        desc: 'Cut household waste by one level with less packaging and composting.',
        blocked: (a) => (a.waste === 'low' ? 'Your household waste is already low.' : null),
        mods: () => ({ wasteDown: true }),
        explain: ({ a, before, after }) => {
          const next = WASTE_LEVELS[Math.max(0, WASTE_LEVELS.indexOf(a.waste) - 1)];
          return `Moving from ${labelOf('waste', a.waste).toLowerCase()} to ${labelOf('waste', next).toLowerCase()} household waste avoids about ${nf(before.waste.kg - after.waste.kg)} kg of rubbish a month and the methane it would release in landfill.`;
        }
      }
    ]
  };

  const getScenario = (cat, id) => (SCENARIOS[cat] || []).find((s) => s.id === id);

  /* Try every available scenario at its default strength, best first. */
  function ideasFor(a) {
    const before = calculate(a);
    const list = [];
    CATEGORIES.forEach((cat) =>
      SCENARIOS[cat].forEach((sc) => {
        if (sc.blocked(a)) return;
        const v = sc.control ? sc.control.range(a).def : null;
        const after = calculate(a, { [cat]: sc.mods(v, a) });
        list.push({ cat, sc, v, co2: before.total - after.total, cost: before.cost - after.cost });
      })
    );
    return list.sort((x, y) => y.co2 - x.co2);
  }

  function bestPerCategory(list) {
    const seen = new Set();
    return list.filter((i) => {
      if (seen.has(i.cat)) return false;
      seen.add(i.cat);
      return true;
    });
  }

  /* ======================================================================
     5. STORAGE & STATE
     ====================================================================== */
  const KEYS = { session: 'ecolens.session', data: 'ecolens.data' };

  const store = {
    read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
    }
  };

  const emptyDraft = () => ({
    vehicle: null, distance: null, days: null,
    appliances: [], usage: null,
    diet: null, eatout: null,
    waste: null, recycle: null
  });

  const state = {
    session: null,
    data: { users: {} },
    current: null, // { answers, result, sample, savedId, date }
    draft: emptyDraft(),
    step: 0,
    wi: { cat: 'transport', opt: 'public', value: 2 },
    historyMode: 'total',
    charts: {},
    timers: []
  };

  function seedHistory() {
    const base = calculate(SAMPLE_ANSWERS);
    const mult = [
      [1.22, 1.1, 1.15, 1.2],
      [1.14, 1.08, 1.12, 1.1],
      [1.06, 1.03, 1.05, 1.05],
      [1, 1, 1, 1]
    ];
    const offsets = [24, 16, 8, 3];
    return mult.map((m, i) => {
      const d = new Date(Date.now() - offsets[i] * 86400000);
      d.setHours(12, 0, 0, 0);
      const vals = CATEGORIES.map((c, k) => base[c].co2 * m[k]);
      const cost = base.cost * (m[0] * 0.4 + m[1] * 0.3 + m[2] * 0.3);
      return {
        id: `demo-${i + 1}`,
        date: d.toISOString(),
        total: round1(vals.reduce((x, y) => x + y, 0)),
        transport: round1(vals[0]),
        electricity: round1(vals[1]),
        food: round1(vals[2]),
        waste: round1(vals[3]),
        cost: Math.round(cost),
        demo: true
      };
    });
  }

  function saveData() {
    store.write(KEYS.data, state.data);
  }

  function getUser() {
    const key = state.session.key;
    if (!state.data.users[key]) {
      state.data.users[key] = { history: seedHistory(), current: null };
      saveData();
    }
    return state.data.users[key];
  }

  const getHistory = () =>
    getUser().history.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  function setCurrent(cur) {
    cur.result = calculate(cur.answers);
    state.current = cur;
  }

  function loadUserState() {
    state.data = store.read(KEYS.data, { users: {} });
    if (!state.data.users) state.data = { users: {} };
    const u = getUser();
    if (u.current && isComplete(u.current.answers)) {
      setCurrent({ answers: u.current.answers, sample: false, savedId: u.current.savedId || null, date: u.current.date });
    } else {
      const lastDemo = u.history.filter((r) => r.demo).slice(-1)[0];
      setCurrent({
        answers: JSON.parse(JSON.stringify(SAMPLE_ANSWERS)),
        sample: true,
        savedId: lastDemo ? lastDemo.id : null,
        date: new Date().toISOString()
      });
    }
    state.draft = emptyDraft();
    state.step = 0;
    resetWi();
  }

  function persistCurrent() {
    const u = getUser();
    const c = state.current;
    u.current = c.sample ? null : { answers: c.answers, savedId: c.savedId, date: c.date };
    saveData();
  }

  function resetWi() {
    state.wi = { cat: 'transport', opt: 'public', value: null };
    ensureWi();
  }

  function ensureWi() {
    const a = state.current.answers;
    let sc = getScenario(state.wi.cat, state.wi.opt);
    if (!sc || sc.blocked(a)) {
      sc = SCENARIOS[state.wi.cat].find((s) => !s.blocked(a)) || SCENARIOS[state.wi.cat][0];
      state.wi.opt = sc.id;
      state.wi.value = sc.control ? sc.control.range(a).def : null;
    } else if (sc.control) {
      const r = sc.control.range(a);
      if (state.wi.value == null || state.wi.value < r.min || state.wi.value > r.max) state.wi.value = r.def;
    } else {
      state.wi.value = null;
    }
  }

  /* ======================================================================
     6. VIEWS
     ====================================================================== */
  const fmtDate = (iso, withYear) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const sameYear = (iso) => new Date(iso).getFullYear() === new Date().getFullYear();

  function disclaimer() {
    return `<p class="disclaimer">${icon('info')}<span>These values are estimates based on typical usage assumptions and are not exact measurements.</span></p>`;
  }

  function sampleNotice() {
    if (!state.current.sample) return '';
    return `<div class="notice">${icon('info')}<p>You're looking at sample data so nothing is empty. Answer a few questions to see your own estimate.</p><button class="btn btn-primary btn-sm" type="button" data-action="start-analysis">START NEW ANALYSIS</button></div>`;
  }

  function ribbonHTML(res, { width = 100, id = '' } = {}) {
    const segs = CATEGORIES.map((c) => {
      const v = res[c].co2;
      return `<span class="seg seg-${c}" style="flex:${Math.max(v, 0.001).toFixed(3)} 1 0;${v < 0.05 ? 'display:none' : ''}" title="${CAT[c].label}: ${kg(v)} kg CO₂e"></span>`;
    }).join('');
    return `<div class="ribbon-track"><div class="ribbon"${id ? ` id="${id}"` : ''} style="width:${width}%">${segs}</div></div>`;
  }

  function setRibbon(el, res, widthPct) {
    if (!el) return;
    el.style.width = `${widthPct}%`;
    $$('.seg', el).forEach((seg, i) => {
      const v = res[CATEGORIES[i]].co2;
      seg.style.flexGrow = Math.max(v, 0.001).toFixed(3);
      seg.style.display = v < 0.05 ? 'none' : '';
    });
  }

  function legendHTML(res) {
    const sh = shares(CATEGORIES.map((c) => res[c].co2));
    return `<ul class="legend">${CATEGORIES.map(
      (c, i) => `<li><i style="background:${CAT[c].color}"></i>${CAT[c].label} <b>${sh[i]}%</b></li>`
    ).join('')}</ul>`;
  }

  function sparkline(vals, w = 132, h = 40) {
    if (vals.length < 2) return '';
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = 4;
    const x = (i) => pad + (i * (w - 2 * pad)) / (vals.length - 1);
    const y = (v) => (max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - 2 * pad));
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Trend of your recent estimates"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="3.5" fill="currentColor"/></svg>`;
  }

  function countUp(el, to) {
    if (!el) return;
    if (reducedMotion()) {
      el.textContent = nf(to);
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = nf(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon('check')}<span>${esc(message)}</span>`;
    $('#toast-region').appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  /* The record just before the current estimate, used for "vs previous". */
  function baselineRecord() {
    const all = getHistory();
    const idx = all.findIndex((r) => r.id === state.current.savedId);
    if (idx >= 0) return all[idx - 1] || null;
    return all[all.length - 1] || null;
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    const root = $('#view-dashboard');
    const cur = state.current;
    const r = cur.result;
    const top = biggestCat(r);
    const sh = shares(CATEGORIES.map((c) => r[c].co2));
    const topShare = sh[CATEGORIES.indexOf(top)];
    const best = bestPerCategory(ideasFor(cur.answers));
    const potCo2 = best.reduce((s, i) => s + i.co2, 0);
    const potCost = best.reduce((s, i) => s + i.cost, 0);

    const base = baselineRecord();
    let deltaChip = '<span class="chip">First estimate</span>';
    if (base) {
      const pct = ((r.total - base.total) / base.total) * 100;
      if (Math.abs(pct) < 0.5) deltaChip = '<span class="chip">No change</span>';
      else if (pct < 0) deltaChip = `<span class="chip chip-down">${icon('down')} ${nf(Math.abs(pct))}% vs previous</span>`;
      else deltaChip = `<span class="chip chip-up">${icon('up')} ${nf(pct)}% vs previous</span>`;
    }
    const series = getHistory().map((h) => h.total);
    if (state.current.savedId == null || !getHistory().some((h) => h.id === state.current.savedId)) series.push(r.total);
    const spark = sparkline(series.slice(-6));

    root.innerHTML = `
      <section class="hero">
        <h1>Welcome, ${esc(state.session.name)}</h1>
        <p class="lead">EcoLens estimates your everyday resource usage and shows where you can reduce cost and environmental impact.</p>
        <div class="hero-actions">
          <button class="btn btn-light" type="button" data-action="start-analysis">START NEW ANALYSIS</button>
          <button class="btn btn-outline-light" type="button" data-action="goto" data-to="history">VIEW HISTORY</button>
        </div>
        <p class="hero-mix-title">Where your monthly footprint comes from</p>
        ${ribbonHTML(r)}
        ${legendHTML(r)}
      </section>

      ${sampleNotice() ? `<div style="margin-top:20px">${sampleNotice()}</div>` : ''}

      <section class="stats" aria-label="Summary">
        <article class="card stat">
          <div class="stat-top"><span class="card-label">Current Estimated Footprint</span><span class="stat-icon">${icon('leaf')}</span></div>
          <p class="big-num stat-value">${nf(r.total / CONFIG.daysPerMonth, 1)}<span class="unit">kg CO₂e / day</span></p>
          <p class="stat-sub">An average day, based on your typical habits.</p>
        </article>
        <article class="card stat">
          <div class="stat-top"><span class="card-label">Monthly Estimate</span>${deltaChip}</div>
          <p class="big-num stat-value">${nf(r.total)}<span class="unit">kg CO₂e</span></p>
          ${spark || '<p class="stat-sub">Save more analyses to see a trend.</p>'}
        </article>
        <article class="card stat">
          <div class="stat-top"><span class="card-label">Biggest Contributor</span><span class="stat-icon">${icon(CAT[top].icon)}</span></div>
          <p class="big-num stat-value word">${CAT[top].label}</p>
          <p class="stat-sub">${topShare}% of your footprint, about ${kg(r[top].co2)} kg CO₂e a month.</p>
        </article>
        <article class="card stat">
          <div class="stat-top"><span class="card-label">Potential Savings</span><span class="stat-icon">${icon('down')}</span></div>
          <p class="big-num stat-value">${potCo2 >= 1 ? '≈ ' + kg(potCo2) : '0'}<span class="unit">kg CO₂e / month</span></p>
          <p class="stat-sub">${potCost >= 5 ? `Plus about ${money(potCost)} a month, ` : ''}if you act on the top idea in each area.</p>
        </article>
      </section>

      <section class="card how">
        <h2>How EcoLens works</h2>
        <ol>
          <li><strong>Answer simple questions</strong><p>How you travel, what you use at home, what you eat and throw away. No meter readings.</p></li>
          <li><strong>We estimate the rest</strong><p>Typical appliance ratings and emission factors turn your answers into kg CO₂e and cost.</p></li>
          <li><strong>Try a change first</strong><p>The What-If simulator shows what one new habit could save before you commit.</p></li>
        </ol>
      </section>
      ${disclaimer()}`;
  }

  /* ---------- Analysis wizard ---------- */
  function renderAnalysis() {
    const root = $('#view-analysis');
    root.innerHTML = `
      <header class="view-head">
        <div>
          <h1>New analysis</h1>
          <p class="muted">Answer a few everyday questions. EcoLens does the technical maths for you.</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-action="sample-answers">${icon('sparkles')} Use sample answers</button>
      </header>
      <section class="card wizard" aria-label="Analysis steps">
        <div class="wz-top">
          <p class="wz-count" id="wz-count"></p>
          <div class="progress" id="wz-progress" role="progressbar" aria-label="Analysis progress" aria-valuemin="0" aria-valuemax="4"><span id="wz-bar"></span></div>
          <ol class="steps" id="wz-steps" aria-label="Steps"></ol>
        </div>
        <div class="wz-body" id="wz-body"></div>
        <div class="wz-foot" id="wz-foot">
          <button class="btn btn-secondary" type="button" id="wz-back" data-action="wz-back">← Back</button>
          <button class="btn btn-primary" type="button" id="wz-next" data-action="wz-next">NEXT →</button>
        </div>
      </section>`;
    renderStep(false);
  }

  function choiceHTML(q, o) {
    const multi = q.type === 'multi';
    const checked = multi ? (state.draft[q.key] || []).includes(o.v) : state.draft[q.key] === o.v;
    return `<label class="choice">
      <input type="${multi ? 'checkbox' : 'radio'}" name="${q.key}" value="${o.v}"${checked ? ' checked' : ''}>
      <span class="choice-body">
        ${o.icon ? `<span class="choice-icon">${icon(o.icon)}</span>` : ''}
        <span class="choice-text"><strong>${esc(o.label)}</strong>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>
        <span class="choice-check">${icon('check')}</span>
      </span>
    </label>`;
  }

  function questionHTML(q) {
    return `<fieldset class="q" data-key="${q.key}">
      <legend>${esc(q.title)}</legend>
      ${q.hint ? `<p class="q-hint">${esc(q.hint)}</p>` : ''}
      <div class="choices ${q.layout === 'tile' ? 'tiles' : 'chips'}">${q.options.map((o) => choiceHTML(q, o)).join('')}</div>
      <p class="q-error" role="alert" hidden>${q.type === 'multi' ? 'Select at least one option to continue.' : 'Choose an option to continue.'}</p>
    </fieldset>`;
  }

  function renderStep(animate = true) {
    const step = STEPS[state.step];
    const last = state.step === STEPS.length - 1;
    $('#wz-count').textContent = `Step ${state.step + 1} of ${STEPS.length}`;
    $('#wz-bar').style.width = `${((state.step + 1) / STEPS.length) * 100}%`;
    $('#wz-progress').setAttribute('aria-valuenow', String(state.step + 1));
    $('#wz-steps').innerHTML = STEPS.map((s, i) => {
      const cls = i < state.step ? 'is-done' : i === state.step ? 'is-current' : '';
      return `<li class="${cls}"${i === state.step ? ' aria-current="step"' : ''}>${s.title}</li>`;
    }).join('');

    const body = $('#wz-body');
    body.innerHTML = `<div class="wz-panel${animate ? ' enter' : ''}">
        <h2>${step.title}</h2>
        <p class="muted">${esc(step.intro)}</p>
        ${step.questions.map(questionHTML).join('')}
        ${step.note ? `<div class="note">${icon('info')}<p>${esc(step.note)}</p></div>` : ''}
      </div>`;
    $('#wz-foot').hidden = false;
    $('#wz-next').innerHTML = last ? 'CALCULATE MY FOOTPRINT' : 'NEXT →';
    const foot = $('#wz-foot');
    let disc = $('#wz-disclaimer');
    if (disc) disc.remove();
    if (last) {
      foot.insertAdjacentHTML('afterend', '<p class="wz-disclaimer" id="wz-disclaimer">These values are estimates based on typical usage assumptions and are not exact measurements.</p>');
    }
  }

  const isAnswered = (q) => (q.type === 'multi' ? (state.draft[q.key] || []).length > 0 : !!state.draft[q.key]);

  function wizardNext() {
    const step = STEPS[state.step];
    const missing = step.questions.filter((q) => !isAnswered(q));
    step.questions.forEach((q) => {
      const fs = $(`.q[data-key="${q.key}"]`);
      if (!fs) return;
      const bad = missing.includes(q);
      fs.classList.toggle('has-error', bad);
      $('.q-error', fs).hidden = !bad;
    });
    if (missing.length) {
      const fs = $(`.q[data-key="${missing[0].key}"]`);
      fs.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      const input = $('input', fs);
      if (input) input.focus({ preventScroll: true });
      return;
    }
    if (state.step < STEPS.length - 1) {
      state.step += 1;
      renderStep(true);
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    } else {
      runAnalysis();
    }
  }

  function wizardBack() {
    if (state.step === 0) {
      navigate('dashboard');
      return;
    }
    state.step -= 1;
    renderStep(true);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /* The short "analysis" moment between the Waste step and the results. */
  function runAnalysis() {
    const body = $('#wz-body');
    $('#wz-foot').hidden = true;
    const disc = $('#wz-disclaimer');
    if (disc) disc.remove();
    $('#wz-bar').style.width = '100%';
    body.innerHTML = `<div class="analyzing" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <h2>Estimating your footprint</h2>
        <p class="muted">Turning your answers into typical usage patterns.</p>
        <ul class="ana-list">${CATEGORIES.map(
          (c) => `<li data-cat="${c}">${icon(CAT[c].icon)}<span>${CAT[c].label}</span><i class="tick">${icon('check')}</i></li>`
        ).join('')}</ul>
      </div>`;
    const gap = reducedMotion() ? 0 : 340;
    CATEGORIES.forEach((c, i) => {
      state.timers.push(setTimeout(() => {
        const li = $(`.ana-list li[data-cat="${c}"]`);
        if (li) li.classList.add('done');
      }, gap * (i + 1)));
    });
    state.timers.push(setTimeout(finishAnalysis, gap * (CATEGORIES.length + 1) + (reducedMotion() ? 0 : 200)));
  }

  function finishAnalysis() {
    setCurrent({
      answers: JSON.parse(JSON.stringify(state.draft)),
      sample: false,
      savedId: null,
      date: new Date().toISOString()
    });
    persistCurrent();
    state.draft = emptyDraft();
    state.step = 0;
    resetWi();
    toast('Your estimate is ready');
    navigate('results');
  }

  /* ---------- Results ---------- */
  function saveSlotHTML() {
    const c = state.current;
    if (c.sample) return `<button class="btn btn-primary" type="button" data-action="start-analysis">START NEW ANALYSIS</button>`;
    if (c.savedId && getHistory().some((h) => h.id === c.savedId)) {
      return `<span class="badge" style="min-height:46px;padding:0 18px;font-size:.95rem">${icon('check')} Saved to history</span>`;
    }
    return `<button class="btn btn-primary" type="button" data-action="save-analysis">${icon('save')} SAVE ANALYSIS</button>`;
  }

  function renderResults() {
    const root = $('#view-results');
    const cur = state.current;
    const r = cur.result;
    const sh = shares(CATEGORIES.map((c) => r[c].co2));
    const top = biggestCat(r);
    const equivKm = Math.round(r.total / MODES.car.co2 / 10) * 10;

    const ideas = bestPerCategory(ideasFor(cur.answers));
    const potential = ideas.reduce((s, i) => s + i.co2, 0);
    const reduceBy = Math.min(r.total * CONFIG.targetCut, potential);
    const hasTarget = reduceBy >= 1;
    const target = Math.round(r.total - reduceBy);
    const fillPct = hasTarget ? Math.max(0, Math.min(100, (target / r.total) * 100)) : 100;

    const resourceText = {
      transport: `${nf(r.transport.km)} km travelled`,
      electricity: `${nf(r.electricity.kwh)} kWh of electricity`,
      food: `${nf(r.food.meals)} meals eaten out or ordered`,
      waste: `${nf(r.waste.kg)} kg of waste, ${nf(r.waste.recycled)} kg recycled`
    };

    root.innerHTML = `
      <header class="view-head">
        <div>
          <h1>Your results</h1>
          <p class="muted">${cur.sample ? 'Sample profile' : 'Analysis from ' + fmtDate(cur.date, !sameYear(cur.date))}. Monthly estimates.</p>
        </div>
        <span class="badge">${icon('info')} Estimate</span>
      </header>
      ${sampleNotice()}

      <section class="card hero-result">
        <div>
          <p class="card-label">Estimated Monthly Carbon Footprint</p>
          <p class="big-num"><span id="count-total">0</span><span class="unit">kg CO₂e</span></p>
          <p class="lead">Your biggest contributor is <strong>${CAT[top].label}</strong>.</p>
          <p class="muted">That's ${sh[CATEGORIES.indexOf(top)]}% of the total. The whole footprint is roughly what an average car emits over ${nf(equivKm)} km.</p>
        </div>
        <div>
          ${ribbonHTML(r)}
          ${legendHTML(r)}
        </div>
      </section>

      <section class="cat-grid" aria-label="Footprint by category">
        ${CATEGORIES.map(
          (c, i) => `<article class="card cat-card" style="--cat:${CAT[c].color};--cat-ink:${CAT[c].ink}">
            <div class="cat-head"><span class="cat-ico">${icon(CAT[c].icon)}</span>${CAT[c].label}<span class="chip">${sh[i]}%</span></div>
            <p class="big-num">${kg(r[c].co2)}<span class="unit">kg CO₂e</span></p>
            <div class="cat-meta"><span>${resourceText[c]}</span><span>≈ ${money(r[c].cost)} a month</span></div>
          </article>`
        ).join('')}
      </section>

      <section class="grid-2">
        <article class="card">
          <div class="card-title"><h2>Share of your footprint</h2></div>
          <div class="chart-box"><canvas id="chart-doughnut" aria-label="Doughnut chart of footprint by category" role="img"></canvas></div>
        </article>
        <article class="card">
          <div class="card-title"><h2>Compared with a typical household</h2><span class="tiny">Reference values are illustrative</span></div>
          <div class="chart-box"><canvas id="chart-compare" aria-label="Bar chart comparing your footprint with a typical household" role="img"></canvas></div>
        </article>
      </section>

      <section class="grid-2">
        <article class="card">
          <div class="card-title"><h2>Estimated monthly resource/cost impact</h2></div>
          <div class="cost-total"><p class="big-num">≈ ${money(r.cost)}</p><span class="muted">a month, all categories</span></div>
          <div class="rows">
            ${CATEGORIES.map(
              (c) => `<div class="row"><span class="name"><i style="background:${CAT[c].color}"></i>${CAT[c].label}</span><span class="res">${resourceText[c]}</span><span class="amt">${money(r[c].cost)}</span></div>`
            ).join('')}
          </div>
          <p class="tiny" style="margin-top:12px">Food is a rough spending estimate for groceries and eating out. Waste covers bags and disposal.</p>
        </article>

        <article class="card">
          <div class="card-title"><h2>Reduction target</h2></div>
          ${
            hasTarget
              ? `<div class="target-nums">
                  <div><small>Current</small><p class="big-num">${nf(r.total)}<span class="unit">kg CO₂e</span></p></div>
                  <span class="arrow" aria-hidden="true">→</span>
                  <div><small>Target</small><p class="big-num tgt">${nf(target)}<span class="unit">kg CO₂e</span></p></div>
                </div>
                <div class="target-bar" role="img" aria-label="Target is ${Math.round(fillPct)}% of your current footprint"><div class="fill" style="width:${fillPct}%"></div></div>
                <p class="target-cap">Cutting about ${kg(reduceBy)} kg CO₂e a month (${nf((reduceBy / r.total) * 100)}%) gets you there.</p>
                <div class="ideas">
                  <p class="card-label">Ways to get there</p>
                  ${ideas
                    .slice(0, 3)
                    .map(
                      (i) => `<button class="idea" type="button" data-action="idea" data-cat="${i.cat}" data-opt="${i.sc.id}" style="--cat:${CAT[i.cat].color};--cat-ink:${CAT[i.cat].ink}">
                        <span class="cat-ico">${icon(CAT[i.cat].icon)}</span>
                        <span><b>${esc(i.sc.title)}</b><small>${i.sc.control ? esc(i.sc.control.fmt(i.v)) + ' · ' : ''}Try it in What-If</small></span>
                        <span class="save">−${kg(i.co2)} kg</span>
                      </button>`
                    )
                    .join('')}
                </div>`
              : `<p class="lead" style="margin-top:8px">You've already covered the main habit changes in the simulator.</p>
                 <p class="muted" style="margin-top:6px">Your estimate is ${nf(r.total)} kg CO₂e a month. Keep it up, and re-run the analysis when your routine changes.</p>`
          }
        </article>
      </section>

      <div class="action-bar">
        <span id="save-slot">${saveSlotHTML()}</span>
        <button class="btn btn-secondary" type="button" data-action="try-whatif">${icon('sliders')} TRY WHAT-IF</button>
        <button class="btn btn-secondary" type="button" data-action="goto" data-to="history">${icon('history')} VIEW HISTORY</button>
      </div>
      ${disclaimer()}`;

    countUp($('#count-total'), Math.round(r.total));
    drawResultCharts(r, sh);
  }

  function saveAnalysis() {
    const c = state.current;
    if (c.sample) return;
    const u = getUser();
    if (c.savedId && u.history.some((h) => h.id === c.savedId)) {
      navigate('history');
      return;
    }
    const r = c.result;
    const rec = {
      id: uid(),
      date: c.date || new Date().toISOString(),
      total: round1(r.total),
      transport: round1(r.transport.co2),
      electricity: round1(r.electricity.co2),
      food: round1(r.food.co2),
      waste: round1(r.waste.co2),
      cost: Math.round(r.cost)
    };
    u.history.push(rec);
    c.savedId = rec.id;
    persistCurrent();
    const slot = $('#save-slot');
    if (slot) slot.innerHTML = saveSlotHTML();
    toast('Analysis saved to your history');
  }

  /* ---------- What-if simulator ---------- */
  function renderWhatIf() {
    const root = $('#view-whatif');
    ensureWi();
    const tabs = CATEGORIES.map(
      (c) => `<button class="tab" type="button" data-action="wi-cat" data-cat="${c}" aria-pressed="${c === state.wi.cat}" style="--cat:${CAT[c].color};--cat-ink:${CAT[c].ink}">${icon(CAT[c].icon)}<span>${CAT[c].label}</span></button>`
    ).join('');

    root.innerHTML = `
      <header class="view-head">
        <div>
          <h1>What if?</h1>
          <p class="muted">Change one habit and see the estimated effect on your monthly footprint and costs.</p>
        </div>
        <span class="badge">${icon('sliders')} Simulator</span>
      </header>
      ${sampleNotice()}
      <div class="wi-layout">
        <section class="card wi-controls" aria-label="Choose a change">
          <div class="tabs" role="group" aria-label="Category">${tabs}</div>
          <div id="wi-body"></div>
        </section>

        <aside class="card wi-out" aria-label="Estimated effect" aria-live="polite">
          <h2>Estimated monthly effect</h2>
          <div id="wi-result">
            <div class="wi-nums">
              <div class="wi-num"><span class="lbl">CURRENT</span><p class="big-num"><span id="wi-current">0</span><span class="unit">kg CO₂e</span></p></div>
              <span class="wi-arrow" aria-hidden="true">→</span>
              <div class="wi-num after"><span class="lbl">AFTER CHANGE</span><p class="big-num"><span id="wi-after">0</span><span class="unit">kg CO₂e</span></p></div>
            </div>
            <div class="wi-reduction">
              <div><span class="lbl">POTENTIAL REDUCTION</span><p class="big-num"><span id="wi-red">0</span><span class="unit">kg CO₂e</span></p></div>
              <div class="wi-saving"><b id="wi-save">₹0</b><span id="wi-pct">a month</span></div>
            </div>
            <div class="wi-ribbons">
              <div><div class="rlabel"><span>Current</span></div>${ribbonHTML(state.current.result, { width: 100, id: 'wi-rib-cur' })}</div>
              <div><div class="rlabel"><span>After change</span></div>${ribbonHTML(state.current.result, { width: 100, id: 'wi-rib-after' })}</div>
            </div>
            <div class="wi-explain">
              <h3>What changed</h3>
              <p id="wi-explain"></p>
              <p class="delta-line" id="wi-delta"></p>
            </div>
          </div>
          <div class="wi-empty" id="wi-empty" hidden>Nothing to simulate here yet. Try another category, or update your answers with a new analysis.</div>
        </aside>
      </div>

      <div class="wi-mini" id="wi-mini" aria-hidden="true">
        <span>Current <b id="wi-mini-cur">0</b></span>
        <span>→</span>
        <span>After <b id="wi-mini-after">0</b></span>
        <span class="pill" id="wi-mini-red">−0 kg</span>
      </div>
      ${disclaimer()}`;

    renderWiBody();
    updateWiOutput();
  }

  function renderWiBody() {
    const a = state.current.answers;
    const cat = state.wi.cat;
    const list = SCENARIOS[cat];
    const anyOpen = list.some((s) => !s.blocked(a));
    const opts = list
      .map((sc) => {
        const why = sc.blocked(a);
        const checked = sc.id === state.wi.opt && !why;
        return `<label class="opt">
          <input type="radio" name="wi-opt" value="${sc.id}"${checked ? ' checked' : ''}${why ? ' disabled' : ''}>
          <span class="opt-body"><span class="radio"></span><span>
            <span class="opt-title">${esc(sc.title)}</span>
            <span class="opt-desc">${esc(sc.desc)}</span>
            ${why ? `<span class="opt-why">${esc(why)}</span>` : ''}
          </span></span>
        </label>`;
      })
      .join('');

    let control = '';
    const sc = getScenario(cat, state.wi.opt);
    if (sc && sc.control && !sc.blocked(a)) {
      const r = sc.control.range(a);
      const v = state.wi.value;
      control = `<div class="wi-control">
          <div class="wi-control-head"><label for="wi-range">${esc(sc.control.label)}</label><output id="wi-range-out" for="wi-range">${esc(sc.control.fmt(v))}</output></div>
          ${
            r.max > r.min
              ? `<input id="wi-range" type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}">
                 <div class="wi-scale"><span>${r.min}</span><span>${r.max}</span></div>`
              : `<p class="tiny">Based on your answers, ${esc(sc.control.fmt(r.min))} is the most that applies.</p>`
          }
        </div>`;
    }

    $('#wi-body').innerHTML = `
      <h2>${CAT[cat].label}: pick one change</h2>
      <p class="muted">Only one habit changes at a time, so you can see its effect clearly.</p>
      ${anyOpen ? '' : `<p class="wi-empty" style="margin-bottom:12px">You're already doing the main things here. Try another category.</p>`}
      <div class="opts" role="radiogroup" aria-label="Changes for ${CAT[cat].label}">${opts}</div>
      ${control}`;
  }

  function wiCompute() {
    const a = state.current.answers;
    const sc = getScenario(state.wi.cat, state.wi.opt);
    if (!sc || sc.blocked(a)) return null;
    const v = state.wi.value;
    const before = state.current.result;
    const after = calculate(a, { [state.wi.cat]: sc.mods(v, a) });
    return { sc, v, a, before, after, diff: before.total - after.total, saving: before.cost - after.cost };
  }

  function updateWiOutput() {
    const res = wiCompute();
    const box = $('#wi-result');
    if (!box) return;
    $('#wi-empty').hidden = !!res;
    box.hidden = !res;
    if (!res) return;
    const { before, after, diff, saving, sc, v, a } = res;
    const diffClean = Math.max(0, diff);
    $('#wi-current').textContent = nf(before.total);
    $('#wi-after').textContent = nf(after.total);
    $('#wi-red').textContent = kg(diffClean);
    $('#wi-save').textContent = saving >= 5 ? `≈ ${money(saving)}` : CONFIG.currency + '0';
    $('#wi-pct').textContent = `less a month (${nf((diffClean / before.total) * 100, 1)}% of your footprint)`;
    setRibbon($('#wi-rib-cur'), before, 100);
    setRibbon($('#wi-rib-after'), after, Math.max(4, (after.total / before.total) * 100));
    $('#wi-explain').textContent = sc.explain({ a, v, before, after, cat: state.wi.cat });
    $('#wi-delta').textContent = `${CAT[state.wi.cat].label}: ${kg(before[state.wi.cat].co2)} → ${kg(after[state.wi.cat].co2)} kg CO₂e a month`;
    $('#wi-mini-cur').textContent = nf(before.total);
    $('#wi-mini-after').textContent = nf(after.total);
    $('#wi-mini-red').textContent = `−${kg(diffClean)} kg`;
  }

  /* ---------- History ---------- */
  function renderHistory() {
    const root = $('#view-history');
    const all = getHistory();
    const list = all.slice().reverse();

    let summary = '';
    if (all.length) {
      const first = all[0];
      const lastR = all[all.length - 1];
      const change = lastR.total - first.total;
      const pct = first.total ? (change / first.total) * 100 : 0;
      const best = all.reduce((b, x) => (x.total < b.total ? x : b), all[0]);
      summary = `<section class="sum-grid" aria-label="History summary">
          <article class="card"><p class="card-label">Saved analyses</p><p class="big-num">${all.length}</p></article>
          <article class="card"><p class="card-label">Change since first entry</p><p class="big-num">${change <= 0 ? '−' : '+'}${kg(Math.abs(change))}<span class="unit">kg CO₂e (${nf(Math.abs(pct))}%)</span></p></article>
          <article class="card"><p class="card-label">Lowest so far</p><p class="big-num">${nf(best.total)}<span class="unit">kg CO₂e, ${shortDate(best.date)}</span></p></article>
        </section>`;
    }

    const rows = list
      .map((rec, i) => {
        const prev = list[i + 1];
        let delta = '<span class="chip">First entry</span>';
        if (prev) {
          const d = rec.total - prev.total;
          const p = (d / prev.total) * 100;
          if (Math.abs(d) < 0.5) delta = '<span class="chip">No change</span>';
          else if (d < 0) delta = `<span class="chip chip-down">${icon('down')} ${kg(Math.abs(d))} kg (${nf(Math.abs(p))}%)</span>`;
          else delta = `<span class="chip chip-up">${icon('up')} ${kg(d)} kg (${nf(p)}%)</span>`;
        }
        const res = {
          transport: { co2: rec.transport }, electricity: { co2: rec.electricity },
          food: { co2: rec.food }, waste: { co2: rec.waste }
        };
        return `<li class="rec">
          <div class="rec-date"><strong>${fmtDate(rec.date)}${rec.demo ? '<span class="badge badge-demo">Demo</span>' : ''}</strong><span>${new Date(rec.date).getFullYear()}</span></div>
          <div class="rec-total"><strong>${nf(rec.total)}</strong> <span>kg CO₂e</span></div>
          <div class="rec-delta">${delta}</div>
          <div class="rec-bar">${ribbonHTML(res)}<p class="rec-parts">Transport ${kg(rec.transport)} · Electricity ${kg(rec.electricity)} · Food ${kg(rec.food)} · Waste ${kg(rec.waste)}</p></div>
          <button class="icon-btn" type="button" data-action="delete-record" data-id="${esc(rec.id)}" aria-label="Delete the ${fmtDate(rec.date)} entry">${icon('trash')}</button>
        </li>`;
      })
      .join('');

    root.innerHTML = `
      <header class="view-head">
        <div>
          <h1>History</h1>
          <p class="muted">Every saved analysis, so you can see whether your habits are moving the right way.</p>
        </div>
        <button class="btn btn-primary" type="button" data-action="start-analysis">START NEW ANALYSIS</button>
      </header>
      ${
        all.length
          ? `${summary}
        <section class="card">
          <div class="card-title">
            <h2>Footprint over time</h2>
            <div class="seg-control" role="group" aria-label="Chart view">
              <button class="seg-btn" type="button" data-action="history-mode" data-mode="total" aria-pressed="${state.historyMode === 'total'}">Total</button>
              <button class="seg-btn" type="button" data-action="history-mode" data-mode="category" aria-pressed="${state.historyMode === 'category'}">By category</button>
            </div>
          </div>
          <div class="chart-box"><canvas id="chart-history" aria-label="Line chart of your footprint over time" role="img"></canvas></div>
        </section>
        <section class="card records">
          <div class="card-title"><h2>Records</h2><button class="btn btn-danger btn-sm" type="button" data-action="clear-history">${icon('trash')} Clear history</button></div>
          <ul>${rows}</ul>
        </section>`
          : `<section class="card empty">
              <span class="stat-icon">${icon('history')}</span>
              <h2>No saved analyses yet</h2>
              <p class="muted">Run an analysis and save it to start tracking progress. Or load demo data to see how this page looks.</p>
              <div class="actions">
                <button class="btn btn-primary" type="button" data-action="start-analysis">START NEW ANALYSIS</button>
                <button class="btn btn-secondary" type="button" data-action="load-demo">Load demo data</button>
              </div>
            </section>`
      }
      ${disclaimer()}`;

    if (all.length) drawHistoryChart(all);
  }

  /* ======================================================================
     7. CHARTS (Chart.js)
     ====================================================================== */
  function destroyCharts() {
    Object.values(state.charts).forEach((c) => {
      try {
        c.destroy();
      } catch (e) {
        /* ignore */
      }
    });
    state.charts = {};
  }

  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (typeof Chart === 'undefined') {
      canvas.parentElement.innerHTML =
        '<p class="chart-fallback">Charts need the Chart.js library, which loads from a CDN. Check your internet connection and reload the page.</p>';
      return;
    }
    Chart.defaults.font.family = '"Figtree", "Segoe UI", system-ui, sans-serif';
    Chart.defaults.color = '#4b635e';
    state.charts[id] = new Chart(canvas, config);
  }

  const centerText = {
    id: 'centerText',
    afterDraw(chart, args, opts) {
      if (!opts || !opts.value) return;
      const { ctx, chartArea } = chart;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f2e29';
      ctx.font = '800 32px "Bricolage Grotesque", "Segoe UI", sans-serif';
      ctx.fillText(opts.value, cx, cy - 8);
      ctx.fillStyle = '#6f8681';
      ctx.font = '500 12px "Figtree", "Segoe UI", sans-serif';
      ctx.fillText(opts.caption, cx, cy + 18);
      ctx.restore();
    }
  };

  const legendStyle = { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 } };

  function drawResultCharts(r, sh) {
    const names = CATEGORIES.map((c) => CAT[c].label);
    const vals = CATEGORIES.map((c) => round1(r[c].co2));
    makeChart('chart-doughnut', {
      type: 'doughnut',
      data: {
        labels: names,
        datasets: [{ data: vals, backgroundColor: CATEGORIES.map((c) => CAT[c].color), borderColor: '#ffffff', borderWidth: 3, hoverOffset: 6 }]
      },
      options: {
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: legendStyle,
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${nf(c.parsed)} kg CO₂e (${sh[c.dataIndex]}%)` } },
          centerText: { value: nf(r.total), caption: 'kg CO₂e / month' }
        }
      },
      plugins: [centerText]
    });

    makeChart('chart-compare', {
      type: 'bar',
      data: {
        labels: names,
        datasets: [
          { label: 'You', data: vals, backgroundColor: '#0f7b6c', borderRadius: 8, maxBarThickness: 34 },
          { label: 'Typical household (illustrative)', data: CATEGORIES.map((c) => BENCHMARK[c]), backgroundColor: '#cddad5', borderRadius: 8, maxBarThickness: 34 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: legendStyle, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${nf(c.parsed.y)} kg CO₂e` } } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'kg CO₂e per month' }, grid: { color: '#eef3f1' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function drawHistoryChart(all) {
    const labels = all.map((h) => shortDate(h.date));
    let datasets;
    if (state.historyMode === 'category') {
      datasets = CATEGORIES.map((c) => ({
        label: CAT[c].label,
        data: all.map((h) => h[c]),
        borderColor: CAT[c].color,
        backgroundColor: CAT[c].color,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2.5
      }));
    } else {
      datasets = [{
        label: 'Total (kg CO₂e)',
        data: all.map((h) => h.total),
        borderColor: '#0f7b6c',
        backgroundColor: 'rgba(15,123,108,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#0f7b6c',
        pointBorderWidth: 3,
        borderWidth: 3
      }];
    }
    makeChart('chart-history', {
      type: 'line',
      data: { labels, datasets },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: state.historyMode === 'category' ? legendStyle : { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${nf(c.parsed.y)} kg CO₂e` } }
        },
        scales: {
          y: { beginAtZero: state.historyMode === 'category', grace: '10%', title: { display: true, text: 'kg CO₂e per month' }, grid: { color: '#eef3f1' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  /* ======================================================================
     8. ROUTER, ACTIONS & START-UP
     ====================================================================== */
  const ROUTES = ['dashboard', 'analysis', 'results', 'whatif', 'history'];
  const RENDER = {
    dashboard: renderDashboard,
    analysis: renderAnalysis,
    results: renderResults,
    whatif: renderWhatIf,
    history: renderHistory
  };

  function navigate(name) {
    if (location.hash === '#' + name) route();
    else location.hash = name;
  }

  function clearTimers() {
    state.timers.forEach(clearTimeout);
    state.timers = [];
  }

  function showAuth() {
    $('#app').hidden = true;
    $('#view-login').hidden = false;
    toggleAuth('signin');
  }

  function route() {
    clearTimers();
    destroyCharts();
    if (!state.session) {
      showAuth();
      return;
    }
    let name = location.hash.replace('#', '');
    if (!ROUTES.includes(name)) {
      name = 'dashboard';
      history.replaceState(null, '', '#dashboard');
    }
    $('#view-login').hidden = true;
    $('#app').hidden = false;
    $$('.nav-item').forEach((a) => {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    ROUTES.forEach((v) => {
      $('#view-' + v).hidden = v !== name;
    });
    const view = $('#view-' + name);
    RENDER[name]();
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
    window.scrollTo(0, 0);
    $('#main').focus({ preventScroll: true });
  }

  function hydrateUser() {
    const s = state.session;
    $('#user-name').textContent = s.name;
    $('#mobile-user').textContent = s.name;
    $('#user-avatar').textContent = (s.name.trim()[0] || 'E').toUpperCase();
    $('#user-role').textContent = s.guest ? 'Guest session' : 'Demo account';
  }

  /* ---------- Auth ---------- */
  function toggleAuth(mode) {
    $('#auth-signin').hidden = mode !== 'signin';
    $('#auth-signup').hidden = mode !== 'signup';
    $('#login-error').textContent = '';
    $('#signup-error').textContent = '';
    const target = mode === 'signin' ? $('#login-user') : $('#signup-name');
    if (target && !$('#view-login').hidden && document.activeElement !== target) {
      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        /* ignore */
      }
    }
  }

  function startSession(name, guest) {
    const clean = name.trim();
    state.session = { name: clean, key: guest ? 'guest' : clean.toLowerCase(), guest: !!guest };
    store.write(KEYS.session, state.session);
    loadUserState();
    hydrateUser();
    ['login-user', 'login-pass', 'signup-name', 'signup-email', 'signup-pass', 'signup-pass2'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    navigate('dashboard');
  }

  function logout() {
    store.remove(KEYS.session);
    state.session = null;
    state.current = null;
    history.replaceState(null, '', location.pathname + location.search);
    route();
    toast('You have been logged out');
  }

  function onLogin(e) {
    e.preventDefault();
    const user = $('#login-user').value.trim();
    const pass = $('#login-pass').value;
    if (!user || !pass) {
      $('#login-error').textContent = 'Enter a username and password to continue.';
      (!user ? $('#login-user') : $('#login-pass')).focus();
      return;
    }
    startSession(user, false);
  }

  function onSignup(e) {
    e.preventDefault();
    const name = $('#signup-name').value.trim();
    const email = $('#signup-email').value.trim();
    const p1 = $('#signup-pass').value;
    const p2 = $('#signup-pass2').value;
    const err = $('#signup-error');
    const fail = (msg, field) => {
      err.textContent = msg;
      field.focus();
    };
    if (!name) return fail('Enter your name.', $('#signup-name'));
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address, like you@example.com.', $('#signup-email'));
    if (p1.length < 4) return fail('Use a password with at least 4 characters.', $('#signup-pass'));
    if (p1 !== p2) return fail('The two passwords do not match.', $('#signup-pass2'));
    startSession(name, false);
    toast(`Account created. Welcome, ${name}`);
  }

  /* ---------- Actions (all buttons route through here) ---------- */
  const actions = {
    'show-signup': () => toggleAuth('signup'),
    'show-signin': () => toggleAuth('signin'),
    guest: () => startSession('Guest', true),
    logout,
    goto: (el) => navigate(el.dataset.to),
    'start-analysis': () => {
      state.draft = emptyDraft();
      state.step = 0;
      navigate('analysis');
    },
    'wz-back': wizardBack,
    'wz-next': wizardNext,
    'sample-answers': () => {
      state.draft = JSON.parse(JSON.stringify(SAMPLE_ANSWERS));
      renderStep(false);
      toast('Sample answers filled in. Review them, or keep going.');
    },
    'save-analysis': saveAnalysis,
    'try-whatif': () => navigate('whatif'),
    idea: (el) => {
      state.wi.cat = el.dataset.cat;
      state.wi.opt = el.dataset.opt;
      state.wi.value = null;
      ensureWi();
      navigate('whatif');
    },
    'wi-cat': (el) => {
      state.wi.cat = el.dataset.cat;
      state.wi.opt = null;
      ensureWi();
      $$('.tab').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.cat === state.wi.cat)));
      renderWiBody();
      updateWiOutput();
    },
    'history-mode': (el) => {
      state.historyMode = el.dataset.mode;
      destroyCharts();
      renderHistory();
    },
    'delete-record': (el) => {
      const u = getUser();
      const rec = u.history.find((h) => h.id === el.dataset.id);
      if (!rec) return;
      if (!window.confirm(`Delete the ${fmtDate(rec.date)} entry from your history?`)) return;
      u.history = u.history.filter((h) => h.id !== rec.id);
      if (state.current.savedId === rec.id) state.current.savedId = null;
      persistCurrent();
      saveData();
      destroyCharts();
      renderHistory();
      toast('Entry deleted');
    },
    'clear-history': () => {
      if (!window.confirm('Clear all saved analyses? This cannot be undone.')) return;
      getUser().history = [];
      state.current.savedId = null;
      persistCurrent();
      saveData();
      destroyCharts();
      renderHistory();
      toast('History cleared');
    },
    'load-demo': () => {
      const u = getUser();
      seedHistory().forEach((rec) => {
        if (!u.history.some((h) => h.id === rec.id)) u.history.push(rec);
      });
      if (state.current.sample) state.current.savedId = 'demo-4';
      saveData();
      destroyCharts();
      renderHistory();
      toast('Demo history loaded');
    }
  };

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const fn = actions[el.dataset.action];
      if (fn) {
        e.preventDefault();
        fn(el);
      }
    });

    $('#form-login').addEventListener('submit', onLogin);
    $('#form-signup').addEventListener('submit', onSignup);
    window.addEventListener('hashchange', route);

    /* Wizard answers */
    $('#view-analysis').addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches('.choice input')) return;
      const key = t.name;
      if (t.type === 'checkbox') {
        const set = new Set(state.draft[key] || []);
        if (t.checked) set.add(t.value);
        else set.delete(t.value);
        state.draft[key] = Array.from(set);
      } else {
        state.draft[key] = t.value;
      }
      const fs = t.closest('.q');
      if (fs) {
        fs.classList.remove('has-error');
        $('.q-error', fs).hidden = true;
      }
    });

    /* What-if controls */
    $('#view-whatif').addEventListener('change', (e) => {
      if (e.target.matches('input[name="wi-opt"]')) {
        state.wi.opt = e.target.value;
        state.wi.value = null;
        ensureWi();
        renderWiBody();
        updateWiOutput();
      }
    });
    $('#view-whatif').addEventListener('input', (e) => {
      if (e.target.id === 'wi-range') {
        state.wi.value = parseFloat(e.target.value);
        const sc = getScenario(state.wi.cat, state.wi.opt);
        $('#wi-range-out').textContent = sc.control.fmt(state.wi.value);
        updateWiOutput();
      }
    });
  }

  function init() {
    hydrateIcons();
    bindEvents();
    const saved = store.read(KEYS.session, null);
    if (saved && saved.name && saved.key) {
      state.session = saved;
      try {
        loadUserState();
        hydrateUser();
      } catch (e) {
        state.session = null;
        store.remove(KEYS.session);
      }
    }
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Exposed for quick testing in the browser console. */
  window.EcoLens = { calculate, SAMPLE_ANSWERS };
})();