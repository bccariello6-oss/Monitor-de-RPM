
import { GroupData, TransmissionParams } from './types';

export const DEFAULT_PARAMS: TransmissionParams = {
  rodete: 482,
  engrenagemSecador: 1120,
  soprador: 350,
  cilindroGuia: 352
};

// Machine Drawing Reference Image
export const MACHINE_DRAWING_URL = '/default_drawing.pdf';

export const GROUPS: GroupData[] = [
  {
    id: 'group-2',
    name: 'SEGUNDO GRUPO',
    components: [
      { id: '06-CG-021', type: 'CG' },
      { id: '06-CG-022', type: 'CG' },
      { id: '06-CG-023', type: 'CG' },
      { id: '06-CG-024', type: 'CG' },
      { id: '06-SEC-001', type: 'SEC' },
      { id: '06-SEC-002', type: 'SEC' },
      { id: '06-RSO-001', type: 'RSO' },
      { id: '06-RSO-002', type: 'RSO' }
    ]
  },
  {
    id: 'group-3',
    name: 'TERCEIRO GRUPO',
    components: [
      { id: '06-CG-025', type: 'CG' },
      { id: '06-CG-026', type: 'CG' },
      { id: '06-CG-027', type: 'CG' },
      { id: '06-CG-028', type: 'CG' },
      { id: '06-CG-029', type: 'CG' },
      { id: '06-CG-044', type: 'CG' },
      { id: '06-CG-045', type: 'CG' },
      { id: '06-CG-046', type: 'CG' },
      { id: '06-CG-048', type: 'CG' },
      { id: '06-SEC-003', type: 'SEC' },
      { id: '06-SEC-004', type: 'SEC' },
      { id: '06-SEC-005', type: 'SEC' },
      { id: '06-SEC-006', type: 'SEC' },
      { id: '06-RSO-003', type: 'RSO' },
      { id: '06-RSO-004', type: 'RSO' },
      { id: '06-RSO-005', type: 'RSO' },
      { id: '06-RSO-006', type: 'RSO' }
    ]
  },
  {
    id: 'group-4',
    name: 'QUARTO GRUPO',
    components: [
      { id: '06-CG-029', type: 'CG' },
      { id: '06-CG-030', type: 'CG' },
      { id: '06-CG-031', type: 'CG' },
      { id: '06-CG-032', type: 'CG' },
      { id: '06-CG-049', type: 'CG' },
      { id: '06-CG-050', type: 'CG' },
      { id: '06-CG-051', type: 'CG' },
      { id: '06-CG-053', type: 'CG' },
      { id: '06-SEC-007', type: 'SEC' },
      { id: '06-SEC-008', type: 'SEC' },
      { id: '06-SEC-009', type: 'SEC' },
      { id: '06-SEC-010', type: 'SEC' },
      { id: '06-RSO-007', type: 'RSO' },
      { id: '06-RSO-008', type: 'RSO' },
      { id: '06-RSO-009', type: 'RSO' },
      { id: '06-RSO-010', type: 'RSO' }
    ]
  },
  {
    id: 'group-5',
    name: 'QUINTO GRUPO',
    components: [
      { id: '06-CG-033', type: 'CG' },
      { id: '06-CG-034', type: 'CG' },
      { id: '06-CG-035', type: 'CG' },
      { id: '06-CG-036', type: 'CG' },
      { id: '06-CG-054', type: 'CG' },
      { id: '06-CG-055', type: 'CG' },
      { id: '06-CG-056', type: 'CG' },
      { id: '06-CG-058', type: 'CG' },
      { id: '06-SEC-011', type: 'SEC' },
      { id: '06-SEC-012', type: 'SEC' },
      { id: '06-SEC-013', type: 'SEC' },
      { id: '06-SEC-014', type: 'SEC' },
      { id: '06-RSO-011', type: 'RSO' },
      { id: '06-RSO-012', type: 'RSO' },
      { id: '06-RSO-013', type: 'RSO' },
      { id: '06-RSO-014', type: 'RSO' }
    ]
  },
  {
    id: 'group-6',
    name: 'SEXTO GRUPO',
    components: [
      { id: '06-SEC-015', type: 'SEC' }
    ]
  },
  {
    id: 'group-7',
    name: 'SÉTIMO GRUPO',
    components: [
      { id: '06-CG-037', type: 'CG' },
      { id: '06-CG-038', type: 'CG' },
      { id: '06-CG-039', type: 'CG' },
      { id: '06-CG-039A', type: 'CG' },
      { id: '06-SEC-016', type: 'SEC' },
      { id: '06-RSO-016', type: 'RSO' }
    ]
  },
  {
    id: 'group-8',
    name: 'OITAVO GRUPO',
    components: [
      { id: '06-CG-040', type: 'CG' },
      { id: '06-CG-041', type: 'CG' },
      { id: '06-CG-042', type: 'CG' },
      { id: '06-CG-043', type: 'CG' },
      { id: '06-CG-059', type: 'CG' },
      { id: '06-CG-060', type: 'CG' },
      { id: '06-CG-061', type: 'CG' },
      { id: '06-CG-063', type: 'CG' },
      { id: '06-SEC-017', type: 'SEC' },
      { id: '06-SEC-018', type: 'SEC' },
      { id: '06-SEC-019', type: 'SEC' },
      { id: '06-SEC-020', type: 'SEC' },
      { id: '06-RSO-017', type: 'RSO' },
      { id: '06-RSO-018', type: 'RSO' },
      { id: '06-RSO-019', type: 'RSO' },
      { id: '06-RSO-020', type: 'RSO' }
    ]
  },
  {
    id: 'group-9',
    name: 'NONO GRUPO',
    components: [
      { id: '06-CG-064', type: 'CG' },
      { id: '06-CG-065', type: 'CG' },
      { id: '06-CG-066', type: 'CG' },
      { id: '06-CG-067', type: 'CG' },
      { id: '06-SEC-021', type: 'SEC' }
    ]
  }
];
