import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/context';
import { setPageMetadata } from '../metadata';

type AccountType = 'individual' | 'company';
type Values = Record<string, string>;
type FieldDef = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'select';
  optional?: boolean;
  full?: boolean;
  autoComplete?: string;
};

const countries = ['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 'Estados Unidos', 'México', 'Otro'];

const individualFields: FieldDef[] = [
  { name: 'firstName', label: 'Nombre', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Apellidos', autoComplete: 'family-name' },
  { name: 'documentId', label: 'Documento de identidad (DNI/NIE/Pasaporte)', placeholder: 'Introduce tu número de identificación. Ejemplo: 12345678A', full: true },
  { name: 'birthDate', label: 'Fecha de nacimiento', type: 'date', autoComplete: 'bday' },
  { name: 'nationality', label: 'Nacionalidad', type: 'select' },
  { name: 'phone', label: 'Teléfono móvil', placeholder: 'Incluye tu código de país. Ejemplo: +34 600 000 000', full: true, autoComplete: 'tel' },
  { name: 'taxResidency', label: 'País de residencia fiscal', type: 'select', full: true },
  { name: 'address', label: 'Dirección postal (incluye calle, número, piso, puerta y ciudad)', placeholder: 'Incluye calle, número, piso, puerta y ciudad.', full: true, autoComplete: 'street-address' },
];

const companyFields: FieldDef[] = [
  { name: 'companyName', label: 'Denominación social', placeholder: 'Escribe aquí…', autoComplete: 'organization' },
  { name: 'taxId', label: 'Nº de identificación fiscal (CIF/NIF)', placeholder: 'Escribe aquí…' },
  { name: 'representativeFirstName', label: 'Nombre del representante', autoComplete: 'given-name' },
  { name: 'representativeLastName', label: 'Apellidos del representante', autoComplete: 'family-name' },
  { name: 'representativeDocumentId', label: 'Documento de identidad del representante (DNI/NIE/Pasaporte)', placeholder: 'Introduce el número de identificación del representante.', full: true },
  { name: 'representativeBirthDate', label: 'Fecha de nacimiento del representante', type: 'date' },
  { name: 'representativeNationality', label: 'Nacionalidad del representante', type: 'select' },
  { name: 'representativePhone', label: 'Teléfono móvil', placeholder: 'Incluye tu código de país. Ejemplo: +34 600 000 000', full: true, autoComplete: 'tel' },
  { name: 'representativeRole', label: 'Cargo / relación con la sociedad', placeholder: 'Ejemplo: Administrador único, Director financiero' },
  { name: 'companyCountry', label: 'País de constitución de la sociedad', type: 'select' },
  { name: 'companyTaxResidency', label: 'País de residencia fiscal de la sociedad', type: 'select', full: true },
  { name: 'companyAddress', label: 'Domicilio de la sociedad (incluye calle, número, piso, puerta y ciudad)', placeholder: 'Incluye calle, número, piso, puerta y ciudad.', full: true, autoComplete: 'street-address' },
  { name: 'website', label: 'Página web (opcional)', placeholder: 'Si deseas vincular tu empresa públicamente.', optional: true, full: true, autoComplete: 'url' },
  { name: 'companyDescription', label: 'Descripción breve de la empresa (opcional)', placeholder: 'Ejemplo: Actividad principal, sector o experiencia en inversión.', optional: true, full: true },
];

function splitDisplayName(name?: string | null, email?: string | null) {
  const fallback = email?.split('@')[0]?.replace(/[._-]+/g, ' ') ?? '';
  const value = (name?.trim() || fallback.trim()).replace(/\s+/g, ' ');
  const [firstName = '', ...rest] = value.split(' ');
  return { firstName, lastName: rest.join(' ') };
}

function requiredFields(fields: FieldDef[]) {
  return fields.filter((field) => !field.optional).map((field) => field.name);
}

function hasRequiredValues(values: Values, fields: FieldDef[]) {
  return requiredFields(fields).every((name) => values[name]?.trim());
}

export function InvestorVerification() {
  const { user } = useAuth();
  const displayName = user?.name || user?.email?.split('@')[0] || 'Perfil principal';
  const nameParts = useMemo(() => splitDisplayName(user?.name, user?.email), [user?.email, user?.name]);
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [individual, setIndividual] = useState<Values>({});
  const [company, setCompany] = useState<Values>({});

  useEffect(() => {
    setPageMetadata('KYC | MILLENNIALS CONSTRUYEN', 'Apartado KYC de verificación de identidad para inversores de MILLENNIALS CONSTRUYEN.');
  }, []);

  useEffect(() => {
    setIndividual((current) => ({ ...current, firstName: current.firstName || nameParts.firstName, lastName: current.lastName || nameParts.lastName }));
    setCompany((current) => ({ ...current, representativeFirstName: current.representativeFirstName || nameParts.firstName, representativeLastName: current.representativeLastName || nameParts.lastName }));
  }, [nameParts.firstName, nameParts.lastName]);

  const activeFields = accountType === 'company' ? companyFields : individualFields;
  const activeValues = accountType === 'company' ? company : individual;
  const canContinueFromData = hasRequiredValues(activeValues, activeFields);

  function updateValue(name: string, value: string) {
    if (accountType === 'company') {
      setCompany((current) => ({ ...current, [name]: value }));
    } else {
      setIndividual((current) => ({ ...current, [name]: value }));
    }
  }

  return (
    <div className="min-h-screen bg-lavender text-ink">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-electric">KYC</p>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,0.64fr)_minmax(320px,0.36fr)] lg:items-end">
          <div className="min-w-0">
            <h1 className="max-w-4xl font-serif text-5xl leading-[0.96] tracking-[-0.055em] text-ink sm:text-6xl lg:text-7xl">
              Completa tu verificación KYC
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-charcoal/75">
              Prepara tu perfil de inversor y la documentación necesaria antes de iniciar cualquier operación. El proceso distingue entre persona física y empresa para solicitar solo la información aplicable.
            </p>
          </div>

          <aside className="rounded-[1.4rem] border border-frost bg-white p-5 shadow-[0_18px_55px_rgba(5,5,5,0.045)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-charcoal/75">Estado actual</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight tracking-[-0.035em] text-ink">Verificación de identidad pendiente</h2>
            <div className="mt-5 rounded-2xl border border-warning/25 bg-warning/10 p-4 text-sm leading-6 text-charcoal/80">
              <strong className="text-ink">Proveedor KYC no configurado.</strong> Puedes revisar el flujo y preparar los datos, pero todavía no se envía información sensible ni se inicia una validación externa.
            </div>
            <p className="mt-3 text-xs leading-5 text-charcoal/75">No se generan enlaces, códigos QR ni estados verificados ficticios.</p>
          </aside>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end" aria-label="Perfil operativo KYC">
          <div>
            <label htmlFor="kyc-profile" className="text-sm font-semibold text-charcoal/75">Selecciona el perfil desde el que deseas operar</label>
            <select id="kyc-profile" className="mt-2 h-14 w-full rounded-2xl border border-frost bg-white px-4 text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-electric">
              <option>{displayName}</option>
            </select>
          </div>
          <button type="button" disabled className="h-14 rounded-2xl border border-charcoal/25 bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-charcoal/45 shadow-sm cursor-not-allowed" title="Disponible cuando exista gestión real de múltiples perfiles">
            + Añadir nuevo perfil
          </button>
        </section>

        <ProgressBar step={step} />

        <section className="mt-8 rounded-[1.6rem] border border-frost bg-white p-5 shadow-[0_24px_80px_rgba(5,5,5,0.08)] sm:p-8 lg:p-10">
          {step === 1 ? <AccountTypeStep accountType={accountType} onSelect={setAccountType} onContinue={() => setStep(2)} /> : null}
          {step === 2 && accountType ? <ProfileStep accountType={accountType} fields={activeFields} values={activeValues} canContinue={canContinueFromData} onChange={updateValue} onBack={() => setStep(1)} onContinue={() => setStep(3)} /> : null}
          {step === 3 ? <DocumentStep accountType={accountType} onBack={() => setStep(2)} /> : null}
        </section>
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  const percentage = Math.round((step / 3) * 100);
  return (
    <div className="mt-10" aria-label={`Paso ${step} de 3`}>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm font-semibold text-ink">
        <span>Paso {step} de 3</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-frost">
        <div
          className="h-full rounded-full bg-electric transition-all duration-300"
          role="progressbar"
          aria-label="Progreso de verificación KYC"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function AccountTypeStep({ accountType, onSelect, onContinue }: { accountType: AccountType | null; onSelect: (type: AccountType) => void; onContinue: () => void }) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-electric">1. Tipo de cuenta</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.04em] text-ink">¿Cómo deseas registrarte?</h2>
          <p className="mt-3 max-w-3xl leading-7 text-charcoal/75">Indícanos si invertirás a título personal o a través de una sociedad. Esto personaliza tu verificación y los documentos que se solicitarán después.</p>
        </div>
        <span className="rounded-full border border-frost px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-charcoal/75">Pendiente</span>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <AccountTypeCard title="Persona física" description="Invierto a título personal, utilizando mi propio nombre y documento de identidad." benefits={['Más rápido de completar', 'Solo requiere DNI/NIE o pasaporte', 'Pensado para inversiones individuales']} selected={accountType === 'individual'} onClick={() => onSelect('individual')} />
        <AccountTypeCard title="Empresa o entidad jurídica" description="Invierto a través de una sociedad o empresa registrada, como representante autorizado." benefits={['Centraliza inversiones de empresa', 'Requiere documentación societaria', 'Pensado para estructuras corporativas']} selected={accountType === 'company'} onClick={() => onSelect('company')} />
      </div>

      <button type="button" disabled={!accountType} onClick={onContinue} className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl bg-ink px-6 text-base font-black text-white transition hover:bg-electric disabled:cursor-not-allowed disabled:bg-charcoal/35">Continuar</button>
      <p className="mt-5 rounded-2xl bg-lavender/70 p-4 text-sm leading-6 text-charcoal/70">Más adelante podrás añadir nuevos perfiles o actualizar esta información desde tu cuenta si cambian tus circunstancias. Máximo un perfil de persona física por usuario.</p>
    </div>
  );
}

function AccountTypeCard({ title, description, benefits, selected, onClick }: { title: string; description: string; benefits: string[]; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`min-w-0 rounded-2xl border p-6 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-electric ${selected ? 'border-electric bg-electric/5 ring-2 ring-electric/20' : 'border-frost bg-white hover:border-electric/40 hover:shadow-md'}`}>
      <span className="block text-center text-2xl font-semibold text-ink">{title}</span>
      <span className="mx-auto mt-4 block max-w-md text-center text-sm leading-6 text-charcoal/70">{description}</span>
      <span className="mt-6 block text-center text-sm font-black text-charcoal/75">Detalles / ventajas:</span>
      <span className="mt-3 block space-y-2 text-sm leading-6 text-charcoal/70">
        {benefits.map((benefit) => <span key={benefit} className="flex items-start justify-center gap-2"><span className="mt-0.5 text-electric" aria-hidden="true">✓</span><span>{benefit}</span></span>)}
      </span>
    </button>
  );
}

function ProfileStep({ accountType, fields, values, canContinue, onChange, onBack, onContinue }: { accountType: AccountType; fields: FieldDef[]; values: Values; canContinue: boolean; onChange: (name: string, value: string) => void; onBack: () => void; onContinue: () => void }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.18em] text-electric">2. Datos del perfil</p>
      <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.04em] text-ink">Completa los datos de tu perfil</h2>
      <div className="mt-4 max-w-4xl space-y-3 leading-7 text-charcoal/75"><p>Necesitamos algunos datos básicos para verificar tu identidad y cumplir con los requisitos legales antes de que puedas invertir.</p><p>Cuando se active el proveedor KYC, el tratamiento de estos datos deberá quedar cubierto por el flujo seguro, la política de privacidad y las garantías aplicables.</p></div>
      <div className="mt-8 grid gap-5 rounded-2xl bg-lavender/55 p-4 sm:p-6 lg:grid-cols-2">{fields.map((field) => <KycField key={field.name} field={field} value={values[field.name] ?? ''} onChange={(value) => onChange(field.name, value)} />)}</div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onBack} className="h-14 rounded-2xl border border-frost bg-white px-6 text-sm font-black uppercase tracking-[0.14em] text-ink transition hover:border-electric hover:text-electric">Volver</button><button type="button" disabled={!canContinue} onClick={onContinue} className="h-14 flex-1 rounded-2xl bg-ink px-6 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-electric disabled:cursor-not-allowed disabled:bg-charcoal/35">Continuar al paso documental</button></div>
      <p className="mt-5 rounded-2xl bg-lavender/70 p-4 text-sm leading-6 text-charcoal/70">Estos datos preparan la validación, pero todavía no se guardan ni se envían a un tercero porque el proveedor KYC no está activo.</p>
      <p className="sr-only">Tipo de cuenta seleccionado: {accountType}</p>
    </div>
  );
}

function KycField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (value: string) => void }) {
  const id = `kyc-${field.name}`;
  return (
    <div className={field.full ? 'lg:col-span-2' : ''}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">{field.label}</label>
      {field.type === 'select' ? (
        <select
          id={id}
          value={value}
          required={!field.optional}
          aria-required={!field.optional}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-14 w-full rounded-2xl border border-transparent bg-white px-4 text-base text-ink shadow-sm focus:border-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric"
        ><option value="">Selecciona una opción</option>{countries.map((country) => <option key={country} value={country}>{country}</option>)}</select>
      ) : (
        <input
          id={id}
          type={field.type ?? 'text'}
          value={value}
          required={!field.optional}
          aria-required={!field.optional}
          placeholder={field.placeholder ?? 'Escribe aquí…'}
          autoComplete={field.autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-14 w-full rounded-2xl border border-transparent bg-white px-4 text-base text-ink shadow-sm placeholder:text-charcoal/45 focus:border-electric focus:outline-none focus-visible:ring-2 focus-visible:ring-electric"
        />
      )}
    </div>
  );
}

function DocumentStep({ accountType, onBack }: { accountType: AccountType | null; onBack: () => void }) {
  const documents = accountType === 'company' ? ['Documento del representante', 'Escritura o poderes de representación', 'Certificado de titularidad real', 'Justificante de domicilio fiscal'] : ['Documento de identidad oficial', 'Comprobante de domicilio', 'Autocertificación de residencia fiscal'];
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.18em] text-electric">3. Documentación</p>
      <h2 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.04em] text-ink">Documentación y verificación externa</h2>
      <p className="mt-4 max-w-4xl leading-7 text-charcoal/75">Este paso quedará conectado al proveedor KYC cuando esté contratado y configurado. Hasta entonces, la pantalla no permite subir documentos ni escanear códigos reales.</p>
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.56fr)_minmax(280px,0.44fr)]"><section className="rounded-2xl bg-lavender/60 p-5"><h3 className="font-serif text-2xl tracking-[-0.03em] text-ink">Documentos previstos</h3><ul className="mt-5 space-y-3 text-sm leading-6 text-charcoal/75">{documents.map((document) => <li key={document} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-electric/10 text-electric" aria-hidden="true">✓</span><span>{document}</span></li>)}</ul></section><section className="rounded-2xl border border-frost bg-white p-5 text-center shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-charcoal/75">Verificación externa</p><div className="mx-auto mt-5 grid aspect-square max-w-[280px] place-items-center rounded-[2rem] border border-dashed border-electric/35 bg-lavender/65 p-8"><div className="grid h-24 w-24 place-items-center rounded-3xl bg-ink text-4xl font-black text-electric">MC</div></div><h3 className="mt-5 font-serif text-2xl tracking-[-0.03em] text-ink">Sesión externa pendiente</h3><p className="mt-3 text-sm leading-6 text-charcoal/75">No se generan enlaces, códigos QR ni estados verificados ficticios. La integración real deberá abrir una sesión segura del proveedor contratado.</p><button type="button" disabled className="mt-5 h-12 w-full rounded-2xl border border-charcoal/25 bg-frost px-5 text-sm font-black uppercase tracking-[0.14em] text-charcoal/75 cursor-not-allowed">Iniciar verificación externa</button></section></div>
      <button type="button" onClick={onBack} className="mt-8 h-14 rounded-2xl border border-frost bg-white px-6 text-sm font-black uppercase tracking-[0.14em] text-ink transition hover:border-electric hover:text-electric">Volver a datos del perfil</button>
    </div>
  );
}
