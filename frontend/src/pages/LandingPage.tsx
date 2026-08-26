import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicContent } from '../api.ts';
import { DEFAULT_PUBLIC_CONTENT, type PublicContentSettings } from '../types.ts';

const traffic = [
  ['2019',307634],['2020',120021],['2021',129195],['2022',206873],['2023',230956],['2024',263685],['2025',213288]
] as const;


const months = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGUS','SEPT','OKT','NOV','DES'] as const;
const paxMonthly: Record<number, (number|null)[]> = {
  2022:[12831,10221,13308,17203,21541,19715,21705,17463,16492,19770,17982,18642],
  2023:[17742,16598,17483,18394,18180,18682,20799,19167,18210,19853,22480,23368],
  2024:[18868,20831,19681,25142,21761,21452,24314,22096,22364,22225,21313,23633],
  2025:[21144,16088,17578,21718,15941,17554,17818,17011,15977,17949,17775,17463],
  2026:[15219,15480,21331,16364,13553,15212,16191,null,null,null,null,null],
};
const omzetAverage = [
  {year:2022,fnb:27587165.08,retail:73768384.25},
  {year:2023,fnb:39148219,retail:79466113.83},
  {year:2024,fnb:27921503,retail:77924793},
  {year:2025,fnb:24288894.92,retail:59648769.92},
  {year:2026,fnb:13050577,retail:64660394.29},
];
const potentialData: Record<number, {fnb:number[];retail:number[];fnbCount:number[]}> = {
  2022:{fnb:[2758809.86,5581629.22,8276429.57],retail:[7377088.04,14925338.21,22131264.11],fnbCount:[1724,3488,5172]},
  2023:{fnb:[3915567.72,7829101.38,11744669.11],retail:[7948125.31,15892121.73,23840247.04],fnbCount:[1925,3849,5774]},
  2024:{fnb:[2791726.73,5584724.17,8376450.90],retail:[7791297.19,15586140.71,23377437.90],fnbCount:[2197,4395,6592]},
  2025:{fnb:[2428253.94,4857869.78,7286123.72],retail:[5963316.21,11929976.95,17893293.16],fnbCount:[1783,3567,5350]},
  2026:{fnb:[1126713.25,2253426.49,3380139.74],retail:[5582413.93,11164827.85,16747241.78],fnbCount:[1398,2796,4194]},
};

const stats = [
  ['8.400 m²','Luas Terminal','Kapasitas ±1 juta pax/tahun'],
  ['2.500 × 45 m','Runway 04–22','Critical aircraft B737-800 NG'],
  ['7 stand','Parking Stand','5 main apron + 2 remote apron'],
  ['396 pax/jam','Kapasitas Terminal','8 check-in counter · 2 boarding gate'],
] as const;

const facilities = [
  ['Passenger Service',['8 Check-in Counter','2 Self Check-in','2 Boarding Gate','2 Conveyor Belt']],
  ['Safety & Security',['6 X-Ray','3 WTMD','62 CCTV','ARFF Category 6']],
  ['Terminal Service',['102 Trolley','3 Mushola','20 Toilet','1 Aviobridge']],
  ['Personnel',['86 Personel','68 Internal','18 Eksternal','28 Aviation Security']],
] as const;

export default function LandingPage(){
  const [content,setContent]=useState<PublicContentSettings>(DEFAULT_PUBLIC_CONTENT);

  useEffect(()=>{
    fetchPublicContent().then(result=>setContent(result.settings)).catch(()=>{});
  },[]);

  useEffect(()=>{
    const nodes=[...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    const observer=new IntersectionObserver((entries)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -8% 0px'});
    nodes.forEach(n=>observer.observe(n));
    return()=>observer.disconnect();
  },[]);

  const firstSectionHref=content.showProfile?'#profile':content.showTraffic?'#traffic':content.showFacilities?'#facilities':content.showSmartSpace?'#smartspace':'/map';

  return <div className="public-landing min-h-screen overflow-x-hidden bg-slate-950 text-white">
    <section id="home" className="relative isolate min-h-screen overflow-hidden">
      <AirportBackdrop/>
      <div className="future-grid absolute inset-0"/>
      <div className="pointer-events-none absolute -left-32 top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"/>
      <div className="pointer-events-none absolute right-0 top-0 h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl"/>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/78 to-slate-950/15"/>
      <header className="future-nav sticky top-0 z-50 border-b border-cyan-300/10 bg-slate-950/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-3"><span className="brand-logo-shell"><img src="/brand/logo.svg" alt="Logo Smart Space" className="h-full w-full object-contain" /></span><div><p className="font-bold">SMART SPACE</p><p className="text-[10px] uppercase tracking-[.24em] text-sky-300/70">Raja Haji Fisabilillah · TNJ</p></div></Link>
          <nav className="hidden gap-6 text-xs font-semibold text-slate-300 lg:flex">{content.showProfile&&<a className="nav-link" href="#profile">Profil</a>}{content.showTraffic&&<a className="nav-link" href="#traffic">Traffic</a>}{content.showFacilities&&<a className="nav-link" href="#facilities">Fasilitas</a>}{content.showSmartSpace&&<a className="nav-link" href="#smartspace">Smart Space</a>}</nav>
          <div className="flex gap-2"><Link to="/tracking" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm">Cek Tiket</Link><Link to="/admin/login" className="hidden rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 sm:block">Admin</Link></div>
        </div>
      </header>
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-78px)] max-w-7xl items-center px-5 pb-20 sm:px-8 lg:px-10">
        <div className="relative max-w-4xl" data-reveal><img src="/brand/logo.svg" alt="" className="pointer-events-none absolute -right-10 -top-20 hidden h-44 w-44 opacity-10 blur-[.2px] lg:block" />
          <div className="hud-chip mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[.18em] text-cyan-100"><span className="status-pulse h-1.5 w-1.5 rounded-full bg-emerald-400"/>{content.heroBadge}</div>
          <h1 className="hero-display text-4xl font-black leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl">{content.heroTitle} <span className="block bg-gradient-to-r from-sky-300 via-cyan-100 to-white bg-clip-text text-transparent">{content.heroHighlight}</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{content.heroDescription}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link to="/map" className="cta-primary">{content.heroPrimaryButton} <span>→</span></Link>{firstSectionHref==='/map'?<Link to="/map" className="cta-secondary">{content.heroSecondaryButton}</Link>:<a href={firstSectionHref} className="cta-secondary">{content.heroSecondaryButton} ↓</a>}</div>
          {content.showHeroStats&&<div className="future-stat-grid mt-12 grid grid-cols-2 gap-3 border-t border-cyan-200/10 pt-6 sm:grid-cols-4"><HeroStat value="8.400 m²" label="Terminal"/><HeroStat value="1 jt" label="Pax / tahun"/><HeroStat value="7" label="Parking stand"/><HeroStat value="2.500 m" label="Runway"/></div>}
        </div>
      </div>
    </section>

    {content.showProfile&&<section id="profile" className="future-section scroll-section motif-section px-5 py-24 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-end" data-reveal><div><Eyebrow>Airport Profile</Eyebrow><h2 className="mt-3 text-3xl font-black sm:text-5xl">{content.profileTitle}</h2></div><p className="text-sm leading-7 text-slate-300 sm:text-base">{content.profileDescription}</p></div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map((s,i)=><article key={s[1]} data-reveal style={{transitionDelay:`${i*70}ms`}} className="glass-card"><p className="text-3xl font-black">{s[0]}</p><p className="mt-3 text-sm font-bold text-sky-300">{s[1]}</p><p className="mt-2 text-xs leading-5 text-slate-500">{s[2]}</p></article>)}</div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3" data-reveal><Info title="Airside" value="PCR 450/F/C/X/U" text="Taxiway Alpha & Bravo lebar 21 m · ARFF Category 6."/><Info title="Landside" value="11.481 m²" text="166 lot mobil, 304 lot motor dan 2 toll gate."/><Info title="Apron" value="38.832,08 m²" text="Main apron + remote apron, mendukung B737-800NG dan ATR 72-600."/></div>
    </div></section>}

    {content.showTraffic&&<section id="traffic" className="future-section scroll-section border-y border-cyan-300/10 bg-slate-900/45 px-5 py-24 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end" data-reveal><div><Eyebrow>Airport Traffic</Eyebrow><h2 className="mt-3 text-3xl font-black sm:text-5xl">{content.trafficTitle}</h2></div><div className="grid grid-cols-2 gap-3 lg:justify-self-end"><Metric value="213.288" label="PAX 2025" note="584 pax / hari"/><Metric value="3.117" label="Aircraft 2025" note="9 pergerakan / hari"/></div></div>
      <div className="mt-10 space-y-5">
        <article className="chart-card" data-reveal><PaxMonthlyChart/></article>
        <div className="grid gap-5 xl:grid-cols-2">
          <article className="chart-card" data-reveal><OmzetAverageChart/></article>
          <article className="chart-card" data-reveal><PotentialChart/></article>
        </div>
      </div>
    </div></section>}

    {content.showFacilities&&<section id="facilities" className="future-section scroll-section motif-section motif-section-alt px-5 py-24 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl">
      <div className="max-w-3xl" data-reveal><Eyebrow>Facility & Readiness</Eyebrow><h2 className="mt-3 text-3xl font-black sm:text-5xl">{content.facilitiesTitle}</h2></div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{facilities.map(f=><article data-reveal key={f[0]} className="glass-card"><h3 className="text-sm font-bold text-sky-300">{f[0]}</h3><div className="mt-5 space-y-3">{f[1].map(x=><div key={x} className="flex items-center gap-3 text-sm text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/>{x}</div>)}</div></article>)}</div>
      <div className="mt-12 grid gap-5 lg:grid-cols-[.8fr_1.2fr]" data-reveal><article className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-sky-400/15 to-transparent p-8"><Eyebrow>Connectivity</Eyebrow><h3 className="mt-3 text-2xl font-black">Rute penerbangan</h3><div className="mt-6 space-y-3"><Route airline="Batik Air" route="Jakarta"/><Route airline="Citilink" route="Jakarta"/><Route airline="Susi Air" route="Dabo · Tambelan · Letung"/></div></article><article className="relative min-h-[340px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 p-8"><div className="absolute inset-0 opacity-50"><AirportBackdrop/></div><div className="relative z-10 flex h-full max-w-xl flex-col justify-end"><h3 className="text-3xl font-black sm:text-4xl">Dari perjalanan menjadi kesempatan bisnis.</h3><p className="mt-4 text-sm leading-7 text-slate-300">Smart Space menerjemahkan lingkungan terminal menjadi informasi lokasi yang lebih mudah dipahami calon tenant.</p></div></article></div>
    </div></section>}

    {content.showSmartSpace&&<section id="smartspace" className="future-section scroll-section border-y border-cyan-300/10 bg-slate-900/60 px-5 py-24 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl" data-reveal><Eyebrow>Smart Space</Eyebrow><h2 className="mt-3 max-w-4xl text-3xl font-black sm:text-5xl">{content.smartSpaceTitle}</h2><div className="mt-10 grid gap-4 md:grid-cols-3"><Feature icon="📍" title="Lokasi strategis" text="Pilih ruang komersial di area terminal dengan akses dan visibilitas yang baik."/><Feature icon="🗺️" title="Peta interaktif" text="Lihat posisi, lantai, luas dan status ketersediaan langsung dari denah terminal."/><Feature icon="⚡" title="Pengajuan cepat" text="Pilih ruang, kirim data usaha, lalu pantau proses dengan nomor tiket."/></div></div></section>}

    {content.showCta&&<section className="motif-cta px-5 py-24 sm:px-8 lg:px-10"><div className="future-cta relative mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-cyan-200/15 bg-gradient-to-br from-cyan-300/[.10] to-blue-500/[.025] px-7 py-14 text-center" data-reveal><img src="/brand/logo.svg" alt="" className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 opacity-[.08]" /><Eyebrow>Explore Commercial Space</Eyebrow><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black sm:text-5xl">{content.ctaTitle}</h2><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300">{content.ctaDescription}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/map" className="cta-primary">{content.heroPrimaryButton} →</Link><Link to="/tracking" className="cta-secondary">Sudah mengajukan? Cek tiket</Link></div></div></section>}

    {content.showFooter&&<footer className="motif-footer border-t border-cyan-300/10 px-5 py-8 text-xs text-slate-400 sm:px-8 lg:px-10"><div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><img src="/brand/logo.svg" alt="Logo" className="h-9 w-9 object-contain opacity-90"/><p>{content.footerText}</p></div><div className="flex gap-4"><a href="#home">Beranda</a><Link to="/map">Peta Ruang</Link><Link to="/tracking">Tracking</Link></div></div></footer>}
  </div>
}

function Eyebrow({children}:{children:React.ReactNode}){return <p className="text-xs font-bold uppercase tracking-[.25em] text-sky-400">{children}</p>}
function HeroStat({value,label}:{value:string,label:string}){return <div className="future-stat rounded-2xl border border-cyan-200/10 bg-slate-950/25 p-3"><p className="text-lg font-extrabold text-white">{value}</p><p className="text-[10px] uppercase tracking-[.14em] text-slate-300">{label}</p></div>}
function Info({title,value,text}:{title:string,value:string,text:string}){return <article className="rounded-3xl border border-white/[.08] bg-white/[.025] p-6"><p className="text-xl font-black">{value}</p><p className="mt-3 text-sm font-bold text-sky-300">{title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></article>}
function Metric({value,label,note}:{value:string,label:string,note:string}){return <div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4"><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold text-sky-300">{label}</p><p className="mt-1 text-[10px] text-slate-500">{note}</p></div>}
function Row({label,value,positive=false}:{label:string,value:string,positive?:boolean}){return <div className="flex justify-between border-t border-white/[.08] pt-3"><span className="text-xs text-slate-500">{label}</span><span className={`text-sm font-black ${positive?'text-emerald-300':'text-slate-200'}`}>{value}</span></div>}
function Route({airline,route}:{airline:string,route:string}){return <div className="flex justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"><span className="text-sm font-bold">{airline}</span><span className="text-xs text-slate-400">{route}</span></div>}
function Feature({icon,title,text}:{icon:string,title:string,text:string}){return <article className="glass-card"><span className="text-2xl">{icon}</span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></article>}

function formatRupiahCompact(v:number){
  if(v>=1_000_000_000) return `Rp ${(v/1_000_000_000).toFixed(1)} M`;
  if(v>=1_000_000) return `Rp ${(v/1_000_000).toFixed(1)} jt`;
  return `Rp ${Math.round(v).toLocaleString('id-ID')}`;
}

function PaxMonthlyChart(){
  const [year,setYear]=useState(2026);
  const values=paxMonthly[year];
  const valid=values.filter((v):v is number=>v!==null);
  const max=Math.max(...valid,1);
  const total=valid.reduce((a,b)=>a+b,0);
  return <div>
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-300">01 · Passenger Traffic</p><h3 className="mt-2 text-xl font-black">PAX bulanan {year}</h3><p className="mt-1 text-xs text-slate-500">Geser tahun untuk melihat data 2022–2026 · tampilan awal 2026.</p></div>
      <div className="min-w-[220px]"><div className="mb-2 flex justify-between text-xs"><span className="text-slate-500">Tahun</span><strong className="text-sky-300">{year}</strong></div><input aria-label="Pilih tahun PAX" type="range" min="2022" max="2026" step="1" value={year} onChange={e=>setYear(Number(e.target.value))} className="year-slider w-full"/></div>
    </div>
    <div className="mt-6 flex items-baseline gap-2"><span className="text-3xl font-black">{total.toLocaleString('id-ID')}</span><span className="text-xs text-slate-500">PAX tercatat {year===2026?'Jan–Jul':'setahun'}</span></div>
    <div className="mt-8 grid h-64 grid-cols-12 items-end gap-1.5 sm:gap-3">
      {values.map((v,i)=><div key={months[i]} className="group flex h-full min-w-0 flex-col items-center justify-end">
        <div className="mb-2 min-h-4 text-[8px] font-semibold text-slate-400 opacity-0 transition group-hover:opacity-100 sm:text-[9px]">{v?.toLocaleString('id-ID')??'—'}</div>
        <div className="flex h-48 w-full items-end rounded-t-lg bg-white/[.025]">
          {v!==null?<div className="monthly-bar w-full rounded-t-lg" style={{height:`${Math.max(5,v/max*100)}%`}}/>:<div className="mb-1 w-full text-center text-xs text-slate-700">·</div>}
        </div>
        <span className="mt-2 text-[8px] text-slate-500 sm:text-[10px]">{months[i]}</span>
      </div>)}
    </div>
  </div>
}

function OmzetAverageChart(){
  const max=Math.max(...omzetAverage.flatMap(x=>[x.fnb,x.retail]));
  return <div>
    <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-300">02 · Existing Revenue</p><h3 className="mt-2 text-xl font-black">Rata-rata omzet per bulan</h3><p className="mt-1 text-xs text-slate-500">Perbandingan kategori F&B dan Retail berdasarkan rata-rata pada tiap tahun.</p></div>
    <div className="mt-6 flex gap-4 text-[10px] text-slate-400"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-300"/>F&B</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-300"/>Retail</span></div>
    <div className="mt-7 space-y-5">{omzetAverage.map(row=><div key={row.year} className="grid grid-cols-[42px_1fr] items-center gap-3">
      <span className="text-xs font-bold text-slate-400">{row.year}</span>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><div className="h-3 rounded-full bg-sky-300/80" style={{width:`${row.fnb/max*100}%`}}/><span className="whitespace-nowrap text-[9px] text-slate-400">{formatRupiahCompact(row.fnb)}</span></div>
        <div className="flex items-center gap-2"><div className="h-3 rounded-full bg-emerald-300/75" style={{width:`${row.retail/max*100}%`}}/><span className="whitespace-nowrap text-[9px] text-slate-400">{formatRupiahCompact(row.retail)}</span></div>
      </div>
    </div>)}</div>
    <p className="mt-6 text-[10px] leading-5 text-slate-600">2026 menggunakan rata-rata data yang tersedia sampai Juli.</p>
  </div>
}

function PotentialChart(){
  const [year,setYear]=useState(2026);
  const [metric,setMetric]=useState<'omzet'|'potensi'>('omzet');
  const d=potentialData[year];
  const perc=[10,20,30];
  const maxOmzet=Math.max(...d.fnb,...d.retail,1);
  const maxCount=Math.max(...d.fnbCount,1);
  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-300">03 · Revenue Potential</p><h3 className="mt-2 text-xl font-black">Potensi 10% · 20% · 30%</h3><p className="mt-1 text-xs text-slate-500">Omzet potensial F&B/Retail dan nilai potensi F&B dari data Excel.</p></div>
      <select aria-label="Pilih tahun potensi" value={year} onChange={e=>setYear(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none">{[2026,2025,2024,2023,2022].map(y=><option key={y} value={y}>{y}</option>)}</select>
    </div>
    <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/[.025] p-1">
      <button type="button" onClick={()=>setMetric('omzet')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${metric==='omzet'?'bg-sky-400 text-slate-950':'text-slate-400'}`}>Omzet potensial</button>
      <button type="button" onClick={()=>setMetric('potensi')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${metric==='potensi'?'bg-sky-400 text-slate-950':'text-slate-400'}`}>Potensi F&B</button>
    </div>
    {metric==='omzet'?<div className="mt-8 grid grid-cols-3 gap-4">
      {perc.map((p,i)=><div key={p} className="text-center"><div className="mx-auto flex h-44 max-w-[96px] items-end justify-center gap-1.5">
        <div title={`F&B ${formatRupiahCompact(d.fnb[i])}`} className="w-1/2 rounded-t-lg bg-sky-300/80" style={{height:`${Math.max(5,d.fnb[i]/maxOmzet*100)}%`}}/>
        <div title={`Retail ${formatRupiahCompact(d.retail[i])}`} className="w-1/2 rounded-t-lg bg-emerald-300/75" style={{height:`${Math.max(5,d.retail[i]/maxOmzet*100)}%`}}/>
      </div><p className="mt-3 text-sm font-black">{p}%</p><p className="mt-1 text-[9px] text-slate-500">F&B {formatRupiahCompact(d.fnb[i])}</p><p className="text-[9px] text-slate-500">Retail {formatRupiahCompact(d.retail[i])}</p></div>)}
    </div>:<div className="mt-8 grid grid-cols-3 gap-4">
      {perc.map((p,i)=><div key={p} className="text-center"><div className="mx-auto flex h-44 max-w-[64px] items-end rounded-t-lg bg-white/[.025]"><div className="w-full rounded-t-lg bg-violet-300/80" style={{height:`${Math.max(5,d.fnbCount[i]/maxCount*100)}%`}}/></div><p className="mt-3 text-sm font-black">{p}%</p><p className="mt-1 text-xs font-bold text-violet-200">{d.fnbCount[i].toLocaleString('id-ID')}</p></div>)}
    </div>}
    <div className="mt-5 flex gap-4 text-[9px] text-slate-500">{metric==='omzet'?<><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-300"/>F&B</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-300"/>Retail</span></>:<span>Nilai “Potensi” Retail kosong pada sumber Excel, sehingga mode potensi hanya menampilkan F&B.</span>}</div>
  </div>
}

function AirportBackdrop(){return <div className="absolute inset-0 overflow-hidden bg-[#09111f]" aria-hidden="true"><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(14,165,233,.28),transparent_30%),radial-gradient(circle_at_85%_55%,rgba(34,211,238,.12),transparent_30%)]"/><svg viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice"><rect y="620" width="1600" height="280" fill="#101c2a"/><path d="M0 735L1600 655V900H0Z" fill="#08111d"/><path d="M220 820L1460 715" stroke="white" strokeWidth="8" strokeDasharray="50 42" opacity=".24"/><path d="M720 395H1510L1570 610H630Z" fill="#071422"/><path d="M755 415H1465L1510 575H685Z" fill="#173750" opacity=".9"/>{Array.from({length:11}).map((_,i)=><line key={i} x1={770+i*62} y1="420" x2={710+i*68} y2="570" stroke="#7dd3fc" opacity=".16"/>)}<g transform="translate(1040 550)"><path d="M0 12L105 0L170-62L187-58L157-4L245-15L263-6L167 14L137 59L124 60L135 18L34 35Z" fill="#dbeafe" opacity=".75"/></g></svg></div>}
