import { Link } from 'react-router';
import { formatProgress, formatReturnValue, getInvestmentBreakdown, statusLabel, type PublicOpportunity } from './api';

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-frost bg-white p-3 sm:p-4">
      <dt className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-charcoal/70">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

export function StatusBadge({ status }: { status: PublicOpportunity['status'] }) {
  return <span className="rounded-full border border-electric/30 bg-electric/5 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-electric">{statusLabel(status)}</span>;
}

export function FundingProgress({ value, dark = false }: { value: number; dark?: boolean }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const formatted = formatProgress(safeValue);
  return (
    <div>
      <div className={`mb-2 flex justify-between text-xs font-black uppercase tracking-[0.16em] ${dark ? 'text-charcoal/70' : 'text-charcoal/70'}`}>
        <span>Financiación</span>
        <span>Capital cubierto · {formatted}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Financiación comprometida"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        className="h-2 overflow-hidden rounded-full bg-frost"
      >
        <div className="h-full rounded-full bg-electric" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function OpportunityCard({ opportunity, preserveSearch = true }: { opportunity: PublicOpportunity; preserveSearch?: boolean }) {
  const location = [opportunity.city, opportunity.district].filter(Boolean).join(' · ');
  const detailHref = `/proyectos/${opportunity.slug}${preserveSearch && typeof window !== 'undefined' ? window.location.search : ''}`;
  const showFinancials = (opportunity.targetAmount?.cents ?? 0) > 1;
  const progress = Math.max(0, Math.min(100, opportunity.fundingProgress));
  const showProgress = showFinancials;
  const isFunded = progress === 100 && showProgress;
  const investment = getInvestmentBreakdown(opportunity);
  const imageIsProvisional = !opportunity.primaryImage || /provisional/i.test(opportunity.primaryImage.altText);

  return (
    <article aria-label={`Proyecto: ${opportunity.title}`} className="grid h-full overflow-hidden rounded-2xl border border-frost bg-white shadow-[0_18px_55px_rgba(5,5,5,0.045)] md:grid-cols-[0.42fr_0.58fr]">
      <div className="relative min-h-64 bg-electric/5 md:min-h-full">
        {opportunity.primaryImage ? (
          <img src={opportunity.primaryImage.url} alt={opportunity.primaryImage.altText} width="900" height="600" loading="lazy" className="h-full min-h-64 w-full object-cover" />
        ) : (
          <div className="h-full min-h-64 w-full bg-electric/5" role="img" aria-label="Imagen pendiente de publicar" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" aria-hidden="true" />
        {imageIsProvisional ? <span className="absolute bottom-3 right-3 rounded-full border border-white/30 bg-ink/60 px-2.5 py-1 text-[0.60rem] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">Imagen provisional</span> : null}
      </div>
      <div className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={opportunity.status} />
          {isFunded ? <span className="rounded-full border border-electric/30 bg-electric/5 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-electric">Financiación cerrada</span> : null}
          {opportunity.strategy === 'Cambio de uso' ? <span className="rounded-full border border-frost px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-charcoal/70">Cambio de uso</span> : null}
        </div>
        <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.04em] text-ink"><Link className="focus:outline-none focus-visible:ring-2 focus-visible:ring-electric" to={detailHref}>{opportunity.title}</Link></h2>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-charcoal/70">{location}</p>
        {showProgress ? <div className="mt-4"><FundingProgress value={opportunity.fundingProgress} /></div> : null}
        {showFinancials ? (
          <dl className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-3">
            <Metric label="Retorno estimado" value={formatReturnValue(opportunity.targetReturn, opportunity.estimatedTermMonths)} />
            <Metric label="Plazo" value={`${opportunity.estimatedTermMonths} meses`} />
            <Metric label="Ticket mínimo" value={opportunity.minimumInvestment?.formatted ?? '—'} />
            <Metric label="Inversión total" value={investment.total} />
            <Metric label="Fondos aportados" value={investment.contributed} />
            <Metric label="Financiación bancaria" value={investment.bankFinanced} />
          </dl>
        ) : null}
        <div className="mt-auto pt-5">
          <p className="text-sm leading-6 text-charcoal/80">{opportunity.shortDescription}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-charcoal/70">
            <span>{opportunity.assetType}</span><span aria-hidden="true">·</span><span>{opportunity.strategy}</span>
          </div>
          <Link to={detailHref} className="mt-5 inline-flex rounded-full bg-electric px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-electric-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2">Ver proyecto</Link>
        </div>
      </div>
    </article>
  );
}
