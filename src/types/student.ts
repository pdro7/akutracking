export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  parentName: string;
  enrollmentDate: string;
  isActive: boolean;
  packSize: number;
  classesAttended: number;
  classesRemaining: number;
  lastPaymentDate: string;
  attendanceHistory: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  attended: boolean;
  markedBy: string;
}

export interface Settings {
  defaultPackSize: number;
  classDay: string;
}

export type UserRole = 'admin' | 'instructor';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type PaymentStatus = 'good' | 'low' | 'due';

export function getPaymentStatus(classesRemaining: number): PaymentStatus {
  if (classesRemaining === 0) return 'due';
  if (classesRemaining <= 2) return 'low';
  return 'good';
}
