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
      <div className="detail-grid">
        <div className="detail-card">
          <strong>ОКВЭД</strong>
          <span>{textValue(details?.okved)}</span>
        </div>
        <div className="detail-card">
          <strong>ОКПО</strong>
          <span>{textValue(details?.okpo)}</span>
        </div>
        <div className="detail-card">
          <strong>ПФР</strong>
          <span>{textValue(details?.pfrNumber)}</span>
        </div>
        <div className="detail-card">
          <strong>ФСС</strong>
          <span>{textValue(details?.fssNumber)}</span>
        </div>
        <div className="detail-card detail-card-wide">
          <strong>Банк</strong>
          <span>{textValue(details?.bankName)}</span>
        </div>
        <div className="detail-card">
          <strong>БИК</strong>
          <span>{textValue(details?.bankBik)}</span>
        </div>
        <div className="detail-card">
          <strong>Город банка</strong>
          <span>{textValue(details?.bankCity)}</span>
        </div>
        <div className="detail-card">
          <strong>Расчетный счет</strong>
          <span>{textValue(details?.bankAccount)}</span>
        </div>
        <div className="detail-card">
          <strong>Лицевой счет</strong>
          <span>{textValue(details?.personalAccount)}</span>
        </div>
        <div className="detail-card">
          <strong>Корр. счет</strong>
          <span>{textValue(details?.bankCorrespondentAccount)}</span>
        </div>
        <div className="detail-card">
          <strong>Соглашение с ПФР</strong>
          <span>{textValue(details?.pfrAgreementNumber)}</span>
        </div>
        <div className="detail-card">
          <strong>Дата соглашения</strong>
          <span>{formatDateTime(details?.pfrAgreementDateUtc) || EMPTY_VALUE}</span>
        </div>
      </div>
      <div className="detail-list">
        <div>
          <strong>Комментарий ЭЦП</strong>
          <div className="field-hint">{textValue(details?.ecpComment)}</div>
        </div>
        <div>
          <strong>Комментарий ЭЦП в договор</strong>
          <div className="field-hint">{textValue(details?.ecpContractComment)}</div>
        </div>
      </div>
    </div>
  );
}
