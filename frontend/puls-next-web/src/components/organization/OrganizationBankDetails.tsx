import React from 'react';
import { formatDateTime } from '../../app/format';

const EMPTY_VALUE = '-';

export interface OrganizationBankDetailsData {
  okved?: string;
  okpo?: string;
  pfrNumber?: string;
  fssNumber?: string;
  bankName?: string;
  bankBik?: string;
  bankCity?: string;
  bankAccount?: string;
  personalAccount?: string;
  bankCorrespondentAccount?: string;
  pfrAgreementNumber?: string;
  pfrAgreementDateUtc?: string;
  ecpComment?: string;
  ecpContractComment?: string;
}

function textValue(value?: string | number | null) {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.toString().trim() || EMPTY_VALUE;
}

export function OrganizationBankDetails({ details }: { details?: OrganizationBankDetailsData | null }) {
  return (
    <div className="panel-subsection">
      <h4>ЭЦП и банковские реквизиты</h4>
      <div className="detail-grid" role="list" aria-label="Банковские реквизиты организации">
        <div className="detail-card" role="listitem">
          <strong>ОКВЭД</strong>
          <span>{textValue(details?.okved)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>ОКПО</strong>
          <span>{textValue(details?.okpo)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>ПФР</strong>
          <span>{textValue(details?.pfrNumber)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>ФСС</strong>
          <span>{textValue(details?.fssNumber)}</span>
        </div>
        <div className="detail-card detail-card-wide" role="listitem">
          <strong>Банк</strong>
          <span>{textValue(details?.bankName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>БИК</strong>
          <span>{textValue(details?.bankBik)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Город банка</strong>
          <span>{textValue(details?.bankCity)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Расчетный счет</strong>
          <span>{textValue(details?.bankAccount)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Лицевой счет</strong>
          <span>{textValue(details?.personalAccount)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Корр. счет</strong>
          <span>{textValue(details?.bankCorrespondentAccount)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Соглашение с ПФР</strong>
          <span>{textValue(details?.pfrAgreementNumber)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Дата соглашения</strong>
          <span>{formatDateTime(details?.pfrAgreementDateUtc) || EMPTY_VALUE}</span>
        </div>
      </div>
      <div className="detail-list" role="list" aria-label="Комментарии ЭЦП организации">
        <div role="listitem">
          <strong>Комментарий ЭЦП</strong>
          <div className="field-hint">{textValue(details?.ecpComment)}</div>
        </div>
        <div role="listitem">
          <strong>Комментарий ЭЦП в договор</strong>
          <div className="field-hint">{textValue(details?.ecpContractComment)}</div>
        </div>
      </div>
    </div>
  );
}
