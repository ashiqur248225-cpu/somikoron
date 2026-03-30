export type Building = {
  id: string;
  name: string;
  address: string;
  totalRooms: number;
};

export type Student = {
  id: string;
  name: string;
  buildingId: string;
  roomNumber: string;
  phone: string;
  paymentSystem: 'package' | 'non-package';
  status: 'active' | 'inactive';
  packageAmount?: number;
  rentAmount?: number;
  mealAmount?: number;
};

export type Income = {
  id: string;
  studentId: string;
  buildingId: string;
  amount: number;
  paymentMonth: string;
  paymentYear: number;
  paymentType: 'advance' | 'partial' | 'full';
  method: 'cash' | 'bank' | 'mobile';
  receiver: string;
  date: string;
  description?: string;
};

export type ExpenseCategory = 'utility' | 'market' | 'salary' | 'rent' | 'maintenance' | 'other';

export type Expense = {
  id: string;
  category: ExpenseCategory;
  partyId: string;
  buildingId: string;
  amount: number;
  date: string;
  meterNumber?: string; // For utilities
  description?: string;
};

export type Party = {
  id: string;
  name: string;
  role: string; // electrician, cook, etc.
  phone: string;
};