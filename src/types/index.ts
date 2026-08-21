export type UserRole = 'youth' | 'youth-house' | 'trainer' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  birthDate: string;
  gender: 'male' | 'female';
  role: UserRole;
  points: number;
  level: string;
  badges: string[];
  visitCount: number;
  joinDate: string;
  profilePhoto: string;
  parentApprovalStatus?: 'approved' | 'pending' | 'none';
  gencKartId: string;
  eventsAttended: number;
  trainingsCompleted: number;
  feedbackCount: number;
}

export interface YouthHouse {
  id: string;
  name: string;
  city: string;
  region: string;
  address: string;
  coordinates: { lat: number; lng: number };
  photos: string[];
  services: string[];
  rating: number;
  activeEvents: number;
  currentVisitors: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  contactPhone: string;
  workingHours: string;
  description: string;
  rooms: string[];
  isActive: boolean;
  averageStayDuration: string;
  feedbackScore: number;
  status: 'Aktiv' | 'Sakit' | 'Yüklü' | 'Diqqət tələb edir';
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  youthHouseId: string;
  youthHouseName: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  registeredCount: number;
  checkedInCount: number;
  checkedOutCount: number;
  points: number;
  image: string;
  trainerId?: string;
  trainerName?: string;
  status: 'Açıq qeydiyyat' | 'Qeydiyyatdan keçib' | 'Gözləmə siyahısında' | 'İştirak edib' | 'Bitib' | 'Ləğv edilib' | 'Davam edir';
  feedbackEnabled: boolean;
}

export interface QRScan {
  id: string;
  userId: string;
  userName: string;
  type: 'Youth House Check-in' | 'Youth House Check-out' | 'Event Check-in' | 'Event Check-out' | 'Room Activity' | 'GəncKart Discount' | 'Reward Redemption';
  youthHouseId: string;
  youthHouseName: string;
  eventId?: string;
  eventName?: string;
  roomId?: string;
  roomName?: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  trainerId?: string;
  deviceId: string;
  status: 'Təsdiqləndi' | 'Rədd edildi' | 'Gözləmədə' | 'Şübhəli' | 'Manual təsdiq gözləyir';
  pointsAwarded: number;
  synced: boolean;
  suspiciousFlag: boolean;
  suspiciousReason?: string;
}

export interface Feedback {
  id: string;
  userId: string;
  userName: string;
  eventId: string;
  eventName: string;
  trainerId?: string;
  trainerName?: string;
  contentRating: number;
  instructorRating: number;
  equipmentRating: number;
  comment: string;
  pointsAwarded: number;
  submittedAt: string;
  status: 'submitted' | 'pending';
}

export interface Reward {
  id: string;
  title: string;
  category: string;
  description: string;
  requiredPoints: number;
  quantity: number;
  image: string;
  status: 'active' | 'inactive';
}

export interface GencKartPartner {
  id: string;
  name: string;
  category: string;
  address: string;
  city: string;
  discount: number;
  image: string;
  description: string;
}

export interface NewsItem {
  id: string;
  title: string;
  category: string;
  shortDescription: string;
  fullText: string;
  image: string;
  date: string;
  author: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  progress: number;
  target: number;
  startDate: string;
  endDate: string;
  category: string;
  isCompleted: boolean;
}

export interface Trainer {
  id: string;
  fullName: string;
  expertise: string[];
  photo: string;
  assignedEvents: number;
  averageRating: number;
  totalParticipants: number;
  feedbackCount: number;
  avgContentRating: number;
  avgInstructorRating: number;
  avgEquipmentRating: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'event' | 'points' | 'reward' | 'challenge' | 'news' | 'reminder' | 'system';
  read: boolean;
  createdAt: string;
}

export interface PointTransaction {
  id: string;
  activity: string;
  points: number;
  source: string;
  date: string;
  status: 'earned' | 'spent';
  relatedEvent?: string;
  relatedYouthHouse?: string;
}

export type BadgeCategory =
  | 'Ziyarət'
  | 'Tədbir və iştirak'
  | 'Könüllülük'
  | 'Təlim və inkişaf'
  | 'Rəy və keyfiyyət'
  | 'Ekologiya, sağlamlıq və idman'
  | 'Liderlik və nailiyyət';

export interface Badge {
  id: string;
  name: string;
  description: string;
  condition: string;
  category: BadgeCategory;
  icon: string;
  unlocked: boolean;
  unlockedDate?: string;
  progress: number;
  target: number;
}

export interface Room {
  id: string;
  name: string;
  youthHouseId: string;
  occupancy: number;
  maxCapacity: number;
  pointsReward: number;
}
