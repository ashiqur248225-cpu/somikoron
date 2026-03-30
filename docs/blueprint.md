# **App Name**: HostelLedger

## Core Features:

- Building & Student Management: Create and manage multiple hostel buildings and student profiles, assigning students to specific buildings with options for 'package' or 'non-package' payment systems, and active/inactive status. All data is stored in Firestore.
- Income Entry with Logic: Record student payments, supporting advance, partial, and full payments. Includes specific logic for 'package' (combined rent+meal) and 'non-package' (separate rent and meal amounts) students, along with payment month, year, method, and receiver. Payments are stored in Firestore.
- Categorized Expense Tracking: Log all money outflow, with detailed categorization for utility bills (with meter numbers), market expenses, staff salaries/worker payments, building rent, and other types. Dynamically displays relevant fields based on expense category for precise tracking. Expenses are stored in Firestore.
- Expense Party Master List: Maintain a central directory of persons and entities involved in expenses (e.g., electricians, market vendors, cooks). Allows selection from a searchable dropdown or quick creation of new parties during expense entry. This list is stored in Firestore.
- Searchable Accounting History (Ledgers): View comprehensive ledgers for income and expenses, offering combined views and filters by date range, building, student, payment type, expense category, and person. Records are fetched from Firestore for display.
- Dashboard Overview: A simple dashboard providing key financial snapshots: today's/month's total income and expenses, building-wise summaries, and recent transactions, fetched directly from Firestore for quick insights.
- Basic Financial Reporting: Generate essential reports including monthly income/expense summaries, building-specific financial overviews, and student payment reports. Reports aggregate data directly from Firestore.

## Style Guidelines:

- Light color scheme, primarily featuring a calm and professional medium blue (#296EB3) as the dominant accent for interactive elements and branding, complementing a very soft blue-gray background (#F0F4F7). Clear indicators for income in a clean green (#4CAF50) and expenses in a gentle red (#F06A6A) for instant recognition.
- A single sans-serif font, 'Inter', for all text, ensuring readability, clarity, and a modern, objective feel suitable for accounting data. 'Inter' works well for both headlines and body content.
- Use a set of clear, concise, and standard material-style icons to ensure universal understanding and to maintain the app's clean, practical aesthetic. Icons should complement form fields and navigation.
- Clean, card-based layouts with strong spacing to prevent visual clutter and improve data comprehension. The design must be responsive and mobile-friendly, adapting seamlessly to various screen sizes.
- Subtle and minimal animations to provide feedback on user interactions and state changes without being distracting, ensuring a smooth and efficient user experience consistent with a practical business tool.