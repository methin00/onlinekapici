import type { PortalAuthSession, PortalSessionUser, PortalState, Profile } from './portal-types';

const now = new Date('2026-03-19T09:45:00.000Z');

function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function hoursAgo(hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysAfter(days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export const portalSeedState: PortalState = {
  sites: [
    {
      id: 'site-atlas',
      name: 'Atlas Yaşam Evleri',
      address: 'Çamlıca Mahallesi Vadi Caddesi No:18',
      district: 'Ümraniye',
      city: 'İstanbul'
    },
    {
      id: 'site-gunes',
      name: 'Güneş Park Konutları',
      address: 'Huzur Sokak No:7',
      district: 'Nilüfer',
      city: 'Bursa'
    }
  ],
  buildings: [
    {
      id: 'building-atlas-a',
      siteId: 'site-atlas',
      name: 'A Blok',
      address: 'Atlas Yaşam Evleri A Blok',
      apiKey: 'atlas-a-01',
      doorLabel: 'A Blok Giriş',
      kioskCode: 'atlas-a'
    },
    {
      id: 'building-atlas-b',
      siteId: 'site-atlas',
      name: 'B Blok',
      address: 'Atlas Yaşam Evleri B Blok',
      apiKey: 'atlas-b-01',
      doorLabel: 'B Blok Giriş',
      kioskCode: 'atlas-b'
    },
    {
      id: 'building-gunes-kuzey',
      siteId: 'site-gunes',
      name: 'Kuzey Blok',
      address: 'Güneş Park Konutları Kuzey Blok',
      apiKey: 'gunes-k-01',
      doorLabel: 'Kuzey Blok Giriş',
      kioskCode: 'gunes-k'
    }
  ],
  units: [
    { id: 'unit-a-12', buildingId: 'building-atlas-a', unitNumber: '12', floor: 3 },
    { id: 'unit-a-18', buildingId: 'building-atlas-a', unitNumber: '18', floor: 4 },
    { id: 'unit-b-05', buildingId: 'building-atlas-b', unitNumber: '5', floor: 1 },
    { id: 'unit-b-22', buildingId: 'building-atlas-b', unitNumber: '22', floor: 6 },
    { id: 'unit-g-09', buildingId: 'building-gunes-kuzey', unitNumber: '9', floor: 2 }
  ],
  profiles: [
    {
      id: 'profile-super',
      fullName: 'Mert Aydın',
      email: 'merkez@onlinekapici.app',
      role: 'super_admin',
      phone: '05320000001',
      title: 'Merkez Yönetim',
      loginId: 'merkez',
      password: '123456',
      siteIds: ['site-atlas', 'site-gunes'],
      buildingIds: ['building-atlas-a', 'building-atlas-b', 'building-gunes-kuzey']
    },
    {
      id: 'profile-consultant',
      fullName: 'Ceren Korkmaz',
      email: 'danisma@onlinekapici.app',
      role: 'consultant',
      phone: '05320000002',
      title: 'Danışma Merkezi',
      loginId: 'danisma',
      password: '123456',
      siteIds: ['site-atlas', 'site-gunes'],
      buildingIds: ['building-atlas-a', 'building-atlas-b', 'building-gunes-kuzey']
    },
    {
      id: 'profile-manager',
      fullName: 'Selin Demir',
      email: 'yonetim.atlas@onlinekapici.app',
      role: 'manager',
      phone: '05320000003',
      title: 'Site Yöneticisi',
      loginId: 'atlasyonetim',
      password: '123456',
      siteIds: ['site-atlas'],
      buildingIds: ['building-atlas-a', 'building-atlas-b']
    },
    {
      id: 'profile-resident-ahmet',
      unitId: 'unit-a-12',
      fullName: 'Ahmet Yılmaz',
      email: 'ahmet.yilmaz@onlinekapici.app',
      role: 'resident',
      phone: '05551234567',
      title: 'Daire Sakini',
      loginId: '05551234567',
      password: '123456',
      siteIds: ['site-atlas'],
      buildingIds: ['building-atlas-a']
    },
    {
      id: 'profile-resident-elif',
      unitId: 'unit-b-05',
      fullName: 'Elif Aksoy',
      email: 'elif.aksoy@onlinekapici.app',
      role: 'resident',
      phone: '05557654321',
      title: 'Daire Sakini',
      loginId: '05557654321',
      password: '123456',
      siteIds: ['site-atlas'],
      buildingIds: ['building-atlas-b']
    },
    {
      id: 'profile-kiosk-atlas-a',
      fullName: 'Atlas A Giriş Terminali',
      email: 'terminal.atlas.a@onlinekapici.app',
      role: 'kiosk_device',
      phone: '00000000000',
      title: 'Giriş Terminali',
      loginId: 'atlas-a',
      password: '123456',
      siteIds: ['site-atlas'],
      buildingIds: ['building-atlas-a']
    }
  ],
  residentPreferences: [
    {
      profileId: 'profile-resident-ahmet',
      awayModeEnabled: true,
      updatedAt: minutesAgo(30)
    },
    {
      profileId: 'profile-resident-elif',
      awayModeEnabled: false,
      updatedAt: hoursAgo(4)
    }
  ],
  managerSiteAssignments: [
    {
      id: 'manager-assignment-atlas',
      profileId: 'profile-manager',
      siteId: 'site-atlas',
      createdAt: daysAgo(45)
    }
  ],
  consultantSiteAssignments: [
    {
      id: 'consultant-assignment-atlas',
      profileId: 'profile-consultant',
      siteId: 'site-atlas',
      createdAt: daysAgo(60)
    },
    {
      id: 'consultant-assignment-gunes',
      profileId: 'profile-consultant',
      siteId: 'site-gunes',
      createdAt: daysAgo(60)
    }
  ],
  guestRequests: [
    {
      id: 'request-1',
      buildingId: 'building-atlas-a',
      unitId: 'unit-a-12',
      guestName: 'Mehmet Kaya',
      type: 'guest',
      status: 'pending',
      createdAt: minutesAgo(2),
      expiresAt: minutesAgo(-1),
      createdByProfileId: 'profile-kiosk-atlas-a'
    },
    {
      id: 'request-2',
      buildingId: 'building-atlas-b',
      unitId: 'unit-b-05',
      guestName: 'Asansor Teknik',
      type: 'service',
      status: 'redirected',
      createdAt: minutesAgo(19),
      expiresAt: minutesAgo(14),
      decidedAt: minutesAgo(14),
      createdByProfileId: 'profile-consultant',
      lastActionBy: 'Danışma Merkezi'
    },
    {
      id: 'request-3',
      buildingId: 'building-gunes-kuzey',
      unitId: 'unit-g-09',
      guestName: 'Bakım Ekibi',
      type: 'service',
      status: 'approved',
      createdAt: hoursAgo(2),
      expiresAt: hoursAgo(2),
      decidedAt: hoursAgo(2),
      lastActionBy: 'Merkez Yönetim'
    }
  ],
  logs: [
    {
      id: 'log-1',
      buildingId: 'building-atlas-a',
      eventDetails: 'A Blok girişinde ziyaretçi kaydı oluşturuldu.',
      timestamp: minutesAgo(2)
    },
    {
      id: 'log-2',
      buildingId: 'building-atlas-b',
      eventDetails: 'Teknik servis çağrısı danışma ekibine yönlendirildi.',
      timestamp: minutesAgo(14)
    },
    {
      id: 'log-3',
      buildingId: 'building-gunes-kuzey',
      eventDetails: 'Kuzey Blok için teknik ekip geçişi onaylandı.',
      timestamp: hoursAgo(2)
    }
  ],
  announcements: [
    {
      id: 'announcement-1',
      siteId: 'site-atlas',
      title: 'Su kesintisi bildirimi',
      summary: 'Yarın 10.00 ile 14.00 arasında planlı su kesintisi uygulanacaktır.',
      category: 'Operasyon',
      publishedAt: hoursAgo(6),
      pinned: true
    },
    {
      id: 'announcement-2',
      siteId: 'site-atlas',
      title: 'Yönetim toplantısı',
      summary: 'Cumartesi günü sosyal tesiste aylık toplantı yapılacaktır.',
      category: 'Yönetim',
      publishedAt: daysAgo(1),
      pinned: false
    },
    {
      id: 'announcement-3',
      siteId: 'site-gunes',
      title: 'Kamera bakımı',
      summary: 'Kuzey blok lobi kamerasında bakım çalışması tamamlandı.',
      category: 'Güvenlik',
      publishedAt: daysAgo(2),
      pinned: false
    }
  ],
  announcementReads: [
    {
      id: 'announcement-read-1',
      announcementId: 'announcement-2',
      profileId: 'profile-resident-ahmet',
      readAt: hoursAgo(10)
    }
  ],
  invoices: [
    {
      id: 'invoice-1',
      unitId: 'unit-a-12',
      periodLabel: 'Mart 2026',
      amount: 1850,
      dueDate: daysAfter(6),
      status: 'paid',
      paidAt: daysAgo(3)
    },
    {
      id: 'invoice-2',
      unitId: 'unit-a-18',
      periodLabel: 'Mart 2026',
      amount: 1850,
      dueDate: daysAfter(6),
      status: 'unpaid'
    },
    {
      id: 'invoice-3',
      unitId: 'unit-b-05',
      periodLabel: 'Mart 2026',
      amount: 1850,
      dueDate: daysAgo(1),
      status: 'overdue'
    },
    {
      id: 'invoice-4',
      unitId: 'unit-b-22',
      periodLabel: 'Mart 2026',
      amount: 1850,
      dueDate: daysAfter(6),
      status: 'paid',
      paidAt: daysAgo(2)
    }
  ],
  payments: [
    {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      unitId: 'unit-a-12',
      amount: 1850,
      recordedAt: daysAgo(3),
      recordedBy: 'Selin Demir'
    },
    {
      id: 'payment-2',
      invoiceId: 'invoice-4',
      unitId: 'unit-b-22',
      amount: 1850,
      recordedAt: daysAgo(2),
      recordedBy: 'Selin Demir'
    }
  ],
  packages: [
    {
      id: 'package-1',
      unitId: 'unit-a-12',
      courierName: 'Trendyol Express',
      status: 'at_desk',
      arrivedAt: minutesAgo(48)
    },
    {
      id: 'package-2',
      unitId: 'unit-b-05',
      courierName: 'Yurtiçi Kargo',
      status: 'delivered',
      arrivedAt: daysAgo(1),
      deliveredAt: hoursAgo(8)
    }
  ],
  packageEvents: [
    {
      id: 'package-event-1',
      packageId: 'package-1',
      note: 'Paket danışma masasına bırakıldı.',
      createdAt: minutesAgo(48)
    },
    {
      id: 'package-event-2',
      packageId: 'package-2',
      note: 'Paket teslim edildi.',
      createdAt: hoursAgo(8)
    }
  ],
  serviceProviders: [
    {
      id: 'provider-1',
      siteId: 'site-atlas',
      category: 'Temizlik',
      fullName: 'Parlak Temizlik',
      phone: '02160000001',
      note: 'Günlük ortak alan temizliği'
    },
    {
      id: 'provider-2',
      siteId: 'site-atlas',
      category: 'Elektrik',
      fullName: 'Bora Elektrik',
      phone: '05390000002',
      note: 'Acil arıza müdahalesi'
    },
    {
      id: 'provider-3',
      siteId: 'site-atlas',
      category: 'Tesisat',
      fullName: 'Mavi Tesisat',
      phone: '05380000003',
      note: 'Su kaçağı ve bakım'
    },
    {
      id: 'provider-4',
      siteId: 'site-atlas',
      category: 'Nakliyat',
      fullName: 'Şehir İçi Nakliyat',
      phone: '05370000004',
      note: 'Taşınma günü planlaması'
    }
  ],
  accessPasses: [
    {
      id: 'pass-1',
      unitId: 'unit-a-12',
      holderName: 'Ayşe Yıldız',
      type: 'qr',
      status: 'active',
      expiresAt: daysAfter(1)
    },
    {
      id: 'pass-2',
      unitId: 'unit-a-12',
      holderName: 'NFC Kart 04',
      type: 'nfc',
      status: 'used',
      expiresAt: daysAgo(1)
    }
  ],
  notifications: [
    {
      id: 'notification-1',
      profileId: 'profile-resident-ahmet',
      title: 'Kargonuz girişte',
      body: 'Trendyol Express gönderiniz danışma masasında bekliyor.',
      tone: 'info',
      createdAt: minutesAgo(48)
    },
    {
      id: 'notification-2',
      profileId: 'profile-resident-ahmet',
      title: 'Aidat kaydınız işlendi',
      body: 'Mart 2026 dönemi aidat kaydınız ödendi olarak işlendi.',
      tone: 'success',
      createdAt: daysAgo(3)
    },
    {
      id: 'notification-3',
      profileId: 'profile-resident-ahmet',
      title: 'Yeni duyuru',
      body: 'Su kesintisi bildirimi yayınlandı.',
      tone: 'warning',
      createdAt: hoursAgo(6)
    }
  ],
  gateEvents: [
    {
      id: 'gate-event-1',
      buildingId: 'building-gunes-kuzey',
      requestId: 'request-3',
      source: 'dashboard',
      result: 'simulated',
      createdAt: hoursAgo(2),
      actorName: 'Mert Aydın'
    }
  ],
  emergencyAlerts: [
    {
      id: 'emergency-1',
      siteId: 'site-atlas',
      title: 'Otopark yangın alarmı kontrol ediliyor',
      status: 'closed',
      createdAt: daysAgo(4)
    }
  ]
};

export const demoCredentialMap = {
  super_admin: { email: 'merkez@onlinekapici.app', password: '123456' },
  consultant: { email: 'danisma@onlinekapici.app', password: '123456' },
  manager: { email: 'yonetim.atlas@onlinekapici.app', password: '123456' },
  resident: { email: 'ahmet.yilmaz@onlinekapici.app', password: '123456' },
  kiosk_device: { email: 'terminal.atlas.a@onlinekapici.app', password: '123456' }
} as const;

export function clonePortalState() {
  return JSON.parse(JSON.stringify(portalSeedState)) as PortalState;
}

export function profileToSessionUser(profile: Profile): PortalSessionUser {
  return {
    id: profile.id,
    fullName: profile.fullName,
    role: profile.role,
    phone: profile.phone,
    title: profile.title,
    loginId: profile.loginId,
    siteIds: [...profile.siteIds],
    buildingIds: [...profile.buildingIds],
    unitId: profile.unitId
  };
}

export function createDemoSession(profile: Profile): PortalAuthSession {
  return {
    token: `demo-${profile.id}`,
    mode: 'demo',
    user: profileToSessionUser(profile)
  };
}
