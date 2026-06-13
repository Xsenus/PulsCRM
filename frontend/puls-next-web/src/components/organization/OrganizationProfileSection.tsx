import React from 'react';
import type {
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationUpsertRequest
} from '../../app/types';
import { OrganizationEditorForm } from '../OrganizationEditorForm';
import { OrganizationDirectorDetails } from './OrganizationDirectorDetails';
import { OrganizationLegacyNotes } from './OrganizationLegacyNotes';

interface OrganizationProfileSectionProps {
  details: OrganizationDetailsDto | null;
  draft: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  disabled: boolean;
  onDraftChange: (next: OrganizationUpsertRequest) => void;
}

export function OrganizationProfileSection({
  details,
  draft,
  lookups,
  disabled,
  onDraftChange
}: OrganizationProfileSectionProps) {
  return (
    <>
      <OrganizationEditorForm value={draft} lookups={lookups} section="main" disabled={disabled} onChange={onDraftChange} />
      <OrganizationEditorForm value={draft} lookups={lookups} section="contacts" disabled={disabled} onChange={onDraftChange} />

      <OrganizationDirectorDetails details={details} />

      <OrganizationLegacyNotes details={details} />
    </>
  );
}
