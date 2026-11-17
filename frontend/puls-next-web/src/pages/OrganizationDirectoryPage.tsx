import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { isAdmin } from '../app/access';
import { getApiErrorMessage } from '../app/apiErrors';
import {
  getOrganizationDirectoryCard,
  phoneHref,
  searchOrganizationDirectory,
  siteHref,
  type OrganizationDirectoryCardDto,
  type OrganizationDirectoryItemDto
} from '../app/organizationDirectory';
import { AppLoader } from '../components/AppLoader';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 25;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/** Карточка организации только для чтения: реквизиты, адреса, телефоны, e-mail, руководитель, контакты. */
function OrganizationCard({ id, onClose }: { id: number; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [card, setCard] = useState<OrganizationDirectoryCardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOrganizationDirectoryCard(id)
      .then((value) => active && setCard(value))
      .catch((reason) => active && setError(getApiErrorMessage(reason, 'Организация не найдена.')));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Modal
      open
      title={card?.name ?? 'Организация'}
      onClose={onClose}
      maxWidth={640}
      actions={isAdmin(user) ? (
        <button type="button" className="secondary-button button-inline" onClick={() => navigate(`/organizations/${id}/edit`)}>Полная карточка</button>
      ) : undefined}
    >
      {error ? <div className="empty-state">{error}</div> : null}
      {!card && !error ? <AppLoader variant="panel" label="Загружаем карточку" /> : null}
      {card ? (
        <div className="org-directory-card">
          {card.fullName && card.fullName !== card.name ? <p className="org-directory-card-fullname">{card.fullName}</p> : null}
          <dl className="org-directory-fields">
            {card.inn ? <Row label="ИНН">{card.inn}</Row> : null}
            {card.kpp ? <Row label="КПП">{card.kpp}</Row> : null}
            {card.ogrn ? <Row label="ОГРН">{card.ogrn}</Row> : null}
            {card.raion ? <Row label="Район">{card.raion}</Row> : null}
            {card.orgType ? <Row label="Тип">{card.orgType}</Row> : null}
            {card.addressLegal ? <Row label="Юр. адрес">{card.addressLegal}</Row> : null}
            {card.addressActual && card.addressActual !== card.addressLegal ? <Row label="Факт. адрес">{card.addressActual}</Row> : null}
            {card.phone ? <Row label="Телефон"><a href={phoneHref(card.phone)}>{card.phone}</a></Row> : null}
            {card.emails.map((item) => (
              <Row key={item.label} label={`E-mail (${item.label.toLowerCase()})`}><a href={`mailto:${item.email}`}>{item.email}</a></Row>
            ))}
            {card.site ? <Row label="Сайт"><a href={siteHref(card.site)} target="_blank" rel="noreferrer">{card.site}</a></Row> : null}
          </dl>

          {card.directorName ? (
            <section className="org-directory-section" aria-label="Руководитель">
              <h3>Руководитель</h3>
              <div className="org-directory-person">
                <strong>{card.directorName}</strong>
                {card.directorPosition ? <span>{card.directorPosition}</span> : null}
                {card.directorPhone ? <a href={phoneHref(card.directorPhone)}>{card.directorPhone}</a> : null}
              </div>
            </section>
          ) : null}

          <section className="org-directory-section" aria-label="Контактные лица">
            <h3>Контактные лица</h3>
            {card.contacts.length === 0 ? <div className="org-directory-empty">Контакты не указаны.</div> : null}
            <ul className="org-directory-contacts">
              {card.contacts.map((contact, index) => (
                <li key={`${contact.fio ?? ''}-${index}`} className="org-directory-person">
                  <strong>{contact.fio ?? 'Без имени'}</strong>
                  {contact.position ? <span>{contact.position}</span> : null}
                  {contact.phone ? <a href={phoneHref(contact.phone)}>{contact.phone}</a> : null}
                  {contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

/** Справочник организаций только для чтения: поиск по названию, ИНН и району, карточка с контактами. */
export function OrganizationDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: OrganizationDirectoryItemDto[]; totalCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const openId = Number(searchParams.get('open')) || null;

  // Поиск — после паузы в наборе, чтобы не дергать сервер на каждую букву.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setApplied(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    searchOrganizationDirectory(applied, (page - 1) * PAGE_SIZE, PAGE_SIZE)
      .then((value) => active && setResult(value))
      .catch((reason) => active && setError(getApiErrorMessage(reason, 'Не удалось загрузить организации.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [applied, page]);

  const open = (id: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set('open', String(id));
    } else {
      next.delete('open');
    }

    setSearchParams(next, { replace: !id });
  };

  return (
    <div className="page org-directory">
      <PageHeader title="Организации" subtitle="Справочник клиентов: реквизиты, телефоны, e-mail и контактные лица." />

      <section className="panel org-directory-panel">
        <input
          className="form-input org-directory-search"
          type="search"
          value={search}
          placeholder="Название, ИНН или район"
          aria-label="Поиск организаций"
          onChange={(event) => setSearch(event.target.value)}
        />

        {error ? <div className="empty-state">{error}</div> : null}
        {!result && loading ? <AppLoader variant="panel" label="Загружаем организации" /> : null}
        {result && result.items.length === 0 && !loading ? <div className="empty-state">Ничего не найдено.</div> : null}

        {result && result.items.length > 0 ? (
          <ul className={`org-directory-list${loading ? ' loading' : ''}`} aria-label="Организации">
            {result.items.map((item) => (
              <li key={item.id}>
                <button type="button" className="org-directory-item" onClick={() => open(item.id)}>
                  <span className="org-directory-item-main">
                    <span className="org-directory-item-name">{item.name}</span>
                    <span className="org-directory-item-meta">
                      {[item.inn ? `ИНН ${item.inn}` : null, item.raion].filter(Boolean).join(' · ') || ' '}
                    </span>
                  </span>
                  <span className="org-directory-item-contacts">
                    {item.phone ? <span>{item.phone}</span> : null}
                    {item.email ? <span>{item.email}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {result && result.totalCount > PAGE_SIZE ? (
          <Pagination page={page} pageSize={PAGE_SIZE} totalCount={result.totalCount} onPageChange={setPage} />
        ) : null}
      </section>

      {openId ? <OrganizationCard id={openId} onClose={() => open(null)} /> : null}
    </div>
  );
}
