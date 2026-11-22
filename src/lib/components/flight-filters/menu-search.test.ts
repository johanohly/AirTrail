import { describe, expect, it } from 'vitest';

import type {
  DisplayNode,
  NodeDef,
} from '$lib/primitives/bits/menu-data/types.js';
import {
  filterNodes,
  matchesWordPrefix,
} from '$lib/primitives/bits/menu-data/utils.js';

const option = (label: string, keywords: string[] = []): NodeDef => ({
  kind: 'checkbox-item',
  id: label,
  label,
  keywords,
});

const filter = (title: string, options: NodeDef[]): NodeDef => ({
  kind: 'submenu',
  id: title,
  title,
  nodes: options,
});

// Shaped like the filter menu: groups of filters, each holding its options.
const menu: NodeDef[] = [
  {
    kind: 'group',
    id: 'location',
    label: 'Location',
    nodes: [
      filter('Route', [option('CPH – EWR'), option('BER – CPH')]),
      filter('Departure airport', [
        option('EWR | Newark Liberty Intl.', ['EWR', 'KEWR']),
        option('CPH | Copenhagen Kastrup', ['CPH', 'EKCH']),
      ]),
      filter('Arrival country', [option('Finland', ['FI'])]),
    ],
  },
  { kind: 'separator', id: 'location-separator' },
  {
    kind: 'group',
    id: 'airline',
    label: 'Airline & aircraft',
    nodes: [
      filter('Airline', [
        option('Air France', ['AF']),
        option('Iberia', ['IB', 'IBE']),
        option('Lufthansa', ['LH', 'DLH']),
        option('Finnair', ['AY', 'FIN']),
      ]),
      filter('Flight number', [option('IB3281')]),
      filter('Tail number', [option('OY-KBO')]),
    ],
  },
  { kind: 'separator', id: 'airline-separator' },
  {
    kind: 'group',
    id: 'seat',
    label: 'Seat',
    nodes: [
      filter('Seat class', [
        option('Economy'),
        option('Economy+'),
        option('Business'),
      ]),
    ],
  },
];

const search = (query: string) =>
  filterNodes({
    query,
    nodes: menu,
    highlightedId: null,
    deepSearch: true,
    sortGroups: false,
    match: 'word-prefix',
  }).displayNodes.map((node: DisplayNode) =>
    'kind' in node && node.kind === 'group'
      ? [
          node.group.label,
          node.items.map(({ node: row, context }) =>
            [
              ...context.breadcrumbs,
              row.kind === 'submenu' ? row.title : row.label,
            ].join(' / '),
          ),
        ]
      : node,
  );

describe('filter menu search', () => {
  it('matches the start of a word, ignoring case and accents', () => {
    expect(matchesWordPrefix('EWR | Newark Liberty Intl.', 'new')).toBe(true);
    expect(matchesWordPrefix('EWR | Newark Liberty Intl.', 'iber')).toBe(false);
    expect(matchesWordPrefix('Malé', 'male')).toBe(true);
    expect(matchesWordPrefix('Flight number', 'fn')).toBe(false);
  });

  it('finds an airline by name without letter-by-letter matches', () => {
    expect(search('iber')).toEqual([
      ['Airline & aircraft', ['Airline / Iberia']],
    ]);
    expect(search('lufth')).toEqual([
      ['Airline & aircraft', ['Airline / Lufthansa']],
    ]);
  });

  it('keeps every hit under its own filter group, in menu order', () => {
    expect(search('cph')).toEqual([
      [
        'Location',
        [
          'Route / CPH – EWR',
          'Route / BER – CPH',
          'Departure airport / CPH | Copenhagen Kastrup',
        ],
      ],
    ]);
    expect(search('fin')).toEqual([
      ['Location', ['Arrival country / Finland']],
      ['Airline & aircraft', ['Airline / Finnair']],
    ]);
    expect(search('economy')).toEqual([
      ['Seat', ['Seat class / Economy', 'Seat class / Economy+']],
    ]);
  });

  it('lists filter names before options within a group', () => {
    expect(search('air')).toEqual([
      ['Location', ['Departure airport']],
      ['Airline & aircraft', ['Airline', 'Airline / Air France']],
    ]);
    expect(search('number')).toEqual([
      ['Airline & aircraft', ['Flight number', 'Tail number']],
    ]);
  });
});
