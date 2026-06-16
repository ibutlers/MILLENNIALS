import { useEffect } from "react";
import { useAuth } from "../auth/context";
import { setPageMetadata } from "../metadata";

export function InvestorProfile() {
  const { user, isAuthAvailable } = useAuth();

  useEffect(() => {
    setPageMetadata(
      "Perfil | MILLENNIALS CONSTRUYEN",
      "Perfil de inversor en MILLENNIALS CONSTRUYEN."
    );
  }, []);

  const memberSince = user?.createdAt
    ? new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(user.createdAt))
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Perfil
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Tu perfil
      </h1>
      <p className="mt-4 text-lg leading-8 text-muted">
        Estos son los datos que MILLENNIALS CONSTRUYEN tiene
        registrados sobre ti. Los campos vacíos aparecen como tales — no los
        hemos inventado.
      </p>

      <section className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-textLight">
          Información de la cuenta
        </h2>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Nombre</dt>
            <dd className="mt-1 text-textLight">
              {user?.name || <span className="italic text-muted">No facilitado</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="mt-1 text-textLight">{user?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Estado de la cuenta</dt>
            <dd className="mt-1">
              <span className="border border-border px-2 py-0.5 text-xs font-semibold text-textLight">
                {user?.status || "—"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email verificado</dt>
            <dd className="mt-1 text-textLight">
              {user?.emailVerified ? "Sí" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Roles</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {user?.roles && user.roles.length > 0
                ? user.roles.map((role) => (
                    <span
                      key={role}
                      className="border border-mineral/50 px-2 py-0.5 text-xs font-semibold text-mineral"
                    >
                      {role}
                    </span>
                  ))
                : <span className="text-muted">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Miembro desde</dt>
            <dd className="mt-1 text-textLight">{memberSince || "—"}</dd>
          </div>
        </dl>
      </section>

      {/* Campos aún no recogidos */}
      <section className="mt-6 border border-border bg-carbon p-6 sm:p-8">
        <h2 className="font-serif text-xl text-textLight">
          Datos pendientes de recoger
        </h2>
        <p className="mt-3 leading-7 text-muted">
          Estos campos forman parte del perfil pero todavía no te los hemos
          solicitado. Ninguno de ellos está inventado ni contiene datos
          ficticios.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Dirección</dt>
            <dd className="mt-0.5 italic text-muted">No facilitada</dd>
          </div>
          <div>
            <dt className="text-muted">Teléfono</dt>
            <dd className="mt-0.5 italic text-muted">No facilitado</dd>
          </div>
          <div>
            <dt className="text-muted">Documento de identidad</dt>
            <dd className="mt-0.5 italic text-muted">No facilitado</dd>
          </div>
          <div>
            <dt className="text-muted">Residencia fiscal</dt>
            <dd className="mt-0.5 italic text-muted">No facilitada</dd>
          </div>
        </dl>
      </section>

      {!isAuthAvailable ? (
        <div className="mt-6 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
          La edición del perfil estará disponible cuando la autenticación se
          habilite en producción.
        </div>
      ) : null}
    </div>
  );
}
