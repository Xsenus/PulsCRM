import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../app/AuthContext';
import { getApiErrorMessage } from '../app/apiErrors';
import { forgetColleaguePhoto, forgetColleaguesCache } from '../app/colleagues';
import {
  STATUS_OPTIONS,
  STATUS_TEXT_MAX_LENGTH,
  changeMyPassword,
  clearMyStatus,
  deleteMyPhoto,
  formatStatus,
  getMyProfile,
  getStatusNote,
  prepareProfilePhoto,
  setMyStatus,
  updateMyContacts,
  updateMyPhoto,
  type MyProfileDto
} from '../app/profile';
import { showToast } from '../app/toast';
import { AppLoader, LoadingButtonLabel } from '../components/AppLoader';
import { ColleagueAvatar } from '../components/ColleagueAvatar';
import { PageHeader } from '../components/PageHeader';

type UntilChoice = 'none' | 'hour' | 'today' | 'tomorrow' | 'date';

const UNTIL_OPTIONS: Array<{ value: UntilChoice; label: string }> = [
  { value: 'none', label: 'Пока не сниму' },
  { value: 'hour', label: 'На час' },
  { value: 'today', label: 'До конца дня' },
  { value: 'tomorrow', label: 'До конца завтра' },
  { value: 'date', label: 'До даты' }
];

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0, 0);
}

/** Срок статуса в UTC по выбору; для «До даты» — конец выбранного дня (включительно). */
export function resolveStatusUntil(choice: UntilChoice, date: string, now = new Date()): string | null {
  switch (choice) {
    case 'hour':
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case 'today':
      return endOfDay(now).toISOString();
    case 'tomorrow':
      return endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)).toISOString();
    case 'date': {
      const [year, month, day] = date.split('-').map(Number);
      return year && month && day ? endOfDay(new Date(year, month - 1, day)).toISOString() : null;
    }
    default:
      return null;
  }
}

function todayInputValue(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function ProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<MyProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [phone, setPhone] = useState('');
  const [internalPhone, setInternalPhone] = useState('');
  const [contactsBusy, setContactsBusy] = useState(false);

  const [statusKind, setStatusKind] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [untilChoice, setUntilChoice] = useState<UntilChoice>('none');
  const [untilDate, setUntilDate] = useState(todayInputValue());
  const [statusBusy, setStatusBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const applyProfile = (next: MyProfileDto) => {
    setProfile(next);
    setPhone(next.phone ?? '');
    setInternalPhone(next.internalPhone ?? '');
  };

  useEffect(() => {
    let active = true;
    getMyProfile()
      .then((next) => {
        if (!active) {
          return;
        }

        applyProfile(next);
        setStatusKind(next.status?.kind ?? null);
        setStatusText(next.status?.text ?? '');
      })
      .catch((reason) => active && setError(getApiErrorMessage(reason, 'Не удалось загрузить профиль.')));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <div className="page"><PageHeader title="Мой профиль" /><div className="panel empty-state">{error}</div></div>;
  }

  if (!profile) {
    return <div className="page"><PageHeader title="Мой профиль" /><section className="panel"><AppLoader variant="panel" label="Загружаем профиль" /></section></div>;
  }

  const afterPhotoChange = async (next: MyProfileDto) => {
    applyProfile(next);
    forgetColleaguePhoto(next.id);
    setPhotoVersion((value) => value + 1);
    await refreshUser().catch(() => undefined);
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setPhotoBusy(true);
    try {
      await afterPhotoChange(await updateMyPhoto(await prepareProfilePhoto(file)));
      showToast('Фото обновлено.', 'success');
    } catch (reason) {
      showToast(getApiErrorMessage(reason, reason instanceof Error ? reason.message : 'Не удалось сохранить фото.'), 'error');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await afterPhotoChange(await deleteMyPhoto());
      showToast('Фото удалено.', 'success');
    } catch (reason) {
      showToast(getApiErrorMessage(reason, 'Не удалось удалить фото.'), 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveContacts = async (event: React.FormEvent) => {
    event.preventDefault();
    setContactsBusy(true);
    try {
      applyProfile(await updateMyContacts(phone, internalPhone));
      forgetColleaguesCache();
      await refreshUser().catch(() => undefined);
      showToast('Контакты сохранены.', 'success');
    } catch (reason) {
      showToast(getApiErrorMessage(reason, 'Не удалось сохранить контакты.'), 'error');
    } finally {
      setContactsBusy(false);
    }
  };

  const saveStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!statusKind) {
      return;
    }

    const until = resolveStatusUntil(untilChoice, untilDate);
    if (untilChoice === 'date' && !until) {
      showToast('Укажите дату.', 'error');
      return;
    }

    setStatusBusy(true);
    try {
      const status = await setMyStatus(statusKind, statusText.trim(), until);
      setProfile((current) => (current ? { ...current, status } : current));
      forgetColleaguesCache();
      showToast('Статус установлен — его видят коллеги.', 'success');
    } catch (reason) {
      showToast(getApiErrorMessage(reason, 'Не удалось установить статус.'), 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const removeStatus = async () => {
    setStatusBusy(true);
    try {
      await clearMyStatus();
      setProfile((current) => (current ? { ...current, status: null } : current));
      setStatusKind(null);
      setStatusText('');
      setUntilChoice('none');
      forgetColleaguesCache();
      showToast('Статус снят.', 'success');
    } catch (reason) {
      showToast(getApiErrorMessage(reason, 'Не удалось снять статус.'), 'error');
    } finally {
      setStatusBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== repeatPassword) {
      showToast('Новый пароль и повтор не совпадают.', 'error');
      return;
    }

    setPasswordBusy(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      showToast('Пароль изменен. В следующий раз входите с новым паролем.', 'success');
    } catch (reason) {
      showToast(getApiErrorMessage(reason, 'Не удалось изменить пароль.'), 'error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const status = profile.status;
  const statusNote = status ? getStatusNote(status) : null;
  const colleagueView = { id: profile.id, fullName: profile.fullName, hasPhoto: profile.hasPhoto, isMale: false };

  return (
    <div className="page profile-page">
      <PageHeader title="Мой профиль" subtitle="Фото, телефоны, статус и пароль. ФИО, должность, отдел и e-mail меняет администратор." />

      <section className="panel profile-identity" aria-label="Обо мне">
        <div className="profile-photo">
          <ColleagueAvatar key={photoVersion} colleague={colleagueView} size={112} />
          <div className="profile-photo-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Файл фото" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
            <button type="button" className="secondary-button button-inline" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
              {photoBusy ? <LoadingButtonLabel label="Сохраняем" /> : profile.hasPhoto ? 'Сменить фото' : 'Загрузить фото'}
            </button>
            {profile.hasPhoto ? (
              <button type="button" className="secondary-button button-inline profile-photo-remove" onClick={() => void removePhoto()} disabled={photoBusy}>
                Удалить
              </button>
            ) : null}
          </div>
        </div>
        <div className="profile-identity-copy">
          <h2>{profile.fullName}</h2>
          {profile.position ? <div className="profile-identity-position">{profile.position}</div> : null}
          {profile.department ? <div className="profile-identity-department">{profile.department}</div> : null}
          <dl className="profile-identity-meta">
            <div><dt>Логин</dt><dd>{profile.login}</dd></div>
            {profile.email ? <div><dt>E-mail</dt><dd>{profile.email}</dd></div> : null}
          </dl>
          {status ? (
            <div className="profile-current-status" role="status">
              <span>{formatStatus(status)}</span>
              {statusNote ? <span className="profile-current-status-note">{statusNote}</span> : null}
            </div>
          ) : null}
        </div>
      </section>

      <form className="panel profile-section" aria-labelledby="profile-status-title" onSubmit={(event) => void saveStatus(event)}>
        <h2 id="profile-status-title">Статус</h2>
        <p className="field-hint">Коллеги увидят его в карточке сотрудника и в чате. По истечении срока статус снимется сам.</p>
        <div className="profile-status-options" role="radiogroup" aria-label="Статус">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              role="radio"
              aria-checked={statusKind === option.kind}
              className={`profile-status-option${statusKind === option.kind ? ' selected' : ''}`}
              onClick={() => setStatusKind(option.kind)}
            >
              <span aria-hidden="true">{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>

        {statusKind ? (
          <div className="form-grid profile-status-details">
            <div className="field field-wide">
              <label htmlFor="profile-status-text">{statusKind === 'custom' ? 'Ваш статус' : 'Пояснение (необязательно)'}</label>
              <input
                id="profile-status-text"
                className="form-input"
                value={statusText}
                maxLength={STATUS_TEXT_MAX_LENGTH}
                placeholder={statusKind === 'custom' ? 'Например: Обучение до обеда' : 'Например: По срочным вопросам — Петров'}
                onChange={(event) => setStatusText(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-status-until">Срок</label>
              <select id="profile-status-until" className="form-input" value={untilChoice} onChange={(event) => setUntilChoice(event.target.value as UntilChoice)}>
                {UNTIL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {untilChoice === 'date' ? (
              <div className="field">
                <label htmlFor="profile-status-date">Включительно по</label>
                <input id="profile-status-date" type="date" className="form-input" min={todayInputValue()} value={untilDate} onChange={(event) => setUntilDate(event.target.value)} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="profile-section-actions">
          {status ? (
            <button type="button" className="secondary-button button-inline" onClick={() => void removeStatus()} disabled={statusBusy}>Снять статус</button>
          ) : null}
          <button type="submit" className="primary-button button-inline" disabled={statusBusy || !statusKind || (statusKind === 'custom' && !statusText.trim())}>
            {statusBusy ? <LoadingButtonLabel label="Сохраняем" /> : 'Установить статус'}
          </button>
        </div>
      </form>

      <form className="panel profile-section" aria-labelledby="profile-contacts-title" onSubmit={(event) => void saveContacts(event)}>
        <h2 id="profile-contacts-title">Контакты</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="profile-phone">Телефон</label>
            <input id="profile-phone" className="form-input" type="tel" value={phone} maxLength={100} placeholder="+7 900 000-00-00" onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="profile-internal-phone">Внутренний номер</label>
            <input id="profile-internal-phone" className="form-input" value={internalPhone} maxLength={100} placeholder="205" onChange={(event) => setInternalPhone(event.target.value)} />
          </div>
        </div>
        <div className="profile-section-actions">
          <button type="submit" className="primary-button button-inline" disabled={contactsBusy}>
            {contactsBusy ? <LoadingButtonLabel label="Сохраняем" /> : 'Сохранить контакты'}
          </button>
        </div>
      </form>

      <form className="panel profile-section" aria-labelledby="profile-password-title" onSubmit={(event) => void savePassword(event)}>
        <h2 id="profile-password-title">Пароль</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="profile-current-password">Текущий пароль</label>
            <input id="profile-current-password" className="form-input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="profile-new-password">Новый пароль</label>
            <input id="profile-new-password" className="form-input" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="profile-repeat-password">Повторите новый пароль</label>
            <input id="profile-repeat-password" className="form-input" type="password" autoComplete="new-password" value={repeatPassword} onChange={(event) => setRepeatPassword(event.target.value)} />
          </div>
        </div>
        <p className="field-hint">Не короче 6 символов.</p>
        <div className="profile-section-actions">
          <button type="submit" className="primary-button button-inline" disabled={passwordBusy || !currentPassword || newPassword.length < 6 || !repeatPassword}>
            {passwordBusy ? <LoadingButtonLabel label="Меняем" /> : 'Изменить пароль'}
          </button>
        </div>
      </form>
    </div>
  );
}
