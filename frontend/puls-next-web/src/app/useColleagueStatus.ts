import { useEffect, useState } from 'react';
import { getColleaguesCached } from './colleagues';
import { isStatusActive, type UserStatusDto } from './profile';

/** Статус коллеги из «Моего профиля» (справочник кэшируется на минуту); null — статуса нет. */
export function useColleagueStatus(userId: number | null | undefined): UserStatusDto | null {
  const [status, setStatus] = useState<UserStatusDto | null>(null);

  useEffect(() => {
    let active = true;
    setStatus(null);
    if (!userId) {
      return undefined;
    }

    getColleaguesCached()
      .then((colleagues) => {
        const found = colleagues.find((item) => item.id === userId)?.status;
        if (active) {
          setStatus(isStatusActive(found) ? found : null);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  return status;
}
