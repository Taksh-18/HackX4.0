import type {
  Incident,
  Report,
  MediaItem,
  IndependentSource,
  TimelineEvent,
} from './types';

// ─── Shared media items ───────────────────────────────────────────────────────

const floodMedia: MediaItem[] = [
  {
    id: 'media-f1',
    type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Flooding_in_Iowa_caused_by_the_2008_Midwest_floods.jpg/800px-Flooding_in_Iowa_caused_by_the_2008_Midwest_floods.jpg',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Flooding_in_Iowa_caused_by_the_2008_Midwest_floods.jpg/400px-Flooding_in_Iowa_caused_by_the_2008_Midwest_floods.jpg',
    isRecycled: false,
    timestamp: '2026-09-11T08:15:00Z',
  },
  {
    id: 'media-f2',
    type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Luzern-Hochwasser.jpg/800px-Luzern-Hochwasser.jpg',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Luzern-Hochwasser.jpg/400px-Luzern-Hochwasser.jpg',
    isRecycled: false,
    timestamp: '2026-09-11T08:22:00Z',
  },
  {
    id: 'media-f3',
    type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Hochwasser_2002_Dresden.jpg/800px-Hochwasser_2002_Dresden.jpg',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Hochwasser_2002_Dresden.jpg/400px-Hochwasser_2002_Dresden.jpg',
    isRecycled: false,
    timestamp: '2026-09-11T08:35:00Z',
  },
];

const fireMedia: MediaItem[] = [
  {
    id: 'media-b1',
    type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Building_on_fire.jpg/800px-Building_on_fire.jpg',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Building_on_fire.jpg/400px-Building_on_fire.jpg',
    isRecycled: false,
    timestamp: '2026-09-11T09:05:00Z',
  },
];

const recycledMedia: MediaItem[] = [
  {
    id: 'media-r1',
    type: 'image',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Earthquake_damaged_building_in_Port-au-Prince02.jpg/800px-Earthquake_damaged_building_in_Port-au-Prince02.jpg',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Earthquake_damaged_building_in_Port-au-Prince02.jpg/400px-Earthquake_damaged_building_in_Port-au-Prince02.jpg',
    isRecycled: true,
    recycledNote: 'Image appears to match imagery published in 2010 — potential recycled/historical media.',
    timestamp: '2026-09-11T11:00:00Z',
  },
];

// ─── Shared independent sources ───────────────────────────────────────────────

const floodSources: IndependentSource[] = [
  {
    id: 'src-f1',
    type: 'news',
    name: 'City Herald',
    verified: true,
    url: '#',
    timestamp: '2026-09-11T08:45:00Z',
  },
  {
    id: 'src-f2',
    type: 'government',
    name: 'Municipal Flood Authority',
    verified: true,
    url: '#',
    timestamp: '2026-09-11T08:55:00Z',
  },
  {
    id: 'src-f3',
    type: 'social_media',
    name: '@centraldistrict_live',
    verified: false,
    timestamp: '2026-09-11T08:18:00Z',
  },
];

// ─── Timelines ────────────────────────────────────────────────────────────────

const floodTimeline: TimelineEvent[] = [
  {
    id: 't1',
    timestamp: '2026-09-11T08:15:00Z',
    title: 'Initial citizen report received',
    type: 'report',
  },
  {
    id: 't2',
    timestamp: '2026-09-11T08:18:00Z',
    title: 'Additional report clustered with incident',
    description: '2 reports now associated',
    type: 'cluster',
  },
  {
    id: 't3',
    timestamp: '2026-09-11T08:21:00Z',
    title: 'Media analysis completed',
    description: '3 unique images confirmed',
    type: 'media',
  },
  {
    id: 't4',
    timestamp: '2026-09-11T08:24:00Z',
    title: 'Independent source detected',
    description: 'City Herald reporting on flooding',
    type: 'source',
  },
  {
    id: 't5',
    timestamp: '2026-09-11T08:31:00Z',
    title: 'Government agency corroboration',
    description: 'Municipal Flood Authority issued flood advisory',
    type: 'source',
  },
  {
    id: 't6',
    timestamp: '2026-09-11T08:37:00Z',
    title: 'Incident corroborated',
    description: 'Confidence threshold exceeded — 91%',
    type: 'verification',
  },
  {
    id: 't7',
    timestamp: '2026-09-11T08:52:00Z',
    title: '5 additional citizen reports received',
    description: '8 total reports now clustered',
    type: 'cluster',
  },
  {
    id: 't8',
    timestamp: '2026-09-11T09:10:00Z',
    title: 'Responder acknowledged',
    description: 'Unit Alpha acknowledged incident',
    type: 'responder',
  },
];

const fireTimeline: TimelineEvent[] = [
  {
    id: 'tf1',
    timestamp: '2026-09-11T09:04:00Z',
    title: 'Initial fire report received',
    type: 'report',
  },
  {
    id: 'tf2',
    timestamp: '2026-09-11T09:08:00Z',
    title: 'Second report clustered',
    type: 'cluster',
  },
  {
    id: 'tf3',
    timestamp: '2026-09-11T09:11:00Z',
    title: 'Image analysis — fire confirmed',
    type: 'media',
  },
  {
    id: 'tf4',
    timestamp: '2026-09-11T09:19:00Z',
    title: 'Incident developing — awaiting corroboration',
    type: 'verification',
  },
  {
    id: 'tf5',
    timestamp: '2026-09-11T09:31:00Z',
    title: 'Fire department dispatched',
    type: 'responder',
  },
];

const accidentTimeline: TimelineEvent[] = [
  {
    id: 'ta1',
    timestamp: '2026-09-11T10:22:00Z',
    title: 'Road accident report received',
    type: 'report',
  },
  {
    id: 'ta2',
    timestamp: '2026-09-11T10:26:00Z',
    title: 'Second report clustered',
    type: 'cluster',
  },
  {
    id: 'ta3',
    timestamp: '2026-09-11T10:35:00Z',
    title: 'Traffic camera footage analysed',
    type: 'media',
  },
  {
    id: 'ta4',
    timestamp: '2026-09-11T10:41:00Z',
    title: 'Incident corroborated',
    type: 'verification',
  },
];

const recycledTimeline: TimelineEvent[] = [
  {
    id: 'tr1',
    timestamp: '2026-09-11T11:00:00Z',
    title: 'Report received — building collapse claimed',
    type: 'report',
  },
  {
    id: 'tr2',
    timestamp: '2026-09-11T11:03:00Z',
    title: 'Media analysis initiated',
    type: 'media',
  },
  {
    id: 'tr3',
    timestamp: '2026-09-11T11:07:00Z',
    title: 'Potential recycled media detected',
    description: 'Image matches content from 2010 — flagged for review',
    type: 'media',
  },
  {
    id: 'tr4',
    timestamp: '2026-09-11T11:14:00Z',
    title: 'No corroborating sources found',
    type: 'verification',
  },
  {
    id: 'tr5',
    timestamp: '2026-09-11T11:18:00Z',
    title: 'Incident marked contradicted',
    description: 'No independent verification; recycled media detected',
    type: 'verification',
  },
];

// ─── Reports ──────────────────────────────────────────────────────────────────

export const allReports: Report[] = [
  // Flood reports
  {
    id: 'rep-001',
    incidentId: 'inc-001',
    authorId: 'user-current',
    isCurrentUser: true,
    type: 'flood',
    title: 'Major flooding on Central Avenue',
    description: 'Water level is waist-high near the Central District intersection. Cars are submerged. People are stranded on rooftops.',
    location: { lat: 28.6129, lng: 77.2295 },
    locationName: 'Central Avenue, Central District',
    media: [floodMedia[0]],
    timestamp: '2026-09-11T08:15:00Z',
    status: 'corroborated',
    distance: 50,
    sourceType: 'citizen',
  },
  {
    id: 'rep-002',
    incidentId: 'inc-001',
    authorId: 'user-002',
    type: 'flood',
    title: 'Flooding blocking Nehru Road',
    description: 'Road completely flooded, vehicles stuck. I can see at least 5 families on balconies.',
    location: { lat: 28.6134, lng: 77.2302 },
    locationName: 'Nehru Road, Central District',
    media: [floodMedia[1]],
    timestamp: '2026-09-11T08:18:00Z',
    status: 'corroborated',
    distance: 80,
    sourceType: 'citizen',
  },
  {
    id: 'rep-003',
    incidentId: 'inc-001',
    authorId: 'user-003',
    type: 'flood',
    title: 'Water rising fast near market',
    description: 'The drainage is overflowing. About 12 people trapped in the market building.',
    location: { lat: 28.6120, lng: 77.2288 },
    locationName: 'Market Street, Central District',
    media: [floodMedia[2]],
    timestamp: '2026-09-11T08:22:00Z',
    status: 'corroborated',
    distance: 120,
    sourceType: 'citizen',
  },
  {
    id: 'rep-004',
    incidentId: 'inc-001',
    authorId: 'user-004',
    type: 'flood',
    title: 'Flooding — Central District residential area',
    description: 'Ground floor completely submerged. My family is on the first floor waiting for rescue.',
    location: { lat: 28.6139, lng: 77.2310 },
    locationName: 'Residential Block 4, Central District',
    media: [],
    timestamp: '2026-09-11T08:35:00Z',
    status: 'corroborated',
    distance: 200,
    sourceType: 'citizen',
  },
  {
    id: 'rep-005',
    incidentId: 'inc-001',
    authorId: 'user-005',
    type: 'flood',
    title: 'Road impassable',
    description: 'Can\'t get through. Turned back. Very serious flooding.',
    location: { lat: 28.6115, lng: 77.2275 },
    locationName: 'Main Road, Central District',
    media: [],
    timestamp: '2026-09-11T08:52:00Z',
    status: 'corroborated',
    distance: 350,
    sourceType: 'citizen',
  },
  {
    id: 'rep-006',
    incidentId: 'inc-001',
    authorId: 'user-006',
    type: 'flood',
    title: 'Flooding update — level rising',
    description: 'Water has risen another 30cm in the last hour.',
    location: { lat: 28.6128, lng: 77.2293 },
    locationName: 'Central District',
    media: [],
    timestamp: '2026-09-11T09:05:00Z',
    status: 'corroborated',
    distance: 60,
    sourceType: 'citizen',
  },
  {
    id: 'rep-007',
    incidentId: 'inc-001',
    authorId: 'user-007',
    type: 'flood',
    title: 'Duplicate — same incident',
    description: 'Flooding near central market',
    location: { lat: 28.6131, lng: 77.2298 },
    locationName: 'Central District',
    media: [],
    timestamp: '2026-09-11T09:15:00Z',
    status: 'corroborated',
    distance: 40,
    sourceType: 'citizen',
    isDuplicate: true,
  },
  {
    id: 'rep-008',
    incidentId: 'inc-001',
    authorId: 'user-008',
    type: 'flood',
    title: 'Major flood — people need help',
    description: 'Elderly residents stranded, water still rising.',
    location: { lat: 28.6122, lng: 77.2280 },
    locationName: 'Central District',
    media: [],
    timestamp: '2026-09-11T09:28:00Z',
    status: 'corroborated',
    distance: 150,
    sourceType: 'citizen',
  },
  // Fire reports
  {
    id: 'rep-009',
    incidentId: 'inc-002',
    authorId: 'user-009',
    isCurrentUser: false,
    type: 'fire',
    title: 'Building fire on Riverfront Road',
    description: 'Large commercial building is on fire. Smoke visible from 2km away.',
    location: { lat: 28.6180, lng: 77.2350 },
    locationName: 'Riverfront Road, Riverfront',
    media: [fireMedia[0]],
    timestamp: '2026-09-11T09:04:00Z',
    status: 'developing',
    distance: 80,
    sourceType: 'citizen',
  },
  {
    id: 'rep-010',
    incidentId: 'inc-002',
    authorId: 'user-010',
    type: 'fire',
    title: 'Fire spreading — Riverfront',
    description: 'Flames visible from multiple floors. No fire trucks arrived yet.',
    location: { lat: 28.6185, lng: 77.2358 },
    locationName: 'Riverfront Road',
    media: [],
    timestamp: '2026-09-11T09:08:00Z',
    status: 'developing',
    distance: 120,
    sourceType: 'citizen',
  },
  // Accident reports
  {
    id: 'rep-011',
    incidentId: 'inc-003',
    authorId: 'user-current',
    isCurrentUser: true,
    type: 'accident',
    title: 'Multi-vehicle accident Highway 7',
    description: 'At least 3 vehicles involved. Someone appears injured.',
    location: { lat: 28.6060, lng: 77.2180 },
    locationName: 'Highway 7, Outskirts',
    media: [],
    timestamp: '2026-09-11T10:22:00Z',
    status: 'corroborated',
    distance: 30,
    sourceType: 'citizen',
  },
  // Recycled media report
  {
    id: 'rep-012',
    incidentId: 'inc-007',
    authorId: 'user-012',
    type: 'structural',
    title: 'Building collapse — East Market',
    description: 'Large building has collapsed. Many people trapped.',
    location: { lat: 28.6220, lng: 77.2420 },
    locationName: 'East Market',
    media: recycledMedia,
    timestamp: '2026-09-11T11:00:00Z',
    status: 'contradicted',
    distance: 20,
    sourceType: 'citizen',
  },
];

// ─── Incidents ────────────────────────────────────────────────────────────────

export const incidents: Incident[] = [
  // ── 1. MAJOR FLOODING (SHOWCASE) ───────────────────────────────────────────
  {
    id: 'inc-001',
    title: 'Major Flooding — Central District',
    type: 'flood',
    severity: 'critical',
    verificationState: 'corroborated',
    actionPriority: 'critical_dispatch',
    responderState: 'acknowledged',
    confidence: {
      overall: 91,
      sources: 95,
      geolocation: 88,
      media: 90,
      externalVerification: 92,
      contradictionPenalty: 0,
    },
    location: { lat: 28.6129, lng: 77.2295 },
    locationName: 'Central District',
    affectedRadius: 800,
    uncertaintyRadius: 150,
    reportCount: 8,
    independentSourceCount: 3,
    uniqueImageCount: 3,
    reports: allReports.filter(r => r.incidentId === 'inc-001'),
    independentSources: floodSources,
    media: floodMedia,
    timeline: floodTimeline,
    aggregatedNeeds: {
      peopleTrapped: 12,
      medicalAssistance: true,
      evacuation: true,
      rescueEquipment: true,
    },
    summary:
      'Severe flooding in the Central District area. Water levels are reported to be waist-high on Central Avenue and surrounding streets. Multiple reports confirm road blockages and residents stranded.',
    responderNotes:
      'High-confidence corroborated incident. Municipal Flood Authority has issued advisory. Consider requesting additional rescue boats.',
    createdAt: '2026-09-11T08:15:00Z',
    updatedAt: '2026-09-11T09:28:00Z',
    safetyInfo:
      'Avoid Central District. Do not attempt to drive through flooded roads. If you are in the area, move to higher ground immediately.',
    affectedArea: 'Central Avenue, Nehru Road, Market Street, Residential Block 4',
    hasRecycledMedia: false,
    hasContradictions: false,
  },

  // ── 2. BUILDING FIRE ───────────────────────────────────────────────────────
  {
    id: 'inc-002',
    title: 'Commercial Building Fire — Riverfront',
    type: 'fire',
    severity: 'high',
    verificationState: 'developing',
    actionPriority: 'deploy_scout',
    responderState: 'dispatched',
    confidence: {
      overall: 74,
      sources: 72,
      geolocation: 80,
      media: 75,
      externalVerification: 60,
      contradictionPenalty: 0,
    },
    location: { lat: 28.6182, lng: 77.2354 },
    locationName: 'Riverfront Road, Riverfront',
    affectedRadius: 350,
    uncertaintyRadius: 100,
    reportCount: 2,
    independentSourceCount: 1,
    uniqueImageCount: 1,
    reports: allReports.filter(r => r.incidentId === 'inc-002'),
    independentSources: [
      {
        id: 'src-b1',
        type: 'social_media',
        name: '@riverfront_local',
        verified: false,
        timestamp: '2026-09-11T09:12:00Z',
      },
    ],
    media: fireMedia,
    timeline: fireTimeline,
    summary:
      'Reports of a large fire at a commercial building on Riverfront Road. Smoke visible from several kilometres. Emergency services are en route.',
    responderNotes: 'Scout deployed. Awaiting visual confirmation.',
    createdAt: '2026-09-11T09:04:00Z',
    updatedAt: '2026-09-11T09:31:00Z',
    safetyInfo: 'Avoid Riverfront Road area. Emergency services are responding.',
    affectedArea: 'Riverfront Road',
    hasRecycledMedia: false,
    hasContradictions: false,
  },

  // ── 3. ROAD ACCIDENT ───────────────────────────────────────────────────────
  {
    id: 'inc-003',
    title: 'Multi-Vehicle Accident — Highway 7',
    type: 'accident',
    severity: 'moderate',
    verificationState: 'corroborated',
    actionPriority: 'critical_dispatch',
    responderState: 'dispatched',
    confidence: {
      overall: 83,
      sources: 80,
      geolocation: 92,
      media: 70,
      externalVerification: 78,
      contradictionPenalty: 0,
    },
    location: { lat: 28.6060, lng: 77.2180 },
    locationName: 'Highway 7, Northern Outskirts',
    affectedRadius: 200,
    uncertaintyRadius: 80,
    reportCount: 3,
    independentSourceCount: 2,
    uniqueImageCount: 1,
    reports: allReports.filter(r => r.incidentId === 'inc-003'),
    independentSources: [
      {
        id: 'src-a1',
        type: 'government',
        name: 'Traffic Management Centre',
        verified: true,
        timestamp: '2026-09-11T10:30:00Z',
      },
      {
        id: 'src-a2',
        type: 'news',
        name: 'Metro Traffic Update',
        verified: true,
        timestamp: '2026-09-11T10:38:00Z',
      },
    ],
    media: [],
    timeline: accidentTimeline,
    aggregatedNeeds: {
      injuredCount: 2,
      medicalAssistance: true,
    },
    summary:
      'A multi-vehicle accident on Highway 7 is blocking traffic. At least two people are reported injured.',
    responderNotes: 'Ambulance dispatched. Traffic police en route.',
    createdAt: '2026-09-11T10:22:00Z',
    updatedAt: '2026-09-11T10:41:00Z',
    safetyInfo: 'Expect significant delays on Highway 7. Use alternate routes.',
    affectedArea: 'Highway 7 km 34–36',
    hasRecycledMedia: false,
    hasContradictions: false,
  },

  // ── 4. STRUCTURAL COLLAPSE ─────────────────────────────────────────────────
  {
    id: 'inc-004',
    title: 'Partial Structural Collapse — Old Quarter',
    type: 'structural',
    severity: 'high',
    verificationState: 'developing',
    actionPriority: 'deploy_scout',
    responderState: 'acknowledged',
    confidence: {
      overall: 65,
      sources: 60,
      geolocation: 75,
      media: 55,
      externalVerification: 50,
      contradictionPenalty: 0,
    },
    location: { lat: 28.6095, lng: 77.2410 },
    locationName: 'Old Quarter',
    affectedRadius: 300,
    uncertaintyRadius: 200,
    reportCount: 2,
    independentSourceCount: 1,
    uniqueImageCount: 1,
    reports: [],
    independentSources: [
      {
        id: 'src-s1',
        type: 'social_media',
        name: '@oldquarter_watch',
        verified: false,
        timestamp: '2026-09-11T11:30:00Z',
      },
    ],
    media: [],
    timeline: [
      {
        id: 'ts1',
        timestamp: '2026-09-11T11:25:00Z',
        title: 'Report received — partial collapse',
        type: 'report',
      },
      {
        id: 'ts2',
        timestamp: '2026-09-11T11:29:00Z',
        title: 'Second report clustered',
        type: 'cluster',
      },
      {
        id: 'ts3',
        timestamp: '2026-09-11T11:40:00Z',
        title: 'Awaiting media verification',
        type: 'media',
      },
    ],
    summary:
      'Reports of a partial building collapse in the Old Quarter. Extent of damage is unclear. Evidence is still developing.',
    responderNotes: 'Low image evidence. Scout deploying for visual assessment.',
    createdAt: '2026-09-11T11:25:00Z',
    updatedAt: '2026-09-11T11:40:00Z',
    safetyInfo: 'Keep clear of the Old Quarter area near Heritage Street.',
    affectedArea: 'Heritage Street, Old Quarter',
    hasRecycledMedia: false,
    hasContradictions: false,
  },

  // ── 5. DEVELOPING LANDSLIDE ────────────────────────────────────────────────
  {
    id: 'inc-005',
    title: 'Landslide Risk — Northern Hills',
    type: 'landslide',
    severity: 'moderate',
    verificationState: 'developing',
    actionPriority: 'monitor',
    responderState: 'unacknowledged',
    confidence: {
      overall: 52,
      sources: 45,
      geolocation: 65,
      media: 40,
      externalVerification: 48,
      contradictionPenalty: 0,
    },
    location: { lat: 28.6280, lng: 77.2150 },
    locationName: 'Northern Hills Road',
    affectedRadius: 500,
    uncertaintyRadius: 300,
    reportCount: 1,
    independentSourceCount: 0,
    uniqueImageCount: 0,
    reports: [],
    independentSources: [],
    media: [],
    timeline: [
      {
        id: 'tl1',
        timestamp: '2026-09-11T12:05:00Z',
        title: 'Single landslide risk report received',
        type: 'report',
      },
      {
        id: 'tl2',
        timestamp: '2026-09-11T12:10:00Z',
        title: 'Geolocation analysis complete',
        type: 'media',
      },
    ],
    summary:
      'A single report of potential landslide activity on Northern Hills Road. Heavy rainfall in the past 48 hours increases plausibility. Currently monitoring.',
    responderNotes: 'Single source. Rain gauge data supports plausibility but no corroboration yet.',
    createdAt: '2026-09-11T12:05:00Z',
    updatedAt: '2026-09-11T12:10:00Z',
    safetyInfo: 'Exercise caution on Northern Hills Road due to recent heavy rainfall.',
    affectedArea: 'Northern Hills Road',
    hasRecycledMedia: false,
    hasContradictions: false,
  },

  // ── 6. FALSE / CONTRADICTED REPORT ────────────────────────────────────────
  {
    id: 'inc-006',
    title: 'Reported Explosion — Harbor District',
    type: 'other',
    severity: 'low',
    verificationState: 'contradicted',
    actionPriority: 'suppressed',
    responderState: 'resolved',
    confidence: {
      overall: 18,
      sources: 15,
      geolocation: 30,
      media: 0,
      externalVerification: 5,
      contradictionPenalty: 35,
    },
    location: { lat: 28.6050, lng: 77.2480 },
    locationName: 'Harbor District',
    affectedRadius: 100,
    uncertaintyRadius: 400,
    reportCount: 1,
    independentSourceCount: 0,
    uniqueImageCount: 0,
    reports: [],
    independentSources: [],
    media: [],
    timeline: [
      {
        id: 'th1',
        timestamp: '2026-09-11T10:45:00Z',
        title: 'Report received — explosion claimed',
        type: 'report',
      },
      {
        id: 'th2',
        timestamp: '2026-09-11T10:52:00Z',
        title: 'No corroborating reports or sources found',
        type: 'verification',
      },
      {
        id: 'th3',
        timestamp: '2026-09-11T11:05:00Z',
        title: 'Harbor Authority confirmed no incident',
        description: 'Official source directly contradicts report',
        type: 'verification',
      },
      {
        id: 'th4',
        timestamp: '2026-09-11T11:08:00Z',
        title: 'Incident marked as contradicted',
        type: 'verification',
      },
    ],
    summary: 'Report of an explosion in the Harbor District. Official Harbor Authority has confirmed no incident occurred. Likely a misinterpretation.',
    responderNotes: 'Directly contradicted by Harbor Authority. Suppressed.',
    contradictionNote: 'Harbor Authority confirmed no incident. No corroborating evidence found. Report likely based on noise from ship operations.',
    createdAt: '2026-09-11T10:45:00Z',
    updatedAt: '2026-09-11T11:08:00Z',
    resolvedAt: '2026-09-11T11:08:00Z',
    hasRecycledMedia: false,
    hasContradictions: true,
  },

  // ── 7. RECYCLED HISTORICAL IMAGE ──────────────────────────────────────────
  {
    id: 'inc-007',
    title: 'Reported Building Collapse — East Market',
    type: 'structural',
    severity: 'low',
    verificationState: 'contradicted',
    actionPriority: 'suppressed',
    responderState: 'unacknowledged',
    confidence: {
      overall: 22,
      sources: 20,
      geolocation: 35,
      media: 5,
      externalVerification: 10,
      contradictionPenalty: 30,
    },
    location: { lat: 28.6220, lng: 77.2420 },
    locationName: 'East Market',
    affectedRadius: 150,
    uncertaintyRadius: 350,
    reportCount: 1,
    independentSourceCount: 0,
    uniqueImageCount: 0,
    reports: allReports.filter(r => r.incidentId === 'inc-007'),
    independentSources: [],
    media: recycledMedia,
    timeline: recycledTimeline,
    summary: 'A report of a building collapse in East Market with an attached image. Media analysis has detected that the image appears to be historical/recycled content.',
    responderNotes: 'Image reverse-matched to 2010 Haiti earthquake imagery. No corroborating local sources. Suppressed.',
    contradictionNote: 'Submitted image matches content published in 2010. No independent sources or additional reports confirm a collapse in this area.',
    createdAt: '2026-09-11T11:00:00Z',
    updatedAt: '2026-09-11T11:18:00Z',
    hasRecycledMedia: true,
    hasContradictions: true,
  },

  // ── 8. RESOLVED INCIDENT ──────────────────────────────────────────────────
  {
    id: 'inc-008',
    title: 'Gas Leak — Midtown Commercial Zone',
    type: 'other',
    severity: 'moderate',
    verificationState: 'corroborated',
    actionPriority: 'monitor',
    responderState: 'resolved',
    confidence: {
      overall: 88,
      sources: 90,
      geolocation: 85,
      media: 80,
      externalVerification: 88,
      contradictionPenalty: 0,
    },
    location: { lat: 28.6155, lng: 77.2230 },
    locationName: 'Midtown Commercial Zone',
    affectedRadius: 250,
    uncertaintyRadius: 60,
    reportCount: 4,
    independentSourceCount: 2,
    uniqueImageCount: 2,
    reports: [],
    independentSources: [
      {
        id: 'src-g1',
        type: 'government',
        name: 'City Gas Authority',
        verified: true,
        timestamp: '2026-09-11T07:15:00Z',
      },
      {
        id: 'src-g2',
        type: 'news',
        name: 'Evening Standard',
        verified: true,
        timestamp: '2026-09-11T07:30:00Z',
      },
    ],
    media: [],
    timeline: [
      {
        id: 'tg1',
        timestamp: '2026-09-11T06:45:00Z',
        title: 'Gas leak reported',
        type: 'report',
      },
      {
        id: 'tg2',
        timestamp: '2026-09-11T06:55:00Z',
        title: 'City Gas Authority confirmed leak',
        type: 'source',
      },
      {
        id: 'tg3',
        timestamp: '2026-09-11T07:10:00Z',
        title: 'Incident corroborated',
        type: 'verification',
      },
      {
        id: 'tg4',
        timestamp: '2026-09-11T07:35:00Z',
        title: 'Emergency crews on site',
        type: 'responder',
      },
      {
        id: 'tg5',
        timestamp: '2026-09-11T08:50:00Z',
        title: 'Leak contained — area cleared',
        type: 'update',
      },
      {
        id: 'tg6',
        timestamp: '2026-09-11T09:00:00Z',
        title: 'Incident resolved',
        type: 'responder',
      },
    ],
    summary: 'A gas leak in the Midtown Commercial Zone was reported, confirmed by City Gas Authority, and successfully contained by emergency crews.',
    responderNotes: 'Resolved. All clear issued. No casualties.',
    createdAt: '2026-09-11T06:45:00Z',
    updatedAt: '2026-09-11T09:00:00Z',
    resolvedAt: '2026-09-11T09:00:00Z',
    hasRecycledMedia: false,
    hasContradictions: false,
  },
];

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function getIncidentById(id: string): Incident | undefined {
  return incidents.find(i => i.id === id);
}

export function getIncidentsByType(type: Incident['type']): Incident[] {
  return incidents.filter(i => i.type === type);
}

export function getNearbyIncidents(limit = 5): Incident[] {
  return incidents
    .filter(i => i.responderState !== 'resolved')
    .slice(0, limit);
}

export const dashboardMetrics = {
  get critical() {
    return incidents.filter(i => i.severity === 'critical' && i.responderState !== 'resolved').length;
  },
  get active() {
    return incidents.filter(i =>
      ['unacknowledged', 'acknowledged', 'dispatched'].includes(i.responderState)
    ).length;
  },
  get developing() {
    return incidents.filter(i => i.verificationState === 'developing').length;
  },
  get resolved() {
    return incidents.filter(i => i.responderState === 'resolved').length;
  },
};
