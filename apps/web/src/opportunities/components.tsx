import { Link } from 'react-router';
import { formatDate, formatProgress, returnTypeLabel, riskLabel, statusLabel, type PublicOpportunity } from './api';

export function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0 border border-carbon/10 bg-ivory/80 p-3 text-textDark sm:p-4">
      <dt className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-textDark/75">{label}</dt>
      <dd className={`mt-1 break-words ${emphasis ? 'font-serif text-2xl tracking-[-0.03em]' : 'text-sm font-bold'}`}>{value}</dd>
    </div>
  );
}

export function RiskBadge({ risk }: { risk: PublicOpportunity['riskLevel'] }) {
  return (
    <span className="inline-flex items-center gap-2 border border-bronze bg-ivory px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-textDark">
      <span className="h-2 w-2 rounded-full bg-bronze" aria-hidden="true" />
      Riesgo {riskLabel(risk)}
    </span>
  );
}

export function StatusBadge({ status }: { status: PublicOpportunity['status'] }) {
  return <span className="border border-mineral bg-mineral px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-textDark">{statusLabel(status)}</span>;
}

export function FundingProgress({ value, dark = false }: { value: number; dark?: boolean }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const formatted = formatProgress(safeValue);
  return (
    <div>
      <div className={`mb-2 flex justify-between text-xs font-black uppercase tracking-[0.16em] ${dark ? 'text-muted' : 'text-textDark/65'}`}>
        <span>Financiación</span>
        <span>{formatted} demo</span>
      </div>
      <div
        role="progressbar"
        aria-label="Financiación comprometida"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        className={`h-2 overflow-hidden ${dark ? 'bg-petroleum' : 'bg-carbon/12'}`}
      >
        <div className="h-full bg-mineral" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function OpportunityCard({ opportunity, preserveSearch = true }: { opportunity: PublicOpportunity; preserveSearch?: boolean }) {
  const location = [opportunity.city, opportunity.district].filter(Boolean).join(' · ');
  const detailHref = `/oportunidades/${opportunity.slug}${preserveSearch && typeof window !== 'undefined' ? window.location.search : ''}`;

  return (
    <article aria-label={`Oportunidad pública: ${opportunity.title}`} className="grid overflow-hidden border border-carbon/10 bg-ivory text-textDark shadow-xl shadow-carbon/5 md:grid-cols-[0.42fr_0.58fr]">
      <div className="relative min-h-56 bg-petroleum md:min-h-full">
        {opportunity.primaryImage ? (
          <img src={opportunity.primaryImage.url} alt={opportunity.primaryImage.altText} width="900" height="600" loading="lazy" className="h-full min-h-56 w-full object-cover" />
        ) : (
          <div className="h-full min-h-56 w-full bg-gradient-to-br from-petroleum to-carbon" role="img" aria-label="Imagen pendiente de publicar" />
        )}
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={opportunity.status} />
          <RiskBadge risk={opportunity.riskLevel} />
        </div>
        <h2 className="mt-4 font-serif text-3xl leading-tight tracking-[-0.035em]"><Link className="focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover" to={detailHref}>{opportunity.title}</Link></h2>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-textDark/75">{location}</p>
        <p className="mt-3 text-sm leading-6 text-textDark/72">{opportunity.shortDescription}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.14em] text-textDark/68">
          <span>{opportunity.assetType}</span><span aria-hidden="true">·</span><span>{opportunity.strategy}</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Metric label="Ticket mínimo" value={opportunity.minimumInvestment?.formatted ?? 'No publicado'} />
          <Metric label="Capital objetivo" value={opportunity.targetAmount?.formatted ?? 'No publicado'} />
          <Metric label="Comprometido" value={opportunity.committedAmount?.formatted ?? 'No publicado'} />
          <Metric label="Plazo" value={`${opportunity.estimatedTermMonths} meses`} />
          <Metric label={returnTypeLabel(opportunity.targetReturnType)} value={opportunity.targetReturn.formatted ?? 'No publicado'} emphasis />
          <Metric label="Cierre" value={formatDate(opportunity.closingDate)} />
        </dl>
        <div className="mt-5"><FundingProgress value={opportunity.fundingProgress} /></div>
        <Link to={detailHref} className="mt-5 inline-flex border border-textDark/20 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition hover:border-mineral hover:text-petroleum focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover">Ver oportunidad</Link>
      </div>
    </article>
  );
}
