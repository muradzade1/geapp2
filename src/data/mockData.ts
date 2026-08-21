import type { Badge, Challenge, EventItem, Feedback, GencKartPartner, NewsItem, Notification, PointTransaction, QRScan, Reward, Room, Trainer, User, YouthHouse } from '../types';

export const currentUser: User = {
  id: '',
  fullName: '',
  email: '',
  phone: '',
  city: '',
  birthDate: '',
  gender: 'male',
  role: 'youth',
  points: 0,
  level: '',
  badges: [],
  visitCount: 0,
  joinDate: '',
  profilePhoto: '',
  gencKartId: '',
  eventsAttended: 0,
  trainingsCompleted: 0,
  feedbackCount: 0,
};
export const hasCurrentUser = false;
export const levels: Array<{ name: string; min: number; max: number }> = [];
export const badges: Badge[] = [];
export const youthHouses: YouthHouse[] = [];
export const eventCategories: string[] = ['Hamısı'];
export const events: EventItem[] = [];
export const rewards: Reward[] = [];
export const partners: GencKartPartner[] = [];
export const newsItems: NewsItem[] = [];
export const challenges: Challenge[] = [];
export const trainers: Trainer[] = [];
export const leaderboardUsers: Array<{ id: string; rank: number; name: string; level: string; points: number; visits: number; events: number; photo: string }> = [];
export const notifications: Notification[] = [];
export const pointTransactions: PointTransaction[] = [];
export const qrScans: QRScan[] = [];
export const feedbacks: Feedback[] = [];
export const rooms: Room[] = [];
export const adminStats = {
  totalUsers: 0,
  activeUsers: 0,
  currentVisitors: 0,
  todayCheckIns: 0,
  todayCheckOuts: 0,
  todayActiveEvents: 0,
  todayActivities: 0,
  todayParticipants: 0,
  monthlyVisits: 0,
  monthlyEventParticipation: 0,
  pointsIssued: 0,
  rewardsUsed: 0,
  gencKartUsage: 0,
  feedbackCount: 0,
  averageFeedbackScore: 0,
};
export const chartData = {
  dailyEntries: [] as Array<{ day: string; entries: number }>,
  eventsByCategory: [] as Array<{ category: string; count: number }>,
  monthlyTrend: [] as Array<{ month: string; users: number; events: number; visits: number }>,
  ageDistribution: [] as Array<{ age: string; count: number }>,
  genderDistribution: [] as Array<{ gender: string; count: number }>,
  topYouthHouses: [] as Array<{ name: string; visitors: number; score: number }>,
};
