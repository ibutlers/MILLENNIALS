import { describe, expect, it, vi } from 'vitest';
import {
  buildSubentityPayload,
  subEntitiesToEditorState,
  type SubEntitiesResponse,
} from './useEditorForm';

vi.mock('../assetCatalog', () => ({
  assetUrl: (asset: { id: string }) => `/assets/${asset.id}`,
  getAssetById: () => null,
}));

describe('admin opportunity subentity mapping', () => {
  it('keeps server ids separate from client ids and sends only persisted ids back to the API', () => {
    const serverData: SubEntitiesResponse['data'] = {
      highlights: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'Viviendas', value: '25 unidades', position: 0 }],
      risks: [],
      milestones: [],
      media: [],
    };

    const mapped = subEntitiesToEditorState(serverData);
    expect(mapped.highlights[0]).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: 'Viviendas',
      value: '25 unidades',
      position: 0,
    });
    expect(mapped.highlights[0]._id).toBeTruthy();
    expect(mapped.highlights[0]._id).not.toBe(mapped.highlights[0].id);

    mapped.highlights.push({ _id: 'client-new-row', label: 'Nueva fila', value: 'Nuevo valor', position: 1 });

    const payload = buildSubentityPayload({
      highlights: mapped.highlights,
      risks: mapped.risks,
      milestones: mapped.milestones,
      media: mapped.media,
      version: 7,
    });

    expect(payload).toEqual({
      version: 7,
      highlights: [
        { _id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'Viviendas', value: '25 unidades', position: 0 },
        { label: 'Nueva fila', value: 'Nuevo valor', position: 1 },
      ],
      risks: [],
      milestones: [],
      media: [],
    });
  });
});
