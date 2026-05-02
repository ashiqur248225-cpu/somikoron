# Somikoron - Flutter Project File Structure

This document outlines the recommended file structure for the Flutter version of the Somikoron Hostel Management System, following Clean Architecture principles.

## Structure Overview

```text
lib/
├── main.dart                 # App entry point & Firebase initialization
├── app.dart                  # Material App & Theme configuration
│
├── core/                     # Reusable utilities and constants
│   ├── constants/            # API keys, collection names, colors
│   ├── theme/                # Custom App Theme (ShadCN style)
│   ├── utils/                # Date formatters, Validators, SMS helpers
│   └── widgets/              # Global reusable widgets (Buttons, Inputs, Cards)
│
├── models/                   # Data Models (Entity to JSON conversion)
│   ├── student_model.dart
│   ├── building_model.dart
│   ├── staff_model.dart
│   ├── payment_model.dart
│   ├── expense_model.dart
│   ├── branch_model.dart
│   └── transfer_model.dart
│
├── services/                 # Firebase & Third-party API logic
│   ├── auth_service.dart     # Custom logic for phone/password login
│   ├── database_service.dart # Firestore CRUD operations
│   ├── sms_service.dart      # Alpha Net BD SMS API integration
│   └── storage_service.dart  # (Optional) Profile picture storage
│
├── providers/                # State Management (Provider/Riverpod/GetX)
│   ├── auth_provider.dart    # User session and role management
│   ├── student_provider.dart # Live student list and filtering
│   ├── building_provider.dart# Seat allocation and occupancy tracking
│   └── finance_provider.dart # Income/Expense ledger and net balance
│
└── views/                    # Screens organized by feature
    ├── auth/                 # Login & Registration screens
    ├── dashboard/            # Multi-role dashboard with charts
    ├── students/             # List, Profile, Enrollment Verification
    ├── buildings/            # Building details, Seat matrix
    ├── finance/              # Payment Entry, Expense Entry, Ledger
    ├── sms/                  # Panel, Templates, Logs, Broadcast
    ├── admin/                # Staff directory, Branch management
    ├── reports/              # Performance analytics & PDF Export
    └── settings/             # System config, Rules, Opening Balances
```

## Key Folders Explained

### 1. `core/`
এখানে অ্যাপের গ্লোবাল বিষয়গুলো থাকবে। যেমন: আপনার বর্তমান CSS ভেরিয়েবলগুলোর মত থিম কনফিগারেশন এবং তারিখ ফরম্যাট করার ইউটিলিটি।

### 2. `models/`
Firestore থেকে আসা ডাটাকে Dart অবজেক্টে রূপান্তর করার জন্য। বর্তমানে `backend.json`-এ যে এন্টিটিগুলো আছে সেগুলো এখানে `StudentModel`, `BuildingModel` হিসেবে থাকবে।

### 3. `services/`
Firebase-এর সাথে সরাসরি যোগাযোগের জন্য। যেমন: `database_service.dart` ফাইলে আপনার বর্তমানে ব্যবহৃত `writeBatch` এবং `increment` লজিকগুলো থাকবে।

### 4. `views/`
প্রতিটি পেজের জন্য আলাদা ফোল্ডার। যেমন: `students/` ফোল্ডারে `student_list_screen.dart` এবং `student_profile_screen.dart` থাকবে।

### 5. `providers/`
State Management-এর জন্য। ইউজার যখন লগইন করবেন বা একটি পেমেন্ট এন্ট্রি করবেন, তখন পুরো অ্যাপের ডাটা যাতে তাৎক্ষণিকভাবে আপডেট হয় তা নিশ্চিত করবে এই ফোল্ডারের কোড।

---
*Generated for Somikoron Project Migration*
